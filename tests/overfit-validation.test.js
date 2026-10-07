const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');
const path=require('node:path');const file=path.join(__dirname,'../js/learning/workflows.js');const W=fs.existsSync(file)?require(file):{};
test('tối ưu đa thức không đọc test; đánh giá cuối không đổi lựa chọn validation',()=>{
  assert.equal(typeof W.tunePolynomial,'function');
  const s={pool:[[-1,1],[-0.5,0.25],[0,0],[0.5,0.25],[1,1]],extra:[],validation:[[-0.7,0.49],[0.7,0.49]],nTrain:5,degree:2,lam:0};
  Object.defineProperty(s,'test',{get(){throw new Error('Không được đọc test khi chọn mô hình');}});
  const r=W.tunePolynomial(s,4);assert.equal(r.bestDegree,2);assert.ok(r.validationErr<1e-12);assert.equal(r.testErr,undefined);
  const a={...r,test:[[0.25,0.0625]]};const b={...r,test:[[0.25,99]]};
  assert.ok(W.evaluatePolynomialTest(a)<1e-12);assert.ok(W.evaluatePolynomialTest(b)>9000);
  assert.equal(a.bestDegree,2);assert.equal(b.bestDegree,2);
});
test('giao diện chọn bậc bằng validation và chỉ tính test khi bấm đánh giá cuối',()=>{
  let lesson;const nodes={},sliders={},metrics={};
  const element=id=>nodes[id]||(nodes[id]={append(){},appendChild(){},listeners:{},addEventListener(k,fn){this.listeners[k]=fn;},querySelector(selector){return element(selector.slice(1));}});
  const App={register:l=>lesson=l,fmt:(v,d)=>Number(v).toFixed(d||0),h:html=>element((html.match(/id="([^"]+)"/)||[])[1]||html),shell:()=>({sim:element('sim'),lab:{},quiz:{}}),slider:c=>{sliders[c.id]=c;return {};},stats:()=>({set:(k,v)=>metrics[k]=v}),view:()=>({ix:v=>v,iy:v=>v,sx:v=>v,sy:v=>v,pad:{l:0,t:0,r:0,b:0}}),drawAxes(){},dot(){},lineChart(){},labUI(){},quizUI(){}};
  const c=new Proxy({},{get:()=>()=>{}});const ctx={canvas:()=>({w:100,h:100,ctx:c,canvas:element('canvas')})};
  const context={window:{MLMath:require('../js/ml-math.js'),LearningWorkflows:W},App,document:{getElementById:element}};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../js/lessons/overfit.js'),'utf8'),context);lesson.render({},ctx);
  assert.equal(Number(metrics.best),lesson.state.bestDegree,'số đo phải chọn điểm thấp nhất validation');assert.equal(lesson.state.testErr,null);
  nodes['of-final-test'].listeners.click();assert.ok(Number.isFinite(lesson.state.testErr));
  sliders['of-degree'].onInput(4);assert.equal(lesson.state.testErr,null,'đổi cấu hình phải xóa đánh giá cuối');
  const testSet=lesson.state.test;Object.defineProperty(lesson.state,'test',{get(){throw new Error('không đọc test khi chỉnh tham số');},configurable:true});
  sliders['of-degree'].onInput(5);Object.defineProperty(lesson.state,'test',{value:testSet});
});
test('chấm bài overfit dùng validation với cùng kết quả khi thay test',()=>{
  let lesson;const ctx={window:{MLMath:require('../js/ml-math.js')},App:{register:l=>lesson=l,fmt:v=>String(v)}};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../js/lessons/overfit.js'),'utf8'),ctx);
  const s={degreeTouched:true,degree:3,lam:0,validationErr:0.1,bestValidation0:0.1,unregularizedValidationErr:0.3,trainErr:0.01,nTrain:15,errWith15:0.3,testErr:999,bestTest0:0};
  assert.equal(lesson.labs[0].check(s).ok,true);
  const valid={...s,degree:15,lam:0.001};assert.equal(lesson.labs[2].check(valid).ok,true);
  const many={...s,degree:15,nTrain:40};assert.equal(lesson.labs[3].check(many).ok,true);
  for(const task of lesson.labs)assert.equal(task.check(s).ok,task.check({...s,testErr:0,bestTest0:999}).ok);
});
test('regularization phải cải thiện validation so với cùng bậc không điều chuẩn',()=>{
  let lesson;const M=require('../js/ml-math.js');vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../js/lessons/overfit.js'),'utf8'),{window:{MLMath:M},App:{register:l=>lesson=l,fmt:v=>String(v)}});
  const r=M.mulberry32(3*104729),truth=x=>Math.sin(Math.PI*x*.9)*.8+.2*x;
  const make=n=>Array.from({length:n},()=>{const x=r()*2-1;return [x,truth(x)+M.gaussian(r)*.2];});const pool=make(40),validation=make(120);
  const candidates=[{degree:3,lam:0,nTrain:15},{degree:15,lam:0,nTrain:15},{degree:15,lam:0.001,nTrain:15},{degree:15,lam:0,nTrain:40}];
  candidates.forEach((params,i)=>{const s={...params,degreeTouched:true,pool,validation,extra:[]};Object.assign(s,W.tunePolynomial(s));assert.equal(lesson.labs[i].check(s).ok,true,'dữ liệu mặc định phải làm được nhiệm vụ '+lesson.labs[i].id);});
  assert.equal(lesson.labs[2].check({degree:15,lam:0.001,validationErr:0.1,unregularizedValidationErr:1,bestValidation0:0.01}).ok,true);
  assert.equal(lesson.labs[2].check({degree:15,lam:0.001,validationErr:0.1,unregularizedValidationErr:0.09,bestValidation0:0.1}).ok,false);
});
