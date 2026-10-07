const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
function boot() {
  const storage = {};
  const c = vm.createContext({window:{},localStorage:{getItem:k=>storage[k],setItem:(k,v)=>storage[k]=v},console});
  vm.runInContext(fs.readFileSync('js/core.js','utf8'), c);
  c.App = c.window.App;
  if (fs.existsSync('js/learning/ui.js')) vm.runInContext(fs.readFileSync('js/learning/ui.js','utf8'), c);
  return c;
}
test('ba khóa xóa độc lập và library không làm giảm tiến độ', () => {
  const {App} = boot();
  assert.ok(App.courses.genai);
  ['ai','devops','genai'].forEach(course => App.register({id:course+'-x',course,labs:[{id:'a'}]}));
  App.register({id:'genai-resources',course:'genai',kind:'resources',quiz:[{}]});
  ['ai','devops','genai'].forEach(course=>App.store.setLab(course+'-x','a'));
  assert.equal(App.overallProgress('genai'),1);
  App.store.resetCourse('genai');
  assert.equal(App.overallProgress('genai'),0);
  assert.equal(App.overallProgress('ai'),1);assert.equal(App.overallProgress('devops'),1);
});
test('thư viện đọc bài mới và supplement, tìm không dấu, lọc khóa, đăng ký một lần', () => {
  const c = boot(), App=c.App;
  assert.equal(typeof App.registerResourcePages,'function');
  App.register({id:'new',course:'genai',study:{references:[{title:'Chia tài liệu',url:'https://example.org/a',topic:'RAG',note:'Tra cứu nguồn',checked:'07/10/2026'}]}});
  App.register({id:'old',course:'ai'});
  c.window.LearningContent={supplements:{old:{references:[{title:'Đánh giá',url:'https://example.org/b',topic:'Dữ liệu',note:'Chia tập',checked:'07/10/2026'}]}}};
  App.registerResourcePages();App.registerResourcePages();
  assert.equal(App.lessons.filter(l=>l.kind==='resources').length,3);
  assert.equal(App.findReferences('chia tai lieu','genai').length,1);
  assert.equal(App.findReferences('chia tap','ai').length,1);
  assert.equal(App.findReferences('không có tài liệu','all').length,0);
});
test('renderer chỉ ghi lịch sử khi chạy và giữ HTML nhập dưới dạng văn bản', () => {
  const c=boot(),App=c.App;
  assert.equal(typeof App.renderExperimentLesson,'function');
  class Element {
    constructor(tag){this.tagName=tag;this.children=[];this.listeners={};this.value='';this.textContent='';}
    appendChild(n){this.children.push(n);return n;}
    addEventListener(type,fn){this.listeners[type]=fn;}
    setAttribute(){}
  }
  const sim=new Element('div');
  c.document={createElement:tag=>new Element(tag)};
  let theory='';App.shell=(root,l,html)=>{theory=html;return {sim,lab:null,quiz:null};};App.labUI=()=>{};App.quizUI=()=>{};
  const lesson={id:'unsafe',study:{sections:[{title:'Nguyên lý',html:'<p>Kiến thức trước thực hành.</p>'}]},experiment:{defaults:{text:'<img src=x onerror=alert(1)>'},controls:[{key:'text',label:'Văn bản',type:'textarea'}],run:input=>({echo:input.text})}};
  App.renderExperimentLesson({}, {},lesson);
  assert.ok(theory.includes('Kiến thức trước thực hành.'));
  const studyRoot=new Element('div');App.studyUI(studyRoot,lesson);
  assert.equal(studyRoot.children[0].children.length,0,'không lặp lại lý thuyết sau bài kiểm tra');
  assert.equal(lesson.state.history.length,0);assert.equal(lesson.state.result,null);
  const all=n=>[n,...n.children.flatMap(all)];
  const nodes=all(sim),button=nodes.find(n=>n.tagName==='button'&&n.textContent.includes('Chạy'));
  button.listeners.click();
  assert.equal(lesson.state.history.length,1);
  const output=nodes.find(n=>n.tagName==='pre');
  assert.ok(output.textContent.includes('<img src=x onerror=alert(1)>'));
  assert.equal(nodes.some(n=>n.tagName==='img'),false);
  nodes.find(n=>n.tagName==='button'&&n.textContent.includes('Đặt lại')).listeners.click();
  assert.equal(lesson.state.history.length,0);assert.equal(lesson.state.result,null);
});
test('dựng lab prompting không tạo thẻ ảnh thực thi từ ví dụ trong gợi ý', () => {
  const c=boot(),App=c.App,lesson=require('../js/lessons/genai/prompting.js');
  const rendered=[];
  const element=()=>({textContent:'',className:'',classList:{toggle(){},add(){}},appendChild(){},addEventListener(){},querySelector(){return element();}});
  c.document={getElementById:()=>element()};
  // Kiểm tra đầu ra HTML tại ranh giới DOM; labUI và nội dung bài chạy thật.
  App.h=html=>{rendered.push(html);return element();};
  App.labUI(element(),lesson,{interval(){}});
  const tags=rendered.flatMap(html=>html.match(/<img\b[^>]*>/gi)||[]);
  assert.deepEqual(tags,[],'ví dụ phải là văn bản, không sinh thẻ img trong DOM');
  assert.ok(rendered.some(html=>html.includes('&lt;img')),'gợi ý vẫn chứa ví dụ để đọc');
});

test('thư viện mở hướng dẫn nội bộ riêng và lọc cùng khóa học', () => {
  const c=boot(),App=c.App;
  class Element {
    constructor(tag){this.tagName=tag;this.children=[];this.listeners={};this.value='';this._text='';}
    get textContent(){return this._text;}
    set textContent(value){this._text=value;this.children=[];}
    appendChild(child){this.children.push(child);return child;}
    addEventListener(type,fn){this.listeners[type]=fn;}
    setAttribute(){}
  }
  c.document={createElement:tag=>new Element(tag)};
  App.register({id:'rag-example',course:'genai',study:{references:[{title:'Nguồn chính thức RAG',url:'https://example.org/rag',topic:'RAG',note:'Truy xuất',checked:'07/10/2026'}]}});
  App.registerResourcePages();
  const root=new Element('div');App.lessons.find(l=>l.id==='genai-resources').render(root);
  const all=n=>[n,...n.children.flatMap(all)];
  const internal=all(root).find(n=>n.tagName==='section'&&all(n).some(x=>x.textContent==='Thực hành trong dự án'));
  assert.ok(internal,'hướng dẫn trong kho cần có nhóm riêng');
  assert.equal(all(internal).filter(n=>n.tagName==='a').length,1);
  const link=all(internal).find(n=>n.tagName==='a');
  assert.equal(link.href,'docs/tutorials/genai.html');
  assert.ok(fs.existsSync(link.href));
  assert.equal(App.findReferences('', 'genai').length,1,'không trộn hướng dẫn nội bộ vào nguồn chính thức');
  const search=all(root).find(n=>n.tagName==='input');search.value='RAG';search.listeners.input();
  assert.equal(all(internal).filter(n=>n.tagName==='a').length,1,'tìm RAG vẫn thấy hướng dẫn nội bộ');
  search.value='';search.listeners.input();
  const filter=all(root).find(n=>n.tagName==='select');filter.value='ai';filter.listeners.change();
  assert.equal(all(internal).find(n=>n.tagName==='a').href,'docs/tutorials/ml.html');
  search.value='không tồn tại';search.listeners.input();
  assert.equal(all(internal).filter(n=>n.tagName==='a').length,0);
});
