import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
import {sheetSchema} from '../google/sheet-schema.mjs';
import {decodeSheetState,encodeSheetTable} from '../google/sheet-state.mjs';
import {SheetHub} from '../google/sheet-service.mjs';
import {PhoneSessions} from '../google/phone-sessions.mjs';
const data=()=>({...Object.fromEntries(Object.keys(sheetSchema).map(name=>[name,[]])),Members:[{userId:'admin',displayName:'Admin',phone:'+60123456789',role:'admin',loginStatus:'phone_only',active:true},{userId:'a',displayName:'A',phone:'+60123456780',role:'telesales',loginStatus:'phone_only',active:true},{userId:'b',displayName:'B',phone:'+60123456781',role:'telesales',loginStatus:'phone_only',active:true},{userId:'viewer',displayName:'Viewer',role:'viewer',active:true}]});
const row=id=>({userId:id,newLeads:10,junk:1,pta:2,newLeadPta:null,attended:1,closedDeals:1,salesAmount:100,commission:null,dealIncentive:null});
test('Google phone-only sessions: exact registered identity, expiry, disable and logout',()=>{
  const state=data(),map=new Map(),cache={get:key=>map.get(key),put:(key,value)=>map.set(key,value),remove:key=>map.delete(key)};
  const options={cache,digest:value=>createHash('sha256').update(value).digest('hex'),randomToken:()=> 'test'.repeat(16),now:100000,enabled:true,members:state.Members};
  const sessions=new PhoneSessions(options),result=sessions.login('012-3456789');assert.equal(sessions.actor(result.token),'admin');
  assert.throws(()=>sessions.login('0123456782'));assert.throws(()=>new PhoneSessions({...options,enabled:false}).login('0123456789'));
  assert.throws(()=>new PhoneSessions({...options,now:result.expiresAt+1}).actor(result.token));
  state.Members[0].active=false;assert.throws(()=>sessions.actor(result.token));state.Members[0].active=true;sessions.logout(result.token);assert.throws(()=>sessions.actor(result.token));
});
test('Google service: self-write isolation, snapshot, correction and server roles',()=>{
  let id=0;const hub=new SheetHub(data(),'2026-10-23T09:00:00Z',()=>String(++id));
  const event=hub.execute('admin','events',{brand:'Pinyu',name:'Test',eventDate:'2026-10-21',submissionDeadline:'2026-10-24T18:00:00+08:00',picUserId:'admin',assignedUserIds:['a','b']}).event;
  assert.throws(()=>hub.execute('a',`events/${event.id}/own-row`,{revision:1,row:row('b')}));
  hub.execute('a',`events/${event.id}/own-row`,{revision:1,row:{...row('a'),commission:123.45}});
  assert.equal(hub.rows(event.id).find(item=>item.userId==='a').commission,123.45);
  assert.throws(()=>hub.prepare('a',hub.event(event.id),[{...row('b'),commission:500}]));
  assert.throws(()=>hub.execute('b',`events/${event.id}/own-row`,{revision:1,row:row('b')}));
  hub.execute('b',`events/${event.id}/own-row`,{revision:2,row:row('b')});
  assert.equal(hub.report(event.id).total.salesAmount,200);assert.equal(hub.rows(event.id).length,2);
  assert.ok(!JSON.stringify(hub.execute('a','me')).includes('+601'));
  hub.execute('admin',`events/${event.id}/rows`,{revision:3,rows:[{...row('a'),commission:0,dealIncentive:0},{...row('b'),commission:0,dealIncentive:0}]});
  hub.execute('admin',`events/${event.id}/transition`,{revision:4,action:'submit'});
  assert.throws(()=>hub.execute('a',`events/${event.id}/own-row`,{revision:5,row:row('a')}));
  assert.throws(()=>hub.execute('a',`events/${event.id}/transition`,{revision:5,action:'finalize'}));
  assert.equal(hub.event(event.id).status,'finalized');
  assert.equal(hub.execute('viewer',`events/${event.id}/history?version=1`).event.status,'finalized');
  assert.equal(hub.execute('viewer',`events/${event.id}/history?version=1`).total.salesAmount,200);
  assert.throws(()=>hub.execute('admin',`events/${event.id}/transition`,{revision:5,action:'return'}));
  hub.execute('admin',`events/${event.id}/transition`,{revision:5,action:'return',reason:'Correction'});
  assert.equal(hub.event(event.id).status,'needs_correction');assert.ok(hub.changed.has('VersionStats'));
});
test('Google state codec preserves cents, nulls and complete metadata',()=>{
  const state=data();state.Events=[{id:'event',name:'Test',brand:'Pinyu',assignedUserIds:['a'],revision:3,status:'submitted',submittedBy:'admin',submittedAt:'2026-10-23T00:00:00Z',archived:false}];state.Stats=[{...row('a'),eventId:'event',salesAmount:.1,commission:null,dealIncentive:0}];
  const tables=Object.fromEntries(Object.keys(sheetSchema).map(name=>{const matrix=encodeSheetTable(name,state[name]);return [name,matrix.slice(1).map(row=>Object.fromEntries(matrix[0].map((key,i)=>[key,row[i]])))];}));
  assert.equal(tables.Stats[0].salesAmountCents,10);const decoded=decodeSheetState(tables);assert.equal(decoded.Stats[0].salesAmount,.1);assert.equal(decoded.Stats[0].commission,null);assert.equal(decoded.Events[0].submittedBy,'admin');
});
test('Google reminders persist once and exclude completed members',()=>{
  let id=0;const hub=new SheetHub(data(),'2026-10-23T09:00:00Z',()=>String(++id));const event=hub.execute('admin','events',{brand:'Franchise',name:'Test',eventDate:'2026-10-21',submissionDeadline:'2026-10-24T18:00:00+08:00',picUserId:'admin',assignedUserIds:['a','b']}).event;
  hub.execute('a',`events/${event.id}/own-row`,{revision:1,row:row('a')});assert.equal(hub.remind().deliveredInApp,2);assert.equal(hub.remind().deliveredInApp,0);assert.equal(hub.execute('a','inbox').length,0);assert.equal(hub.execute('b','inbox').length,1);
});
test('Apps Script bundle has valid V8 syntax and public endpoints',()=>{
  const files=['../core.mjs','../phone.mjs','../attendance.mjs','sheet-schema.mjs','sheet-state.mjs','phone-sessions.mjs','source-refresh.mjs','calendar-sync.mjs','sheet-service.mjs'];
  const source=files.map(file=>readFileSync(new URL('../google/'+file,import.meta.url),'utf8').replace(/^import .*?;\r?\n/gm,'').replace(/^export /gm,'')).join('\n')+'\n'+readFileSync(new URL('../google/Runtime.gs',import.meta.url),'utf8');
  new vm.Script(source);assert.ok(source.includes('function hubLogin('));assert.ok(source.includes('function runScheduledReminders_('));
});
test('Apps Script commit uses one atomic batch and treats user text as strings',()=>{
  const files=['../core.mjs','../phone.mjs','../attendance.mjs','sheet-schema.mjs','sheet-state.mjs','phone-sessions.mjs','source-refresh.mjs','calendar-sync.mjs','sheet-service.mjs'];
  const source=files.map(file=>readFileSync(new URL('../google/'+file,import.meta.url),'utf8').replace(/^import .*?;\r?\n/gm,'').replace(/^export /gm,'')).join('\n')+'\n'+readFileSync(new URL('../google/Runtime.gs',import.meta.url),'utf8');
  const calls=[];
  const context=vm.createContext({PropertiesService:{getScriptProperties:()=>({getProperty:()=> 'test-book'})},Sheets:{Spreadsheets:{get:()=>({sheets:['Stats','Audit'].map(title=>({properties:{title,sheetId:123,gridProperties:{rowCount:1000}}}))}),batchUpdate:(body,id)=>calls.push({body,id})}}});
  vm.runInContext(source,context);
  vm.runInContext("hubCommit_({changed:new Set(['Stats','Audit']),data:{_rowCounts:{Stats:5,Audit:1},Stats:[{eventId:'e',userId:'u',salesAmount:1.23,commission:null,dealIncentive:0,notes:'=not-a-formula'}],Audit:[]}})",context);
  assert.equal(calls.length,1);assert.equal(calls[0].body.requests.length,2);
  const update=calls[0].body.requests[0].updateCells;assert.equal(update.range.endRowIndex,5);assert.equal(update.rows[1].values[8].userEnteredValue.numberValue,123);assert.equal(update.rows[1].values[11].userEnteredValue.stringValue,'=not-a-formula');
});

