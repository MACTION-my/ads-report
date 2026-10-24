import test from 'node:test';
import assert from 'node:assert/strict';
import {SheetHub} from '../google/sheet-service.mjs';
import {sheetSchema} from '../google/sheet-schema.mjs';
import {PhoneSessions} from '../google/phone-sessions.mjs';
test('only Admin creates unique phone logins; disable preserves records and rejects existing sessions',()=>{
 const data=Object.fromEntries(Object.keys(sheetSchema).map(k=>[k,[]]));data.Members=[{userId:'admin',displayName:'Owner',role:'admin',active:true}];let id=0;const hub=new SheetHub(data,'2026-10-24T00:00:00Z',()=>String(++id));
 const body={displayName:'Test Person',phone:'012-3456789',role:'admin'};
 const result=hub.execute('admin','team-members',body),member=result.members.find(m=>m.displayName==='Test Person');assert.equal(member.role,'telesales');assert.equal(member.phone,'+60123456789');assert.equal(member.canLogin,true);
 assert.throws(()=>hub.execute(member.id,'team-members'),/Admin/);assert.throws(()=>hub.execute(member.id,'team-members',body),/Admin/);
 assert.throws(()=>hub.execute('admin','team-members',{...body,displayName:'Other',phone:'+60123456789'}),/already/);assert.throws(()=>hub.execute('admin','team-members',{...body,phone:'0134567890'}),/name already/);assert.throws(()=>hub.execute('admin','team-members',{displayName:'Bad',phone:'123'}));assert.equal(data.Members.length,2);
 assert.ok(!JSON.stringify(hub.execute(member.id,'me')).includes('+60123456789'));assert.ok(!JSON.stringify(hub.execute('admin','team-visibility')).includes('+60123456789'));
 const values=new Map(),sessions=new PhoneSessions({cache:{get:k=>values.get(k),put:(k,v)=>values.set(k,v),remove:k=>values.delete(k)},digest:x=>x,randomToken:()=> 'x'.repeat(40),now:0,enabled:true,members:data.Members});const login=sessions.login('0123456789');assert.equal(sessions.actor(login.token),member.id);
 hub.execute('admin','team-visibility',{revision:0,userId:member.id,active:false});assert.throws(()=>sessions.actor(login.token));assert.equal(data.Members.length,2);
 hub.execute('admin','team-visibility',{revision:1,userId:member.id,active:true});assert.equal(sessions.actor(sessions.login('0123456789').token),member.id);
});
