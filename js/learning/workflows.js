/* Phép tính và quy trình cục bộ cho học máy và vận hành, không truy cập DOM. */
(function(root){
  'use strict';
  const M=typeof module!=='undefined'&&module.exports?require('../ml-math.js'):root.MLMath;
  const W={};
  const number=(n,min=0,max=Infinity)=>{if(typeof n!=='number'||!Number.isFinite(n)||n<min||n>max)throw new Error('Số nằm ngoài miền hợp lệ.');return n;};
  const values=a=>{if(!Array.isArray(a)||!a.length)throw new Error('Cần một mảng số không rỗng.');a.forEach(v=>number(v,-Infinity));return a;};
  W.split=(data,trainRatio=0.6,validationRatio=0.2,seed=3)=>{
    if(!Array.isArray(data)||data.length<3)throw new Error('Cần ít nhất ba mẫu.');
    number(trainRatio,0,1);number(validationRatio,0,1);number(seed,0);if(!Number.isInteger(seed))throw new Error('Seed phải là số nguyên.');
    if(trainRatio+validationRatio>=1){const error=new Error('Phải dành dữ liệu riêng cho test.');error.code='NO_TEST_SPLIT';throw error;}
    const shuffled=data.slice(),r=M.mulberry32(seed);for(let i=shuffled.length-1;i>0;i--){const j=Math.floor(r()*(i+1));[shuffled[i],shuffled[j]]=[shuffled[j],shuffled[i]];}
    const n=Math.floor(data.length*trainRatio),v=Math.floor(data.length*validationRatio);if(n<1||v<1||n+v>=data.length)throw new Error('Mỗi tập cần ít nhất một mẫu.');
    return {train:shuffled.slice(0,n),validation:shuffled.slice(n,n+v),test:shuffled.slice(n+v)};
  };
  W.fitScaler=train=>{values(train);const mean=train.reduce((a,b)=>a+b,0)/train.length;const scale=Math.sqrt(train.reduce((a,b)=>a+(b-mean)**2,0)/train.length)||1;return {mean,scale};};
  W.transform=(data,scaler)=>{values(data);number(scaler.mean,-Infinity);number(scaler.scale,Number.MIN_VALUE);return data.map(x=>(x-scaler.mean)/scaler.scale);};
  W.classification=(labels,scores,threshold=0.5)=>{
    values(labels);values(scores);number(threshold,0,1);if(labels.length!==scores.length)throw new Error('Nhãn và điểm phải cùng số mẫu.');
    const matrix={tp:0,fp:0,fn:0,tn:0};labels.forEach((y,i)=>{if(y!==0&&y!==1)throw new Error('Nhãn phải là 0 hoặc 1.');number(scores[i],0,1);const p=scores[i]>=threshold;matrix[y?(p?'tp':'fn'):(p?'fp':'tn')]++;});
    const {tp,fp,fn,tn}=matrix,precision=tp+fp?tp/(tp+fp):0,recall=tp+fn?tp/(tp+fn):0;
    return {threshold,matrix,precision,recall,f1:2*tp+fp+fn?2*tp/(2*tp+fp+fn):0,accuracy:(tp+tn)/labels.length,note:(!tp&&!fp)||(!tp&&!fn)?'Mẫu số bằng 0 được quy ước trả 0; cần kiểm tra số mẫu mỗi lớp.':'Các số đo này tính trên bộ validation minh họa, không phải kết quả test cuối.'};
  };
  W.pipeline=i=>{
    const enums={tests:['pass','fail'],build:['pass','fail'],approval:['yes','no'],health:['good','bad']};Object.entries(enums).forEach(([key,allowed])=>{if(!allowed.includes(i[key]))throw new Error('Trạng thái pipeline không hợp lệ.');});
    if(!/^[a-zA-Z0-9_.-]+$/.test(i.version)||! /^[a-zA-Z0-9_.-]+$/.test(i.previous))throw new Error('Cần tên phiên bản không rỗng.');
    const steps=[],stop=reason=>({steps,deployed:false,rollback:false,active:i.previous,reason});steps.push('Kiểm tra');if(i.tests==='fail')return stop('Kiểm thử thất bại');steps.push('Build image');if(i.build==='fail')return stop('Build thất bại');steps.push('Chờ phê duyệt');if(i.approval==='no')return stop('Chưa được phê duyệt');
    steps.push('Triển khai '+i.version,'Kiểm tra sức khỏe');if(i.health==='bad'){steps.push('Rollback '+i.previous);return {steps,deployed:true,rollback:true,active:i.previous,reason:'Phiên bản mới không khỏe'};}
    return {steps,deployed:true,rollback:false,active:i.version,reason:'Phiên bản mới khỏe'};
  };
  W.observation=i=>{
    number(i.requests);number(i.errors,0,i.requests);if(!Number.isInteger(i.requests)||!Number.isInteger(i.errors))throw new Error('Số yêu cầu phải là số nguyên.');
    if(!Array.isArray(i.latencies))throw new Error('Cần danh sách độ trễ.');i.latencies.forEach(x=>number(x));number(i.cpu,0,100);number(i.memory);number(i.limit,Number.MIN_VALUE);number(i.errorBudget,0,1);number(i.latencyBudget);
    const sorted=i.latencies.slice().sort((a,b)=>a-b),p95Ms=sorted.length?sorted[Math.ceil(sorted.length*0.95)-1]:null,errorRate=i.requests?i.errors/i.requests:null,memoryPercent=i.memory/i.limit*100;
    return {requests:i.requests,errorRate,p95Ms,cpuPercent:i.cpu,memoryPercent,alert:(errorRate!==null&&errorRate>i.errorBudget)||(p95Ms!==null&&p95Ms>i.latencyBudget)||i.cpu>=90||memoryPercent>=90,note:'Độ trễ tính bằng mili giây, tài nguyên bằng phần trăm. Thiếu mẫu trả null; p95 dùng thứ hạng gần nhất, bộ nhỏ chỉ minh họa.'};
  };
  // Hàm chọn mô hình chỉ nhận train/validation; tuyệt đối không đọc s.test.
  W.tunePolynomial=(s,maxDegree=15)=>{
    const train=s.pool.slice(0,s.nTrain).concat(s.extra||[]),validation=s.validation;
    const fit=(data,degree,lam)=>{const coefs=M.polyFit(data.map(p=>p[0]),data.map(p=>p[1]),degree,lam);const err=set=>M.mse(set.map(p=>M.polyEval(coefs,p[0])),set.map(p=>p[1]));return {coefs,train:err(data),validation:err(validation)};};
    const cur=fit(train,s.degree,s.lam),curve=[];let bestValidation0=Infinity;
    for(let d=1;d<=maxDegree;d++){const r=fit(train,d,s.lam);curve.push({d,train:r.train,validation:r.validation});bestValidation0=Math.min(bestValidation0,s.lam===0?r.validation:fit(train,d,0).validation);}
    const best=curve.reduce((a,b)=>b.validation<a.validation?b:a);
    return {coefs:cur.coefs,trainErr:cur.train,validationErr:cur.validation,curve,bestDegree:best.d,bestValidation0,unregularizedValidationErr:fit(train,s.degree,0).validation,errWith15:fit(s.pool.slice(0,15).concat(s.extra||[]),s.degree,s.lam).validation};
  };
  W.evaluatePolynomialTest=s=>M.mse(s.test.map(p=>M.polyEval(s.coefs,p[0])),s.test.map(p=>p[1]));
  W.lesson=config=>{
    const l={...config,group:config.course==='devops'?'Vận hành thực tế':'Quy trình học máy',icon:config.icon||'◈',navTitle:config.title,navSub:'Đọc và thực hành 5–10 phút',badge:'Mô phỏng cục bộ',cardText:config.lead};
    const run=config.experiment.run;l.experiment={...config.experiment,run(input){try{return run(input);}catch(e){return {error:e.message,...(e.code?{errorCode:e.code}:{})};}}};
    l.labs=config.tasks.map((t,i)=>({id:'task-'+(i+1),title:t.title,desc:t.desc,hint:t.hint,check(s){return {ok:!!s&&Array.isArray(s.history)&&s.history.some(e=>e.result&&t.accept(e.result)),msg:'Sửa đầu vào theo gợi ý, bấm Chạy rồi kiểm tra kết quả.'};}}));
    l.render=(root,ctx)=>globalThis.App.renderExperimentLesson(root,ctx,l);return l;
  };
  if(typeof module!=='undefined'&&module.exports)module.exports=W;else root.LearningWorkflows=W;
})(typeof window!=='undefined'?window:globalThis);