test('Public POST transport dispatches only existing authenticated handlers and wraps malformed requests',()=>{
  const source=readFileSync(new URL('../google/Runtime.gs',import.meta.url),'utf8');
  const context=vm.createContext({console:{error(){}},HubError:class extends Error{},assert:(ok,message)=>{if(!ok)throw Error(message);},ContentService:{MimeType:{JSON:'json'},createTextOutput:text=>({setMimeType:()=>text})}});
  vm.runInContext(source,context);
  vm.runInContext("hubLogin=function(phone){return {ok:true,data:{phone:phone}}};hubCall=function(token,path,body){return token==='valid'?{ok:true,data:{path:path,body:body}}:{ok:false,status:401,error:'denied'}};",context);
  const request=body=>JSON.parse(vm.runInContext('doPost('+JSON.stringify({postData:{contents:JSON.stringify(body)}})+')',context));
  assert.deepEqual(request({method:'hubCall',args:['valid','events',null]}),{ok:true,data:{path:'events',body:null}});
  assert.equal(request({method:'hubCall',args:['invalid','events',null]}).status,401);
  assert.equal(request({method:'installHubTrigger_',args:[]}).ok,false);
  assert.equal(request({method:'hubCall',args:null}).ok,false);
});

test('Combined login reads one Sheets batch, returns no phones, and rechecks disabled sessions',()=>{
  const files=['../core.mjs','../phone.mjs','../attendance.mjs','sheet-schema.mjs','sheet-state.mjs','phone-sessions.mjs','source-refresh.mjs','calendar-sync.mjs','sheet-service.mjs'];
  const source=files.map(file=>readFileSync(new URL('../google/'+file,import.meta.url),'utf8').replace(/^import .*?;\r?\n/gm,'').replace(/^export /gm,'')).join('\n')+'\n'+readFileSync(new URL('../google/Runtime.gs',import.meta.url),'utf8');
  const state=data(),cache=new Map(),calls=[];let released=0;
  const context=vm.createContext({console,PropertiesService:{getScriptProperties:()=>({getProperty:key=>key==='HUB_PHONE_ONLY_ENABLED'?'true':'test-book'})},CacheService:{getScriptCache:()=>({get:key=>cache.get(key),put:(key,value)=>cache.set(key,value),remove:key=>cache.delete(key)})},Utilities:{DigestAlgorithm:{SHA_256:'sha'},Charset:{UTF_8:'utf8'},computeDigest:(_algorithm,value)=>Array.from(createHash('sha256').update(value).digest()),getUuid:()=> 'a'.repeat(32)},LockService:{getScriptLock:()=>({waitLock(){},releaseLock(){released++;}})},Sheets:{Spreadsheets:{Values:{batchGet:(_id,options)=>{calls.push(options);return {valueRanges:options.ranges.map(range=>{const name=range.split("'")[1];return {values:encodeSheetTable(name,state[name])};})};}}}}});
  vm.runInContext(source,context);
  const start=JSON.parse(JSON.stringify(vm.runInContext("hubStart('0123456789')",context)));
  assert.equal(start.ok,true);assert.equal(calls.length,1);assert.equal(calls[0].ranges.length,6);assert.equal(released,0);
  assert.equal(start.data.initial.user.id,'admin');assert.deepEqual(start.data.initial.reports,[]);
  assert.ok(!JSON.stringify(start.data.initial).includes('+601'));assert.ok(!Object.hasOwn(start.data.initial.user,'phone'));
  context.testToken=start.data.token;
  const resume=vm.runInContext("hubCall(testToken,'bootstrap',null)",context);assert.equal(resume.ok,true);assert.equal(calls.length,2);
  state.Members[0].active=false;
  const disabled=vm.runInContext("hubCall(testToken,'bootstrap',null)",context);assert.equal(disabled.ok,false);assert.equal(disabled.status,403);
  assert.equal(vm.runInContext("hubCall('invalid','bootstrap',null)",context).status,401);
});

