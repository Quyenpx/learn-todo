const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const fixtures = {
  foundations: [{limit:100,prompt:90,reserve:20},{limit:100,prompt:60,reserve:20},{limit:100,prompt:60,reserve:40},{limit:200,prompt:100,reserve:30}],
  prompting: [{ticket:'{"name":"An","priority":"high"}'},{ticket:'{"name":"","priority":"high"}'},{ticket:'{"name":"An","priority":"urgent"}'},{ticket:'<img src=x onerror=alert(1)>'}],
  transformer: [{temperature:1,topP:1},{temperature:2,topP:1},{temperature:0.5,topP:0.7},{temperature:1,topP:0.9}],
  embeddings: [{query:'hoàn tiền'},{query:'giao hàng'},{query:'thiên văn'},{query:''}],
  rag: [{query:'hoàn tiền',size:12,overlap:2,k:1},{query:'giao hàng',size:12,overlap:2,k:2},{query:'thiên văn',size:12,overlap:2,k:1},{query:'hoàn tiền',size:6,overlap:2,k:2}],
  tools: [{tool:'calculator',args:'{"a":3,"b":4,"operation":"add"}',permission:'allow'},{tool:'calculator',args:'{"a":3,"b":0,"operation":"divide"}',permission:'allow'},{tool:'lookup',args:'{"key":"refund"}',permission:'deny'},{tool:'lookup',args:'{"key":"refund"}',permission:'allow'}],
  evaluation: [{tp:3,fp:1,fn:2},{tp:3,fp:0,fn:2},{tp:3,fp:1,fn:0},{tp:0,fp:0,fn:2}],
  finetuning: [{rank:4,din:100,dout:200},{rank:8,din:100,dout:200},{rank:1,din:100,dout:200},{rank:0,din:100,dout:200}],
  multimodal: [{tokens:1000,output:500,requests:1,cache:0},{tokens:1000,output:500,requests:10,cache:0},{tokens:1000,output:500,requests:10,cache:0.5},{tokens:1000,output:500,requests:10,cache:1}],
  capstone: [{query:'hoàn tiền',limit:100,k:1},{query:'thiên văn',limit:100,k:1},{query:'giao hàng',limit:100,k:2},{query:'hoàn tiền',limit:2,k:1}],
};
for (const [name, inputs] of Object.entries(fixtures)) test(`bài ${name}: chưa chạy chưa đạt, gợi ý tạo kết quả và lỗi được kiểm tra`, () => {
  const file = path.join(__dirname, `../js/lessons/genai/${name}.js`);
  assert.ok(fs.existsSync(file), 'bài học phải tồn tại');
  const l = require(file);
  assert.ok(l.labs.length >= 4); assert.ok(l.quiz.length >= 6);
  const s = {input:{...l.experiment.defaults},result:null,history:[]};
  l.labs.forEach(t => assert.equal(t.check(s).ok, false));
  inputs.forEach((input, i) => {
    const full = {...l.experiment.defaults,...input};
    const result = l.experiment.run(full);
    assert.ok(result && typeof result === 'object');
    const single = {input:full,result,history:[{input:full,result}]};
    assert.equal(l.labs[i].check(single).ok, true, `gợi ý nhiệm vụ ${i+1}`);
    assert.equal(l.labs[(i+1)%4].check(single).ok, false, 'kết quả khác không được chấm nhầm');
    s.history.push({input:full,result}); s.result=result;
  });
  l.labs.forEach(t => assert.equal(t.check(s).ok, true));
  l.quiz.forEach(q => {assert.ok(q.options[q.answer]);assert.ok(q.explain.length > 15);});
});
