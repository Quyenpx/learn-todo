const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const file = require('node:path').join(__dirname,'../js/learning/workflows.js');
const W = fs.existsSync(file) ? require(file) : {};
test('chia dữ liệu giữ đủ mẫu, không trùng và lặp lại theo seed',()=>{
  assert.equal(typeof W.split,'function');
  const a=W.split([0,1,2,3,4,5,6,7,8,9],0.6,0.2,3);
  assert.equal(a.train.length,6);assert.equal(a.validation.length,2);assert.equal(a.test.length,2);
  assert.deepEqual([...a.train,...a.validation,...a.test].sort((a,b)=>a-b),[0,1,2,3,4,5,6,7,8,9]);
  assert.deepEqual(a,W.split([0,1,2,3,4,5,6,7,8,9],0.6,0.2,3));
  assert.throws(()=>W.split([1,2,3],0.8,0.3,3));
});
test('scaler chỉ học train, giữ nguyên mean khi biến đổi dữ liệu mới',()=>{
  assert.equal(typeof W.fitScaler,'function');
  const scaler=W.fitScaler([2,4]);
  assert.equal(scaler.mean,3);assert.equal(scaler.scale,1);
  assert.deepEqual(W.transform([2,4,100],scaler),[-1,1,97]);
  assert.equal(scaler.mean,3);assert.deepEqual(W.transform([7],W.fitScaler([5,5])),[2]);
  assert.throws(()=>W.fitScaler([]));assert.throws(()=>W.fitScaler([NaN]));
});
test('ma trận và F1 đổi theo ngưỡng; lớp không có dự đoán dương trả 0 có giải thích',()=>{
  assert.equal(typeof W.classification,'function');
  const r=W.classification([1,1,0,0],[0.9,0.4,0.7,0.1],0.5);
  assert.deepEqual(r.matrix,{tp:1,fp:1,fn:1,tn:1});assert.equal(r.precision,0.5);assert.equal(r.recall,0.5);assert.equal(r.f1,0.5);
  const high=W.classification([1,1,0,0],[0.9,0.4,0.7,0.1],0.95);
  assert.equal(high.f1,0);assert.ok(high.note);assert.throws(()=>W.classification([1],[0.2,0.3],0.5));
});
test('pipeline chặn trước triển khai khi kiểm tra hoặc approval không đạt; lỗi sức khỏe rollback phiên bản',()=>{
  assert.equal(typeof W.pipeline,'function');
  const base={tests:'pass',build:'pass',approval:'yes',health:'good',version:'v2',previous:'v1'};
  assert.equal(W.pipeline({...base,tests:'fail'}).deployed,false);
  assert.equal(W.pipeline({...base,build:'fail'}).deployed,false);
  assert.equal(W.pipeline({...base,approval:'no'}).active,'v1');
  const bad=W.pipeline({...base,health:'bad'});assert.equal(bad.rollback,true);assert.equal(bad.active,'v1');
  assert.equal(W.pipeline(base).active,'v2');assert.equal(W.pipeline(base).rollback,false);
});
test('số đo vận hành có đơn vị, percentile gần nhất và cảnh báo theo ngưỡng',()=>{
  assert.equal(typeof W.observation,'function');
  const r=W.observation({requests:100,errors:5,latencies:[10,20,30,40,100],cpu:80,memory:200,limit:1000,errorBudget:0.02,latencyBudget:80});
  assert.equal(r.errorRate,0.05);assert.equal(r.p95Ms,100);assert.equal(r.memoryPercent,20);assert.equal(r.alert,true);
  const empty=W.observation({requests:0,errors:0,latencies:[],cpu:0,memory:0,limit:1000,errorBudget:0.02,latencyBudget:80});
  assert.equal(empty.errorRate,null);assert.equal(empty.p95Ms,null);assert.equal(empty.alert,false);
  assert.throws(()=>W.observation({requests:2,errors:3,latencies:[10],cpu:1,memory:1,limit:10,errorBudget:0.02,latencyBudget:80}));
});