test('Dashboard reads and sign-in bypass busy writer locks; mutations return a retryable busy response',()=>{
 const source=readFileSync(new URL('../google/Runtime.gs',import.meta.url),'utf8');let locks=0,loads=0;
 class TestError extends Error{constructor(message,status=400){super(message);this.status=status;}}
 const context=vm.createContext({console,HubError:TestError,assert:(ok,message,status)=>{if(!ok)throw new TestError(message,status);},LockService:{getScriptLock:()=>({tryLock:()=>{locks++;return false;},releaseLock:()=>{throw Error('Unacquired lock');}})},SheetHub:class{constructor(){this.changed=new Set();}execute(_actor,path){return {path};}},Utilities:{getUuid:()=> 'test'}});
 vm.runInContext(source,context);context.load=()=>{loads++;return {};};vm.runInContext("hubLoad_=load;hubSession_=function(){return {actor:function(){return 'owner';},login:function(){return {token:'test'};}}};",context);
 assert.equal(vm.runInContext("hubCall('token','events',null)",context).ok,true);assert.equal(vm.runInContext("hubLogin('0123456789')",context).ok,true);assert.equal(locks,0);
 const busy=vm.runInContext("hubCall('token','team-members',{action:'edit'})",context);assert.equal(busy.ok,false);assert.equal(busy.status,503);assert.match(busy.error,/still saving/);assert.equal(locks,1);assert.equal(loads,2);
});

