export const counts = ['newLeads','junk','pta','newLeadPta','attended','closedDeals'];
export const money = ['salesAmount','commission','dealIncentive'];
export const fields = [...counts,...money];
export class HubError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}
export function assert(ok, message, status=400) { if (!ok) throw new HubError(message,status); }
export function validateRow(input) {
  const row = {userId: String(input.userId || '').trim(), notes: String(input.notes || '').slice(0,4000)};
  assert(row.userId, '缺少 telesales ID');
  for (const key of fields) {
    if (input[key] === null || input[key] === undefined || input[key] === '') {
      assert(key === 'newLeadPta' || key === 'commission' || key === 'dealIncentive', `${key} 不可为空`);
      row[key] = null; continue;
    }
    assert(typeof input[key] === 'number' || typeof input[key] === 'string',`${key} 格式错误`);
    const value = Number(input[key]);
    assert(Number.isFinite(value) && value >= 0 && value <= 1e9,`${key} 必须是非负有效数字`);
    assert(!counts.includes(key) || Number.isSafeInteger(value),`${key} 必须是整数`);
    assert(!money.includes(key) || Math.abs(value*100-Math.round(value*100)) < 1e-5,`${key} 最多两位小数`);
    row[key] = value;
  }
  return row;
}
export function warnings(row) {
  return [
    [row.junk>row.newLeads,'Junk 大于 New Leads'],
    [row.attended>row.pta,'出席大于 PTA'],
    [row.closedDeals>row.attended,'成交大于出席，请确认后续成交归属'],
    [row.salesAmount>0 && row.closedDeals===0,'有销售额但没有成交数'],
  ].filter(([condition])=>condition).map(([,message])=>message);
}
export function totals(rows) {
  return Object.fromEntries(fields.map(key=>[key,
    rows.length===0 ? (['commission','dealIncentive','newLeadPta'].includes(key)?null:0) :
    rows.some(row=>row[key]===null) ? null : money.includes(key)
      ? rows.reduce((sum,row)=>sum+Math.round(row[key]*100),0)/100
      : rows.reduce((sum,row)=>sum+row[key],0)]));
}
export function rates(row) {
  const rate = (a,b)=>a===null || !b ? null : a/b*100;
  return {leadToJunk:rate(row.junk,row.newLeads),leadToWon:rate(row.closedDeals,row.newLeads),leadToAttended:rate(row.attended,row.newLeads),
    ptaToWon:rate(row.closedDeals,row.pta),leadsToPta:rate(row.pta,row.newLeads),
    ptaToAttended:rate(row.attended,row.pta),attendedToWon:rate(row.closedDeals,row.attended)};
}
export function status(event, now=new Date()) {
  if (['scheduled','draft','awaiting_data','needs_correction'].includes(event.status) && new Date(event.submissionDeadline)<now) return 'overdue';
  const malaysiaDate=new Date(now.getTime()+8*3600000).toISOString().slice(0,10);
  if(event.status==='scheduled' && event.eventDate<malaysiaDate) return 'awaiting_data';
  return event.status;
}
export const csvHeaders = ['eventId','userId',...fields.filter(key=>key!=='newLeadPta'),'notes'];
export function parseCsv(text,expectedHeaders=csvHeaders,convert=null) {
  assert(typeof text==='string' && text.length<=2_000_000,'CSV 太大或格式无效');
  const records=[]; let record=[], value='', quoted=false;
  text=text.replace(/^\uFEFF/,'');
  for(let i=0;i<text.length;i++) {
    const char=text[i];
    if(char==='"') {
      if(quoted && text[i+1]==='"') {value+='"'; i++;}
      else if(quoted) {quoted=false; assert(i+1===text.length || ',\r\n'.includes(text[i+1]),'引号后有非法字符');}
      else {assert(value==='','引号位置不正确'); quoted=true;}
    } else if(!quoted && char===',') {record.push(value); value='';}
    else if(!quoted && (char==='\n'||char==='\r')) {
      if(char==='\r' && text[i+1]==='\n') i++;
      record.push(value); if(record.some(v=>v!=='')) records.push(record); record=[];value='';
    } else value+=char;
  }
  assert(!quoted,'CSV 引号未闭合');
  record.push(value); if(record.some(v=>v!=='')) records.push(record);
  assert(records.length>1,'CSV 没有数据行');
  const headers=records.shift();
  if(expectedHeaders===csvHeaders&&headers.includes('newLeadPta'))expectedHeaders=[...csvHeaders,'newLeadPta'];
  assert(new Set(headers).size===headers.length && expectedHeaders.every(key=>headers.includes(key)) && headers.length===expectedHeaders.length,'CSV 表头必须与模板一致');
  const rows=[], errors=[], seen=new Set();
  records.forEach((cells,index)=>{
    try {
      assert(cells.length===headers.length,'列数不一致');
      const raw=Object.fromEntries(headers.map((key,i)=>[key,cells[i]]));
      if(convert) {rows.push(convert(raw));return;}
      assert(raw.eventId,'缺少 eventId');
      const row={eventId:raw.eventId,...validateRow(raw)};
      const key=JSON.stringify([row.eventId,row.userId]);
      assert(!seen.has(key),'重复 event/person'); seen.add(key); rows.push(row);
    }catch(error){errors.push({line:index+2,message:error.message});}
  });
  return {rows,errors};
}
export function csvExport(rows) {
  const cell=value=>{
    let text=value===null || value===undefined?'':String(value);
    if(/^[\s]*[=+@-]/.test(text) || /^[\t\r\n]/.test(text)) text="'"+text;
    return '"'+text.replaceAll('"','""')+'"';
  };
  return '\uFEFF'+[csvHeaders,...rows.map(row=>csvHeaders.map(key=>row[key]))].map(row=>row.map(cell).join(',')).join('\r\n');
}
