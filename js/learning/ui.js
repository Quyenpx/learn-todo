/* Giao diện thực hành và thư viện nguồn dùng chung cho ba khóa. */
(function () {
  'use strict';
  const App=window.App;
  function node(tag,text,cls){const el=document.createElement(tag);if(text!==undefined)el.textContent=text;if(cls)el.className=cls;return el;}
  App.renderExperimentLesson=function(root,ctx,lesson){
    const sections=(lesson.study && lesson.study.sections || []).map(s=>`<h2>${s.title}</h2>${s.html}`).join('');
    const view=App.shell(root,lesson,sections || '<h2>Thử và quan sát</h2><p>Sửa đầu vào rồi bấm Chạy. Kết quả là phép tính cục bộ, không gọi mô hình hoặc dịch vụ bên ngoài.</p>');
    const state=lesson.state={input:{...lesson.experiment.defaults},result:null,history:[]},fields={};
    const controls=node('div',undefined,'experiment-controls');
    lesson.experiment.controls.forEach(c=>{
      const label=node('label',undefined,'control');label.appendChild(node('span',c.label));
      const input=node(c.type==='textarea'?'textarea':c.type==='select'?'select':'input');input.id=lesson.id+'-'+c.key;
      if(!['textarea','select'].includes(c.type))input.type=c.type;
      ['min','max','step'].forEach(k=>{if(c[k]!==undefined)input[k]=c[k];});
      (c.options||[]).forEach(o=>{const opt=node('option',o.label || o);opt.value=o.value || o;input.appendChild(opt);});
      input.value=state.input[c.key];fields[c.key]=input;
      const read=()=>{state.input[c.key]=['range','number'].includes(c.type)?(String(input.value).trim()===''?NaN:Number(input.value)):input.value;};input.addEventListener('input',read);input.addEventListener('change',read);
      label.appendChild(input);controls.appendChild(label);
    });view.sim.appendChild(controls);
    const actions=node('div',undefined,'experiment-actions'),run=node('button','▶ Chạy','btn primary'),reset=node('button','↺ Đặt lại','btn');run.type=reset.type='button';actions.appendChild(run);actions.appendChild(reset);view.sim.appendChild(actions);
    const status=node('p','Chưa chạy. Các nhiệm vụ chưa được xác nhận.','muted');status.setAttribute('role','status');view.sim.appendChild(status);
    const output=node('pre','Kết quả sẽ xuất hiện tại đây.','experiment-result');output.setAttribute('aria-live','polite');view.sim.appendChild(output);
    run.addEventListener('click',()=>{
      lesson.experiment.controls.forEach(c=>{const raw=fields[c.key].value;state.input[c.key]=['range','number'].includes(c.type)?(String(raw).trim()===''?NaN:Number(raw)):raw;});
      let result;try{result=lesson.experiment.run({...state.input});}catch(e){result={error:e.message};}
      state.result=result;state.history.push({input:{...state.input},result});output.textContent=JSON.stringify(result,null,2);
      status.textContent=result.error?'Đầu vào chưa hợp lệ: '+result.error:`Đã chạy ${state.history.length} lần. So sánh kết quả và kiểm tra nhiệm vụ bên dưới.`;
    });
    reset.addEventListener('click',()=>{state.input={...lesson.experiment.defaults};state.result=null;state.history=[];Object.keys(fields).forEach(k=>fields[k].value=state.input[k]);output.textContent='Kết quả sẽ xuất hiện tại đây.';status.textContent='Đã đặt lại đầu vào và lịch sử chạy. Tiến độ đã đạt vẫn được lưu.';});
    App.labUI(view.lab,lesson,ctx);App.quizUI(view.quiz,lesson);
  };
  function reference(r){const box=node('article',undefined,'reference-item'),a=node('a',r.title);a.href=r.url;a.target='_blank';a.rel='noopener noreferrer';box.appendChild(a);box.appendChild(node('p',r.note));box.appendChild(node('small',`${r.topic} · Đối chiếu ${r.checked}`));return box;}
  App.studyUI=function(root,lesson){
    const study=lesson.study || ((window.LearningContent||{}).supplements||{})[lesson.id];if(!study)return;
    const wrap=node('div',undefined,'study-content');
    (lesson.experiment ? [] : study.sections||[]).forEach(s=>{const card=node('section',undefined,'card');card.appendChild(node('h2',s.title));const body=node('div');body.innerHTML=s.html;card.appendChild(body);wrap.appendChild(card);});
    if(study.practice){const p=study.practice,card=node('section',undefined,'card');card.appendChild(node('h2',p.title));card.appendChild(node('p',p.goal));const steps=node('ol');(p.steps||[]).forEach(s=>steps.appendChild(node('li',s)));card.appendChild(steps);card.appendChild(node('h3','Kết quả mong đợi'));card.appendChild(node('p',p.expected));card.appendChild(node('h3','Khi kết quả khác dự kiến'));(Array.isArray(p.troubleshooting)?p.troubleshooting:[p.troubleshooting]).filter(Boolean).forEach(t=>card.appendChild(node('p',t)));if(p.code)card.appendChild(node('pre',p.code,'code'));if(p.download){const a=node('a','Tải ví dụ thực hành','btn');a.href=p.download;card.appendChild(a);}
      // Khóa Python có hai file mỗi bài (bài tập và lời giải) nên hỗ trợ danh sách link tải
      if(Array.isArray(p.downloads)&&p.downloads.length){const row=node('div',undefined,'hero-cta');p.downloads.forEach((d,i)=>{const a=node('a',d.label,i?'btn':'btn primary');a.href=d.href;a.setAttribute('download','');row.appendChild(a);});card.appendChild(row);}wrap.appendChild(card);}
    if(study.references&&study.references.length){const card=node('section',undefined,'card');card.appendChild(node('h2','Nguồn đọc thêm'));study.references.forEach(r=>card.appendChild(reference(r)));wrap.appendChild(card);}root.appendChild(wrap);
  };
  const normalize=s=>String(s||'').toLocaleLowerCase('vi').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d');
  App.findReferences=function(query='',course='all'){
    const entries=[];App.lessons.filter(l=>l.kind!=='resources').forEach(l=>{const study=l.study || ((window.LearningContent||{}).supplements||{})[l.id];(study&&study.references||[]).forEach(r=>entries.push({...r,course:App.courseOf(l),lesson:l.id}));});
    return entries.filter(r=>(course==='all'||r.course===course)&&normalize([r.title,r.note,r.topic].join(' ')).includes(normalize(query)));
  };
  App.registerResourcePages=function(){Object.keys(App.courses).forEach(course=>{
    const id=course+'-resources';if(App.lessons.some(l=>l.id===id))return;
    App.register({id,course,kind:'resources',icon:'📚',title:'Thư viện tài liệu',navTitle:'Thư viện tài liệu',navSub:'Nguồn chính thức theo chủ đề',group:'Tài liệu',render(root){
      const view=node('div',undefined,'lesson');view.appendChild(node('h1','Thư viện tài liệu'));
      view.appendChild(node('p','Tìm theo tên, chủ đề hoặc mục đích đọc. Nguồn ngoài giúp bạn học sâu hơn; thư viện không tính vào tiến độ.'));
      const bar=node('div',undefined,'resource-filters'),label=node('label','Tìm tài liệu'),search=node('input');search.type='search';search.placeholder='Ví dụ: RAG, chia dữ liệu';label.appendChild(search);bar.appendChild(label);
      const filterLabel=node('label','Khóa học'),filter=node('select');[{value:'all',label:'Tất cả khóa'},...Object.values(App.courses).map(c=>({value:c.id,label:c.name}))].forEach(o=>{const opt=node('option',o.label);opt.value=o.value;filter.appendChild(opt);});filter.value=course;filterLabel.appendChild(filter);bar.appendChild(filterLabel);view.appendChild(bar);
      const local=node('section',undefined,'card');local.appendChild(node('h2','Thực hành trong dự án'));const localResults=node('div',undefined,'resource-list');local.appendChild(localResults);view.appendChild(local);
      const guides=[{course:'ai',title:'Học máy: chia tập, chuẩn hóa và đánh giá',url:'docs/tutorials/ml.html',note:'Python thư viện chuẩn; chọn mô hình bằng validation và đo test cuối.'},{course:'devops',title:'DevOps: đóng gói và chạy web tĩnh',url:'docs/tutorials/devops.html',note:'Docker, Compose và manifest Kubernetes cho chính Visual Lab.'},{course:'genai',title:'AI tạo sinh: hỏi đáp có nguồn trên máy',url:'docs/tutorials/genai.html',note:'Minh họa truy xuất trong RAG, trích nguồn và từ chối; hướng mô hình thật tùy chọn.'},{course:'python',title:'Python cho AI: cài đặt và chạy notebook',url:'docs/tutorials/python.html',note:'Cài Python, thư viện, mở 15 notebook bài tập và tự kiểm tra bằng bản lời giải.'}];
      const status=node('p');status.setAttribute('role','status');view.appendChild(status);const results=node('div',undefined,'resource-list');view.appendChild(results);
      const paint=()=>{localResults.textContent='';const matched=guides.filter(g=>(filter.value==='all'||g.course===filter.value)&&normalize(g.title+' '+g.note).includes(normalize(search.value)));matched.forEach(g=>{const box=node('article',undefined,'reference-item'),a=node('a',g.title);a.href=g.url;box.appendChild(a);box.appendChild(node('p',g.note));localResults.appendChild(box);});if(!matched.length)localResults.appendChild(node('p','Không có hướng dẫn nội bộ phù hợp.','muted'));results.textContent='';const list=App.findReferences(search.value,filter.value);status.textContent=list.length?`${list.length} nguồn chính thức phù hợp`:'Không có nguồn chính thức phù hợp. Thử đổi từ khóa hoặc khóa học.';list.forEach(r=>results.appendChild(reference(r)));};search.addEventListener('input',paint);filter.addEventListener('change',paint);paint();root.appendChild(view);
    }});
  });};
})();