test('deleted events restore with the same identity and immutable final history',()=>{
 const state=data();let seq=0;const hub=new SheetHub(state,'2026-10-24T00:00:00Z',()=>String(++seq));let event=hub.execute('admin','events',{brand:'Pinyu',name:'Restore test',eventDate:'2026-10-21',submissionDeadline:'2030-01-01T00:00:00Z',picUserId:'admin',assignedUserIds:['a']}).event;
 hub.execute('a',`events/${event.id}/own-row`,{revision:event.revision,row:row('a')});hub.execute('admin',`events/${event.id}/transition`,{revision:hub.event(event.id).revision,action:'submit'});const before=JSON.stringify(state.VersionStats),amount=hub.report(event.id).total.salesAmount,revision=hub.event(event.id).revision;
 assert.throws(()=>hub.execute('a',`events/${event.id}/transition`,{revision,action:'delete'}),/Admin/);hub.execute('admin',`events/${event.id}/transition`,{revision,action:'delete'});assert.equal(hub.execute('a','events').length,0);assert.throws(()=>hub.execute('a',`events/${event.id}/history?version=1`),/not found/);assert.throws(()=>hub.execute('admin',`events/${event.id}/transition`,{revision,action:'restore'}),/冲突/);
 hub.execute('admin',`events/${event.id}/transition`,{revision:hub.event(event.id).revision,action:'restore'});assert.equal(hub.event(event.id).status,'finalized');assert.equal(hub.report(event.id).total.salesAmount,amount);assert.equal(JSON.stringify(state.VersionStats),before);assert.equal(hub.execute('a','events').length,1);
 const copy=hub.execute('admin','events',{...hub.event(event.id),name:'Copy',eventDate:'2026-10-25'});assert.equal(copy.rows.length,0);assert.equal(copy.attendanceSummary.records,0);assert.equal(copy.total.salesAmount,0);assert.deepEqual(copy.event.assignedUserIds,['a']);assert.equal(copy.event.status,'scheduled');
});
