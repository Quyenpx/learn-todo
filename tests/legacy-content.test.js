const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');
test('bảo vệ tập test không nhận lỗi seed thay cho lỗi tỷ lệ',()=>{
  const l=require('../js/lessons/ai-data.js'),task=l.labs[3];
  const check=changes=>{const input={...l.experiment.defaults,...changes},result=l.experiment.run(input);return task.check({history:[{input,result}]}).ok;};
  assert.equal(check({seed:-1}),false,'lỗi seed không chứng minh đã thử tỷ lệ không dành test');
  assert.equal(check({seed:0.5}),false,'seed không nguyên cũng không đạt nhiệm vụ tỷ lệ');
  assert.equal(check({trainRatio:NaN}),false,'ô tỷ lệ không phải số không chứng minh tổng train/validation vượt 1');
  assert.equal(check({trainRatio:0.9,validationRatio:0.2}),true,'cấu hình gợi ý phải đạt');
  assert.equal(check({}),false,'cấu hình hợp lệ không đạt nhiệm vụ lỗi');
  assert.equal(task.check({history:[]}).ok,false,'chưa chạy không đạt');
});
const fixtures={
  'ai-data':[{seed:3,fitOn:'train'},{seed:4,fitOn:'train'},{seed:3,fitOn:'all'},{trainRatio:0.9,validationRatio:0.2}],
  'ai-evaluation':[{threshold:0.5},{threshold:0.3},{threshold:0.85},{threshold:1}],
  'devops/devops-cicd':[{tests:'fail'},{approval:'no'},{health:'good'},{health:'bad'}],
  'devops/devops-observability':[{errors:1,latencies:'10,20,30,40,50',cpu:30,memory:200},{errors:10,latencies:'10,20,30,40,50',cpu:30,memory:200},{errors:1,latencies:'10,20,30,40,900',cpu:30,memory:200},{errors:1,latencies:'10,20,30,40,50',cpu:95,memory:200}]
};
for(const [name,inputs] of Object.entries(fixtures))test(`${name}: nhiệm vụ chấm đúng các lần chạy thật, chưa chạy chưa đạt`,()=>{
  const file=path.join(__dirname,'../js/lessons/'+name+'.js');assert.ok(fs.existsSync(file),'bài mới phải được cung cấp');const l=require(file);
  assert.ok(l.labs.length>=4);assert.ok(l.quiz.length>=6);l.labs.forEach(t=>assert.equal(t.check({history:[]}).ok,false));
  const s={history:[]};inputs.forEach((i,index)=>{const input={...l.experiment.defaults,...i},result=l.experiment.run(input),single={history:[{input,result}]};assert.equal(l.labs[index].check(single).ok,true,'gợi ý phải đạt nhiệm vụ');assert.equal(l.labs[(index+1)%4].check(single).ok,false,'không chấm nhầm kết quả');s.history.push({input,result});});
  l.labs.forEach(t=>assert.equal(t.check(s).ok,true));
});
test('study bổ sung có thể nạp ở Node và gộp browser mà không mất dữ liệu trước đó',()=>{
  const file=path.join(__dirname,'../js/content/legacy.js');assert.ok(fs.existsSync(file),'cần study cho bài cũ');const content=require(file);
  const vm=require('node:vm'),context={window:{LearningContent:{supplements:{existing:{}}}}};vm.runInNewContext(fs.readFileSync(file,'utf8'),context);
  assert.ok(context.window.LearningContent.supplements.existing);assert.equal(Object.keys(content.supplements).length,16);
  for(const id of ['gradient','overfit','kmeans','neuron','playground','docker-basics','dockerfile','docker-compose','k8s-basics','k8s-deploy','k8s-config','k8s-ingress','k8s-stateful','k8s-helm','k8s-ml','devops-final']){
    const s=content.supplements[id];assert.ok(s,'bài phải có thể được renderer tìm thấy: '+id);assert.ok(s.sections.length);assert.ok(s.practice.steps.length>=3);assert.ok(s.practice.expected);assert.ok(s.practice.troubleshooting.length);assert.ok(s.references.length>=2);
    s.references.forEach(r=>assert.ok(r.url.startsWith('https://')&&r.title&&r.topic&&r.note&&r.checked));
  }
});
