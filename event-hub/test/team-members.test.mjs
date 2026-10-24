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

test('member edits and recoverable deletion preserve history, enforce concurrency and protect Admin',()=>{
 const data=Object.fromEntries(Object.keys(sheetSchema).map(k=>[k,[]]));data.Members=[{userId:'admin',displayName:'Owner',role:'admin',active:true}];let id=0;const hub=new SheetHub(data,'2026-10-24T00:00:00Z',()=>String(++id));
 let settings=hub.execute('admin','team-members',{displayName:'Original',phone:'0123456789'}),member=settings.members.find(m=>m.displayName==='Original');data.Stats.push({eventId:'history',userId:member.id,salesAmount:100});
 assert.throws(()=>hub.execute(member.id,'team-members',{action:'delete',userId:member.id,memberVersion:member.memberVersion}),/Admin/);
 assert.throws(()=>hub.execute('admin','team-members',{action:'delete',userId:'admin'}),/Admin accounts/);
 settings=hub.execute('admin','team-members',{action:'edit',userId:member.id,memberVersion:member.memberVersion,displayName:'Updated',phone:'0134567890',role:'admin'});
 assert.throws(()=>hub.execute('admin','team-members',{action:'delete',userId:member.id,memberVersion:member.memberVersion}),/changed/);
 member=settings.members.find(m=>m.id===member.id);assert.equal(member.role,'telesales');assert.equal(member.phone,'+60134567890');assert.equal(data.Stats[0].userId,member.id);
 settings=hub.execute('admin','team-members',{action:'delete',userId:member.id,memberVersion:member.memberVersion});member=settings.members.find(m=>m.id===member.id);assert.equal(member.deleted,true);assert.equal(member.active,false);assert.equal(member.canLogin,false);assert.throws(()=>hub.execute(member.id,'me'));
 assert.throws(()=>hub.execute('admin','team-visibility',{revision:0,userId:member.id,active:true}),/Restore/);assert.equal(data.Stats[0].salesAmount,100);
 settings=hub.execute('admin','team-members',{action:'restore',userId:member.id,memberVersion:member.memberVersion});member=settings.members.find(m=>m.id===member.id);assert.equal(member.deleted,false);assert.equal(member.active,false);assert.equal(member.canLogin,true);
 hub.execute('admin','team-visibility',{revision:0,userId:member.id,active:true});assert.equal(hub.execute(member.id,'me').user.displayName,'Updated');assert.equal(data.Stats[0].salesAmount,100);
 assert.ok(data.Audit.some(r=>r.action==='member.delete'));
});

test('transferring a phone creates a new identity and preserves old names, statistics and snapshots',()=>{
 const data=Object.fromEntries(Object.keys(sheetSchema).map(k=>[k,[]]));data.Members=[{userId:'admin',displayName:'Owner',role:'admin',active:true}];let id=0;const hub=new SheetHub(data,'2026-10-24T00:00:00Z',()=>String(++id));
 let result=hub.execute('admin','team-members',{displayName:'Old Employee',phone:'0123456789'}),old=result.members.find(m=>m.displayName==='Old Employee');data.Stats.push({eventId:'history',userId:old.id,salesAmount:123});data.VersionStats.push({statsSnapshotJson:JSON.stringify({userId:old.id,displayName:'Old Employee',salesAmount:123})});const snapshot=JSON.stringify(data.VersionStats);
 const cache=new Map(),sessions=new PhoneSessions({cache:{get:k=>cache.get(k),put:(k,v)=>cache.set(k,v),remove:k=>cache.delete(k)},digest:x=>x,randomToken:()=>String(++id).padEnd(40,'x'),now:0,enabled:true,members:data.Members});const oldLogin=sessions.login('0123456789');
 assert.throws(()=>hub.execute('admin','team-members',{action:'transfer',userId:old.id,memberVersion:old.memberVersion,displayName:'Old Employee'}),/already exists/);
 result=hub.execute('admin','team-members',{action:'transfer',userId:old.id,memberVersion:old.memberVersion,displayName:'New Employee'});const next=result.members.find(m=>m.displayName==='New Employee');assert.notEqual(next.id,old.id);assert.equal(next.phone,'+60123456789');assert.equal(next.active,true);assert.equal(next.role,'telesales');assert.equal(result.members.find(m=>m.id===old.id).phone,'');
 assert.throws(()=>sessions.actor(oldLogin.token));assert.equal(sessions.actor(sessions.login('0123456789').token),next.id);assert.equal(hub.rows('history')[0].displayName,'Old Employee');assert.equal(hub.rows('history')[0].salesAmount,123);assert.equal(JSON.stringify(data.VersionStats),snapshot);assert.throws(()=>hub.execute('admin','team-members',{action:'transfer',userId:old.id,memberVersion:old.memberVersion,displayName:'Another'}),/changed/);
});
