// Local connector bridge. The Calendar connector supplies a fresh reviewed JSON
// snapshot; Apps Script needs only its existing Sheets permissions.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url)),qa=path.join(root,'qa');
const config=JSON.parse(fs.readFileSync(path.join(qa,'calendar-sync-owner.json'),'utf8'));
assert(/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(config.endpoint));
async function call(method,args){const response=await fetch(config.endpoint,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({method,args})});const reply=await response.json();if(!reply.ok)throw Error(reply.error);return reply.data;}
const login=await call('hubStart',[config.phone]);
try{
 assert.equal(login.initial.user.role,'admin');
 if(process.argv[2]==='--inspect'){
  console.log(JSON.stringify({calendarId:config.calendarId,links:login.initial.reports.filter(r=>r.event.calendarKey&&!r.event.archived).map(r=>({id:r.event.calendarKey.slice('primary:'.length),name:r.event.name,date:r.event.eventDate}))}));
 }else{
  assert(process.argv[2],'Fresh Calendar JSON input path required');
  const input=JSON.parse(fs.readFileSync(path.resolve(process.argv[2]),'utf8'));assert(Array.isArray(input)&&input.length<=2000);
  const stamp=new Date().toISOString().replaceAll(':','-'),prefix=path.join(qa,'calendar-run-'+stamp);
  const members=await call('hubCall',[login.token,'team-members',null]);
  fs.writeFileSync(prefix+'-before.json',JSON.stringify({initial:login.initial,members},null,2));
  const result=await call('hubCall',[login.token,'calendar-import',{calendarId:'primary',items:input}]);
  fs.writeFileSync(prefix+'-result.json',JSON.stringify(result,null,2));
  const reports=await call('hubCall',[login.token,'events',null]),afterMembers=await call('hubCall',[login.token,'team-members',null]);
  fs.writeFileSync(prefix+'-after.json',JSON.stringify({reports,members:afterMembers},null,2));
  assert.deepEqual(afterMembers,members,'Concurrent member change; inspect backup');
  for(const before of login.initial.reports){const after=reports.find(r=>r.event.id===before.event.id);assert(after,'Existing event missing');for(const key of ['rows','total','rates','submissions','attendanceSummary'])assert.deepEqual(after[key],before[key],'Existing report data changed: '+key);}
  const oldIds=new Set(login.initial.reports.map(r=>r.event.id)),created=reports.filter(r=>!oldIds.has(r.event.id));
  assert.equal(created.length,result.counts.created||0);for(const r of created){assert.equal(r.rows.length,0);assert.deepEqual(r.event.assignedUserIds,[]);assert.equal(r.attendanceSummary.records,0);}
  console.log(JSON.stringify({verified:true,counts:result.counts,activeEvents:reports.filter(r=>!r.event.archived).length,performanceRows:reports.flatMap(r=>r.rows).length,review:result.results.filter(r=>r.action==='review'),created:created.map(r=>({name:r.event.name,date:r.event.eventDate})),backupPrefix:prefix}));
 }
}finally{await call('hubLogout',[login.token]);}
