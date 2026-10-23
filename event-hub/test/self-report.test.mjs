import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Hub} from '../service.mjs';
import {runReminders} from '../reminders.mjs';
test('telesales submit only own assigned row, preserve teammates, permissions and reminders',()=>{
  const hub=new Hub();
  try{
    for(const [id,role]of[['admin','admin'],['pic','pic'],['a','telesales'],['b','telesales'],['outsider','telesales'],['viewer','viewer']])hub.db.prepare('INSERT INTO users(id,displayName,role) VALUES(?,?,?)').run(id,id,role);
    const {event}=hub.saveEvent('admin',{name:'Self report',brand:'Pinyu',eventDate:'2026-10-21',submissionDeadline:'2026-10-24T18:00:00+08:00',picUserId:'pic',assignedUserIds:['a','b']});
    const row={userId:'a',newLeads:10,junk:1,pta:2,newLeadPta:1,attended:1,closedDeals:0,salesAmount:0,commission:null,dealIncentive:null};
    for(const actor of ['b','outsider','viewer'])assert.throws(()=>hub.submitOwnRow(actor,event.id,{revision:1,row}));
    assert.throws(()=>hub.submitOwnRow('a',event.id,{revision:1,row:{...row,commission:100}}));
    hub.submitOwnRow('a',event.id,{revision:1,row});
    assert.deepEqual(hub.report('b',event.id).completeness.pendingUserIds,['b']);
    assert.throws(()=>hub.submitOwnRow('b',event.id,{revision:1,row:{...row,userId:'b'}}));
    runReminders(hub,new Date('2026-10-22T01:00:00Z'));
    assert.equal(hub.inbox('a').length,0);assert.equal(hub.inbox('b').length,1);
    hub.submitOwnRow('b',event.id,{revision:2,row:{...row,userId:'b',newLeads:20}});
    assert.equal(hub.rows(event.id).find(item=>item.userId==='a').newLeads,10);
    assert.equal(hub.report('pic',event.id).total.newLeads,30);
    assert.equal(hub.inbox('b').length,0);
    assert.throws(()=>hub.transition('a',event.id,{revision:3,action:'submit'}));
    hub.transition('admin',event.id,{revision:3,action:'cancel'});
    assert.throws(()=>hub.submitOwnRow('a',event.id,{revision:4,row}));
  }finally{hub.close();}
});
