import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Hub} from '../service.mjs';
import {csvExport} from '../core.mjs';
const fixture=()=>{
  const hub=new Hub();for(const [id,role] of [['admin','admin'],['pic','pic'],['other','pic'],['viewer','viewer']])hub.db.prepare('INSERT INTO users(id,displayName,role) VALUES(?,?,?)').run(id,id,role);
  const report=hub.saveEvent('admin',{name:'Pinyu test',brand:'Pinyu',eventDate:'2026-10-21',submissionDeadline:'2026-10-24T18:00:00+08:00',picUserId:'pic',assignedUserIds:['pic']});
  const row={userId:'pic',newLeads:96,junk:15,pta:30,newLeadPta:null,attended:20,closedDeals:1,salesAmount:1058.4,commission:null,dealIncentive:null};
  return {hub,id:report.event.id,row};
};
test('active team can view; unassigned writes, forged commissions, stale edits denied',()=>{
  const {hub,id,row}=fixture();try{
    assert.equal(hub.list('viewer').length,1);
    for(const actor of ['viewer','other'])assert.throws(()=>hub.saveRows(actor,id,{revision:1,rows:[row]}));
    assert.throws(()=>hub.saveRows('pic',id,{revision:1,rows:[{...row,commission:100}]}));
    const saved=hub.saveRows('pic',id,{revision:1,rows:[row]});assert.equal(saved.event.revision,2);
    assert.throws(()=>hub.saveRows('admin',id,{revision:1,rows:[row]}));
    hub.db.prepare('UPDATE users SET active=0 WHERE id=?').run('viewer');assert.throws(()=>hub.list('viewer'));
  }finally{hub.close();}
});
test('snapshot immutable, locked submit, correction reason and new version',()=>{
  const {hub,id,row}=fixture();try{
    hub.saveRows('admin',id,{revision:1,rows:[{...row,commission:0,dealIncentive:50}]});
    hub.transition('pic',id,{revision:2,action:'submit'});
    assert.throws(()=>hub.saveRows('pic',id,{revision:3,rows:[row]}));
    assert.throws(()=>hub.transition('pic',id,{revision:3,action:'finalize'}));
    hub.transition('admin',id,{revision:3,action:'finalize'});
    assert.throws(()=>hub.transition('admin',id,{revision:4,action:'return'}));
    hub.transition('admin',id,{revision:4,action:'return',reason:'更正归属'});
    hub.saveRows('admin',id,{revision:5,rows:[{...row,commission:0,dealIncentive:50,salesAmount:2000}]});
    hub.transition('pic',id,{revision:6,action:'submit'});
    assert.equal(hub.history('viewer',id,1).total.salesAmount,1058.4);
    assert.equal(hub.history('viewer',id,2).total.salesAmount,2000);
    assert.ok(hub.logs('admin').length>=7);assert.throws(()=>hub.logs('viewer'));
  }finally{hub.close();}
});
test('import requires explicit mode, validates and commits atomically',()=>{
  const {hub,id,row}=fixture();try{
    const csv=csvExport([{eventId:id,...row}]);const body={revision:1,csv};
    assert.equal(hub.previewImport('admin',id,body).errors.length,0);
    assert.throws(()=>hub.importRows('admin',id,body));assert.equal(hub.rows(id).length,0);
    assert.throws(()=>hub.importRows('admin',id,{...body,csv:csvExport([{eventId:'wrong',...row}]),mode:'merge'}));
    hub.importRows('admin',id,{...body,mode:'merge'});
    assert.equal(hub.report('viewer',id).total.salesAmount,1058.4);
    assert.equal(hub.db.prepare('SELECT count(*) AS n FROM importJobs').get().n,1);
  }finally{hub.close();}
});
