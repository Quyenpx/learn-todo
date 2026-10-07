const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = '../js/learning/experiments.js';
const M = fs.existsSync(require('node:path').join(__dirname, path)) ? require(path) : {};
test('softmax ổn định, temperature làm phân phối phẳng hơn', () => {
  assert.equal(typeof M.softmax, 'function');
  assert.deepEqual(M.softmax([1000, 1000]), [0.5, 0.5]);
  assert.ok(Math.abs(M.softmax([0, Math.log(3)])[1] - 0.75) < 1e-12);
  assert.ok(M.softmax([0, 2], 2)[1] < M.softmax([0, 2], 1)[1]);
  assert.throws(() => M.softmax([], 1)); assert.throws(() => M.softmax([1], 0));
  assert.deepEqual(M.topP([0.6, 0.3, 0.1], 0.8).map(x => x.index), [0, 1]);
});
test('cosine xử lý chuẩn hóa và véc-tơ rỗng', () => {
  assert.equal(typeof M.cosine, 'function');
  assert.equal(M.cosine([1, 0], [0, 1]), 0); assert.equal(M.cosine([2, 0], [4, 0]), 1);
  assert.equal(M.cosine([0, 0], [1, 1]), 0); assert.throws(() => M.cosine([1], [1, 2]));
});
test('chia đoạn có overlap và truy xuất trả nguồn thực tế', () => {
  assert.equal(typeof M.chunkText, 'function');
  assert.deepEqual(M.chunkText('a b c d e', 3, 1), ['a b c', 'c d e']);
  assert.throws(() => M.chunkText('a b', 2, 2));
  const r = M.retrieve('hoàn tiền', [{id:'A',text:'hoàn tiền trong 7 ngày'},{id:'B',text:'giao hàng nhanh'}], 1);
  assert.equal(r[0].id, 'A'); assert.ok(r[0].score > 0);
  assert.deepEqual(M.retrieve('', [{id:'A',text:'hoàn tiền'}], 1), []);
});
test('schema và quyền công cụ chặn dữ liệu sai trước khi thực thi', () => {
  assert.equal(typeof M.validateTicket, 'function');
  assert.equal(M.validateTicket('{"name":"An","priority":"high"}').valid, true);
  assert.equal(M.validateTicket('{"name":"An","priority":"urgent"}').valid, false);
  assert.equal(M.validateTicket('<script>').valid, false);
  assert.equal(M.executeTool('calculator', {a:3,b:4,operation:'add'}, ['calculator']).value, 7);
  assert.equal(M.executeTool('calculator', {a:3,b:0,operation:'divide'}, ['calculator']).ok, false);
  assert.equal(M.executeTool('lookup', {key:'refund'}, []).ok, false);
  assert.equal(M.executeTool('calculator', {a:'3',b:4,operation:'add'}, ['calculator']).ok, false);
});
test('số đo, LoRA, ngân sách có đơn vị và đầu vào sai', () => {
  assert.equal(typeof M.metrics, 'function');
  assert.deepEqual(M.metrics(3, 1, 2), {precision:0.75, recall:0.6, f1:2/3});
  assert.equal(M.lora(100, 200, 4).trainable, 1200);
  assert.equal(M.cost(1000, 500, 2, 4), 0.004);
  assert.equal(M.contextBudget(100, 60, 30).fits, true);
  assert.equal(M.contextBudget(100, 80, 30).fits, false);
  assert.throws(() => M.metrics(-1, 0, 1)); assert.throws(() => M.lora(100, 200, 0));
});
test('dữ liệu messages cần vai trò đúng và câu trả lời không rỗng', () => {
  assert.equal(typeof M.validateMessages,'function');
  assert.equal(M.validateMessages('[{"role":"user","content":"Chào"},{"role":"assistant","content":"Xin chào"}]').valid,true);
  assert.equal(M.validateMessages('[{"role":"assistant","content":""}]').valid,false);
  assert.equal(M.validateMessages('[{"role":"admin","content":"x"}]').valid,false);
  assert.equal(M.validateMessages('[]').valid,false);
});
