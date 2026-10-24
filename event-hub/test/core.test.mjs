import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateRow,totals,rates,parseCsv,csvExport,warnings,status} from '../core.mjs';
export const row=(userId,values={})=>({userId,newLeads:0,junk:0,pta:0,newLeadPta:null,attended:0,closedDeals:0,salesAmount:0,commission:null,dealIncentive:null,...values});
test('sample totals and business-defined conversion denominators',()=>{
  const total=totals([row('eric',{pta:2,attended:2,dealIncentive:0}),row('melvin',{pta:4,attended:2,closedDeals:1,salesAmount:1058.4,dealIncentive:50}),row('wilson',{dealIncentive:0}),row('stephanie',{newLeads:96,junk:15,pta:24,attended:16,dealIncentive:0})]);
  assert.equal(total.salesAmount,1058.4);assert.equal(total.pta,30);assert.equal(total.dealIncentive,50);
  const rate=rates(total);assert.equal(rate.leadsToPta,30/96*100);assert.equal(rate.leadToAttended,20/96*100);assert.equal(rate.ptaToWon,100/30);assert.equal(rate.attendedToWon,5);
  assert.equal(rate.leadToJunk,15/96*100);assert.equal(rate.ptaToAttended,20/30*100);assert.equal(rate.leadToWon,1/96*100);
});
test('zero denominator and missing attribution remain unavailable',()=>{
  assert.ok(Object.values(rates(row('a'))).every(value=>value===null));
  assert.ok(Math.abs(rates(totals([row('a',{newLeads:10,pta:5,newLeadPta:null}),row('b',{newLeads:90,pta:9,newLeadPta:1})])).leadsToPta-14)<1e-10);
  assert.equal(totals([row('a',{salesAmount:.1}),row('b',{salesAmount:.2})]).salesAmount,.3);
});
test('counts, money, nulls and warnings',()=>{
  for(const values of [{pta:-1},{pta:1.2},{salesAmount:Infinity},{newLeads:''},{salesAmount:1.234},{pta:true}]) assert.throws(()=>validateRow(row('a',values)));
  assert.equal(validateRow(row('a')).newLeadPta,null);
  assert.equal(warnings(row('a',{attended:2,closedDeals:3,salesAmount:10})).length,2);
});
test('CSV quoted multiline round trip, duplicates and malformed input',()=>{
  const source={eventId:'event',...row('a',{notes:'中文,"说明"\n第二行'})};
  const parsed=parseCsv(csvExport([source]));assert.equal(parsed.errors.length,0);assert.equal(parsed.rows[0].notes,source.notes);
  assert.ok(!csvExport([source]).split('\r\n')[0].includes('newLeadPta'));
  const legacy=csvExport([source]).split('\r\n').map((line,index)=>line+','+(index===0?'"newLeadPta"':'"1"')).join('\r\n');
  assert.equal(parseCsv(legacy).errors.length,0);assert.equal(parseCsv(legacy).rows[0].newLeadPta,1);
  assert.equal(parseCsv(csvExport([source,source])).errors.length,1);
  assert.throws(()=>parseCsv('eventId\n"unclosed'));assert.throws(()=>parseCsv('foo\nbar'));
  assert.ok(csvExport([{...source,notes:'=IMPORTXML("x")'}]).includes("'=IMPORTXML"));
});
test('overdue derived without replacing lifecycle or finalized status',()=>{
  assert.equal(status({status:'draft',submissionDeadline:'2020-01-01T00:00:00Z'}),'overdue');
  assert.equal(status({status:'submitted',submissionDeadline:'2020-01-01T00:00:00Z'}),'submitted');
});
