/* Các phép tính minh họa thuần, dùng chung cho trình duyệt và Node. */
(function (root) {
  'use strict';
  const M = {};
  function number(v, min = 0, integer = false) {
    if (typeof v !== 'number' || !Number.isFinite(v) || v < min || (integer && !Number.isInteger(v))) throw new Error('Giá trị số không hợp lệ.');
    return v;
  }
  M.softmax = (logits, temperature = 1) => {
    number(temperature, Number.MIN_VALUE);
    if (!Array.isArray(logits) || !logits.length) throw new Error('Cần ít nhất một logit.');
    logits.forEach(v => number(v, -Number.MAX_VALUE));
    const max = Math.max(...logits), exps = logits.map(v => Math.exp((v - max) / temperature)), sum = exps.reduce((a,b) => a+b, 0);
    return exps.map(v => v/sum);
  };
  M.topP = (probs, p = 1) => {
    number(p, Number.MIN_VALUE); if (p > 1 || !Array.isArray(probs) || !probs.length) throw new Error('top-p phải thuộc (0, 1].');
    probs.forEach(v => number(v));
    const sum = probs.reduce((a,b) => a+b, 0); if (!sum) throw new Error('Phân phối rỗng.');
    const sorted = probs.map((v,index) => ({index, probability:v/sum})).sort((a,b) => b.probability-a.probability);
    let total = 0; const selected = [];
    for (const item of sorted) { selected.push(item); total += item.probability; if (total >= p - 1e-12) break; }
    return selected.map(x => ({index:x.index, probability:x.probability/total}));
  };
  M.cosine = (a,b) => {
    if (!Array.isArray(a) || !Array.isArray(b) || !a.length || a.length !== b.length) throw new Error('Hai véc-tơ phải cùng số chiều và không rỗng.');
    a.concat(b).forEach(v => number(v, -Number.MAX_VALUE));
    const norm = Math.hypot(...a) * Math.hypot(...b);
    return norm ? Math.max(-1, Math.min(1, a.reduce((s,v,i) => s+v*b[i], 0)/norm)) : 0;
  };
  // Tách theo khoảng trắng chỉ để minh họa, không phải bộ tách token của mô hình.
  M.words = text => String(text || '').toLocaleLowerCase('vi').match(/[\p{L}\p{N}]+/gu) || [];
  M.chunkText = (text, size = 12, overlap = 2) => {
    number(size, 1, true); number(overlap, 0, true); if (overlap >= size) throw new Error('Overlap phải nhỏ hơn kích thước đoạn.');
    const words = String(text || '').trim().split(/\s+/).filter(Boolean), chunks = [];
    for (let i = 0; i < words.length; i += size - overlap) { chunks.push(words.slice(i,i+size).join(' ')); if (i+size >= words.length) break; }
    return chunks;
  };
  M.retrieve = (query, docs, k = 2) => {
    number(k, 1, true);
    const q = M.words(query); if (!q.length) return [];
    const vocabulary = [...new Set(q.concat(...docs.map(d => M.words(d.text))))];
    const vector = words => vocabulary.map(t => words.filter(w => w === t).length);
    return docs.map(d => ({...d, score:M.cosine(vector(q),vector(M.words(d.text)))})).filter(d => d.score > 0).sort((a,b) => b.score-a.score || a.id.localeCompare(b.id)).slice(0,k);
  };
  M.validateTicket = raw => {
    let value; try { value = JSON.parse(raw); } catch (_) { return {valid:false, reason:'Cú pháp JSON không hợp lệ.'}; }
    if (!value || Array.isArray(value) || typeof value !== 'object' || typeof value.name !== 'string' || !value.name.trim()) return {valid:false, reason:'name phải là chuỗi không rỗng.'};
    if (!['low','high'].includes(value.priority)) return {valid:false, reason:'priority chỉ nhận low hoặc high.'};
    if (Object.keys(value).some(k => !['name','priority'].includes(k))) return {valid:false, reason:'Có trường ngoài schema.'};
    return {valid:true, value};
  };
  M.executeTool = (tool, args, permissions = []) => {
    if (!['calculator','lookup'].includes(tool) || !permissions.includes(tool)) return {ok:false, error:'Không có quyền chạy công cụ.'};
    if (!args || typeof args !== 'object' || Array.isArray(args)) return {ok:false,error:'Tham số phải là đối tượng.'};
    if (tool === 'lookup') {
      if (Object.keys(args).length !== 1 || typeof args.key !== 'string') return {ok:false,error:'lookup yêu cầu duy nhất key dạng chuỗi.'};
      const facts = {refund:'Hoàn tiền trong 7 ngày nếu còn hóa đơn.',shipping:'Giao hàng trong 3 ngày làm việc.'};
      return Object.hasOwn(facts,args.key) ? {ok:true,value:facts[args.key]} : {ok:false,error:'Không tìm thấy dữ kiện.'};
    }
    if (Object.keys(args).length !== 3 || typeof args.a !== 'number' || typeof args.b !== 'number' || !Number.isFinite(args.a) || !Number.isFinite(args.b) || !['add','divide'].includes(args.operation)) return {ok:false,error:'Cần a, b hữu hạn và operation add hoặc divide.'};
    if (args.operation === 'divide' && args.b === 0) return {ok:false,error:'Không được chia cho 0.'};
    const value = args.operation === 'add' ? args.a+args.b : args.a/args.b;
    return Number.isFinite(value) ? {ok:true,value} : {ok:false,error:'Kết quả vượt miền số hữu hạn.'};
  };
  M.metrics = (tp,fp,fn) => {
    [tp,fp,fn].forEach(v => number(v,0,true));
    const precision = tp+fp ? tp/(tp+fp) : 0, recall = tp+fn ? tp/(tp+fn) : 0;
    return {precision,recall,f1:2*tp+fp+fn ? 2*tp/(2*tp+fp+fn) : 0};
  };
  M.lora = (din,dout,rank) => {
    [din,dout,rank].forEach(v => number(v,1,true)); if (rank > Math.min(din,dout)) throw new Error('Rank không được vượt kích thước ma trận.');
    const full = din*dout, trainable = rank*(din+dout); return {full,trainable,ratio:trainable/full};
  };
  M.validateMessages = raw => {
    let messages;try {messages=JSON.parse(raw);}catch(_){return {valid:false,reason:'Cú pháp JSON không hợp lệ.'};}
    if(!Array.isArray(messages)||messages.length<2)return {valid:false,reason:'Cần ít nhất một câu hỏi và một câu trả lời.'};
    if(messages.some(m=>!m||!['system','user','assistant'].includes(m.role)||typeof m.content!=='string'||!m.content.trim()))return {valid:false,reason:'Vai trò hoặc nội dung message không hợp lệ.'};
    if(!messages.some(m=>m.role==='user')||messages[messages.length-1].role!=='assistant')return {valid:false,reason:'Cần user và câu trả lời assistant ở cuối.'};
    return {valid:true,count:messages.length,note:'Chỉ kiểm tra cấu trúc, chưa đánh giá dữ kiện, giấy phép hay trùng lặp.'};
  };
  M.cost = (input,output,inputRate,outputRate) => { [input,output,inputRate,outputRate].forEach(v => number(v)); return (input*inputRate+output*outputRate)/1000000; };
  M.contextBudget = (limit,prompt,reserve) => { [limit,prompt,reserve].forEach(v => number(v,0,true)); return {fits:prompt+reserve <= limit,used:prompt+reserve,remaining:limit-prompt-reserve}; };
  M.attention = (query,keys,values) => {
    if (!query.length || keys.length !== values.length || keys.some(k => k.length !== query.length)) throw new Error('Kích thước attention không hợp lệ.');
    const weights = M.softmax(keys.map(k => k.reduce((s,v,i) => s+v*query[i],0)/Math.sqrt(query.length)));
    return {weights,output:weights.reduce((s,w,i) => s+w*number(values[i],-Number.MAX_VALUE),0)};
  };
  M.docs = [{id:'refund',text:'Khách hàng được hoàn tiền trong 7 ngày nếu còn hóa đơn mua hàng.'},{id:'shipping',text:'Giao hàng trong 3 ngày làm việc. Đơn hàng có mã theo dõi.'}];
  M.rag = (query,size,overlap,k) => {
    const chunks = M.docs.flatMap(d => M.chunkText(d.text,size,overlap).map((text,i) => ({id:d.id+'-'+i,source:d.id,text})));
    const retrieved = M.retrieve(query,chunks,k);
    return {chunks:chunks.length,retrieved,answer:retrieved.length ? retrieved.map(d => d.text).join('\n') : 'Không đủ chứng cứ trong tài liệu.',refused:!retrieved.length};
  };
  // Chuẩn hóa bài mô phỏng; mọi nhiệm vụ chỉ đọc những lần đã bấm chạy.
  M.lesson = config => {
    const lesson = {...config,course:'genai',group:'AI tạo sinh',icon:config.icon || '✦',navTitle:config.title,navSub:'Đọc và thực hành 5–10 phút',badge:'AI tạo sinh · Mô phỏng cục bộ',cardText:config.lead};
    const run = config.experiment.run;
    lesson.experiment = {...config.experiment,run(input) { try { return run(input); } catch (e) { return {error:e.message}; } }};
    lesson.labs = config.tasks.map((task,i) => ({id:'task-'+(i+1),title:task.title,desc:task.desc,hint:task.hint,check(s) { return {ok:!!s && Array.isArray(s.history) && s.history.some(entry => entry.result && task.accept(entry.result)),msg:'Chạy mô phỏng theo gợi ý rồi xem số đo kết quả.'}; }}));
    lesson.render = (root,ctx) => globalThis.App.renderExperimentLesson(root,ctx,lesson);
    return lesson;
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = M;
  else root.LearningMath = M;
})(typeof window !== 'undefined' ? window : globalThis);
