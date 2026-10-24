import test from 'node:test';
import assert from 'node:assert/strict';
import {SheetHub} from '../google/sheet-service.mjs';
import {sheetSchema} from '../google/sheet-schema.mjs';
import {encodeSheetTable,decodeSheetState} from '../google/sheet-state.mjs';
import {visibilitySettingsId} from '../visibility.mjs';
function fixture(){
  const data=Object.fromEntries(Object.keys(sheetSchema).map(k=>[k,[]]));data.Members=[{userId:'owner',displayName:'Owner',role:'admin',active:true,phone:'registered',loginStatus:'phone_only'},{userId:'a',displayName:'PIC',role:'pic',active:true,phone:'registered-a',loginStatus:'phone_only'},{userId:'b',displayName:'Secret Leaver',role:'telesales',active:true,phone:'registered-b',loginStatus:'phone_only'}];let id=0;const hub=new SheetHub(data,'2026-10-24T00:00:00Z',()=>String(++id));
  const e=hub.execute('owner','events',{brand:'Pinyu',name:'Test event',eventDate:'2026-10-21',submissionDeadline:'2030-10-24T00:00:00Z',picUserId:'a',assignedUserIds:['a','b'],notes:'private details'}).event;
  const row=(userId,salesAmount)=>({userId,newLeads:10,junk:1,pta:2,newLeadPta:null,attended:1,closedDeals:1,salesAmount,commission:0,dealIncentive:0,notes:'private source detail'});
  hub.execute('owner',`events/${e.id}/rows`,{revision:e.revision,rows:[row('a',100),row('b',98765.43)]});hub.execute('owner',`events/${e.id}/transition`,{revision:hub.event(e.id).revision,action:'submit'});
  data.Attendance.push({eventId:e.id,externalId:'public',name:'Visible attendee',userId:'a',attended:1},{eventId:e.id,externalId:'secret',name:'Secret attendee',userId:'b',attended:1});
  return {hub,data,id:e.id,row};
}
test('privacy is enforced in list, detail, versions, CSV, members and attendance; Admin retains all data',()=>{
  const {hub,id}=fixture();const original=hub.report(id);hub.execute('owner','team-visibility',{revision:0,userId:'b',hidden:true});
  for(const result of [hub.execute('a','events'),hub.execute('a',`events/${id}`),hub.execute('a',`events/${id}/history?version=1`)]){const text=JSON.stringify(result);assert.ok(!text.includes('Secret Leaver'));assert.ok(!text.includes('98765.43'));assert.ok(!text.includes('private details'));}
  const visible=hub.execute('a',`events/${id}`);assert.equal(visible.total.salesAmount,100);assert.deepEqual(visible.event.assignedUserIds,['a']);assert.equal(visible.attendanceSummary.attended,1);assert.equal(visible.event.readOnlyForTeam,true);
  assert.equal(hub.execute('a','me').users.length,2);assert.equal(hub.execute('a',`events/${id}/attendance`).length,1);assert.ok(!hub.execute('a',`events/${id}/export`).includes('98765.43'));
  hub.event(id).status='finalized';assert.ok(!hub.execute('a','export?month=2026-10').includes('98765.43'));
  assert.equal(hub.execute('owner',`events/${id}`).total.salesAmount,original.total.salesAmount);assert.equal(hub.execute('owner',`events/${id}/attendance`).length,2);assert.equal(hub.execute('a','events').length,1);assert.throws(()=>hub.execute('a',`events/${visibilitySettingsId}`));assert.throws(()=>hub.execute('a','team-visibility'),/Admin/);
});
test('privacy changes are reversible and revision checked, preserve private rows on own writes, and disable existing login actors',()=>{
  const {hub,id,row,data}=fixture();hub.execute('owner','team-visibility',{revision:0,userId:'b',hidden:true});assert.throws(()=>hub.execute('owner','team-visibility',{revision:0,userId:'b',hidden:false}),/changed/);assert.throws(()=>hub.execute('owner','team-visibility',{revision:1,userId:'owner',hidden:true}),/Admin accounts/);
  hub.execute('owner',`events/${id}/transition`,{revision:hub.event(id).revision,action:'return',reason:'review'});
  assert.throws(()=>hub.execute('a',`events/${id}/rows`,{revision:hub.event(id).revision,rows:[row('a',200)]}),/private records/);
  const own=hub.execute('a',`events/${id}/own-row`,{revision:hub.event(id).revision,row:row('a',200),acknowledgeWarnings:true});assert.equal(own.total.salesAmount,200);assert.equal(hub.rows(id).length,2);assert.equal(hub.rows(id).find(r=>r.userId==='b').salesAmount,98765.43);
  hub.execute('owner','team-visibility',{revision:1,userId:'b',hidden:false});assert.equal(hub.execute('a',`events/${id}`).total.salesAmount,98965.43);
  const tables=Object.fromEntries(Object.keys(sheetSchema).map(k=>[k,encodeSheetTable(k,data[k]).slice(1).map(values=>Object.fromEntries(sheetSchema[k].map((h,i)=>[h,values[i]])))]));const restored=new SheetHub(decodeSheetState(tables),hub.now,()=> 'x');assert.equal(restored.execute('owner','team-visibility').revision,2);
  hub.execute('owner','team-visibility',{revision:2,userId:'b',active:false});assert.throws(()=>hub.execute('b','me'));assert.equal(data.Stats.length,2);assert.equal(hub.execute('owner','team-visibility').members.find(m=>m.id==='b').active,false);
});
