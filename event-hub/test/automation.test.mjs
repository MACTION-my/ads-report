import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Hub} from '../service.mjs';
import {runReminders} from '../reminders.mjs';
import {parseAttendance} from '../attendance.mjs';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
function setup(path){const hub=new Hub(path);for(const [id,role]of[['admin','admin'],['pic','pic'],['viewer','viewer']])hub.db.prepare('INSERT INTO users(id,displayName,role) VALUES(?,?,?)').run(id,id,role);const report=hub.saveEvent('admin',{name:'test',brand:'Chain',eventDate:'2026-10-21',submissionDeadline:'2026-10-24T18:00:00+08:00',picUserId:'pic',assignedUserIds:['pic']});return {hub,id:report.event.id};}
const csv='externalId,name,email,attended,userId\r\np1,Example,test@example.test,1,pic\r\np2,Other,,0,';
test('attendance validation, restricted PII, deduplication and no inferred statistics',()=>{
  const {hub,id}=setup();try{
    assert.equal(parseAttendance(csv).errors.length,0);
    assert.equal(parseAttendance(csv+'\r\np1,Duplicate,,1,pic').errors.length,1);
    assert.throws(()=>hub.attendanceList('viewer',id));
    hub.importAttendance('pic',id,{csv,revision:1,mode:'merge'});
    assert.equal(hub.report('viewer',id).attendanceSummary.attended,1);
    assert.equal(hub.report('viewer',id).total.attended,0);
    assert.ok(!JSON.stringify(hub.report('viewer',id)).includes('example.test'));
    hub.importAttendance('pic',id,{csv,revision:2,mode:'merge'});
    assert.equal(hub.attendanceList('admin',id).length,2);
    assert.ok(!JSON.stringify(hub.logs('admin')).includes('example.test'));
  }finally{hub.close();}
});
test('server-side reminders: four windows, idempotence, escalation, stop after submission',()=>{
  const {hub,id}=setup();try{
    assert.equal(runReminders(hub,new Date('2026-10-21T00:00:00Z')).deliveredInApp,0);
    assert.equal(runReminders(hub,new Date('2026-10-22T01:00:00Z')).deliveredInApp,1);
    assert.equal(runReminders(hub,new Date('2026-10-22T01:00:00Z')).deliveredInApp,0);
    assert.equal(runReminders(hub,new Date('2026-10-23T12:00:00Z')).deliveredInApp,1);
    assert.equal(runReminders(hub,new Date('2026-10-24T12:00:00Z')).deliveredInApp,1);
    assert.equal(runReminders(hub,new Date('2026-10-26T12:00:00Z')).deliveredInApp,2);
    assert.equal(hub.inbox('viewer').length,0);assert.equal(hub.inbox('admin').length,1);
    hub.transition('admin',id,{revision:1,action:'cancel'});
    assert.equal(runReminders(hub,new Date('2026-10-30T00:00:00Z')).deliveredInApp,0);
  }finally{hub.close();}
});
test('SQLite survives process connection restart',()=>{
  const directory=mkdtempSync(join(tmpdir(),'event-hub-')),path=join(directory,'hub.sqlite');
  try {const {hub,id}=setup(path);hub.close();const next=new Hub(path);try{assert.equal(next.report('viewer',id).event.name,'test');}finally{next.close();}}finally{rmSync(directory,{recursive:true,force:true});}
});
