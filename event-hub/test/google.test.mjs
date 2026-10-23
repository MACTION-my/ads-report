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
  hub.execute('a',`events/${event.id}/own-row`,{revision:1,row:row('a')});
  assert.throws(()=>hub.execute('b',`events/${event.id}/own-row`,{revision:1,row:row('b')}));
  hub.execute('b',`events/${event.id}/own-row`,{revision:2,row:row('b')});
  assert.equal(hub.report(event.id).total.salesAmount,200);assert.equal(hub.rows(event.id).length,2);
  assert.ok(!JSON.stringify(hub.execute('a','me')).includes('+601'));
  hub.execute('admin',`events/${event.id}/rows`,{revision:3,rows:[{...row('a'),commission:0,dealIncentive:0},{...row('b'),commission:0,dealIncentive:0}]});
  hub.execute('admin',`events/${event.id}/transition`,{revision:4,action:'submit'});
  assert.throws(()=>hub.execute('a',`events/${event.id}/own-row`,{revision:5,row:row('a')}));
  assert.throws(()=>hub.execute('a',`events/${event.id}/transition`,{revision:5,action:'finalize'}));
  hub.execute('admin',`events/${event.id}/transition`,{revision:5,action:'finalize'});
  assert.equal(hub.execute('viewer',`events/${event.id}/history?version=1`).total.salesAmount,200);
  assert.throws(()=>hub.execute('admin',`events/${event.id}/transition`,{revision:6,action:'return'}));
  hub.execute('admin',`events/${event.id}/transition`,{revision:6,action:'return',reason:'Correction'});
  assert.equal(hub.event(event.id).status,'needs_correction');assert.ok(hub.changed.has('VersionStats'));
});
test('Google state codec preserves cents, nulls and complete metadata',()=>{
  const state=data();state.Events=[{id:'event',name:'Test',brand:'Pinyu',assignedUserIds:['a'],revision:3,status:'submitted',submittedBy:'admin',submittedAt:'2026-10-23T00:00:00Z',archived:false}];state.Stats=[{...row('a'),eventId:'event',salesAmount:.1,commission:null,dealIncentive:0}];
  const tables=Object.fromEntries(Object.keys(sheetSchema).map(name=>{const matrix=encodeSheetTable(name,state[name]);return [name,matrix.slice(1).map(row=>Object.fromEntries(matrix[0].map((key,i)=>[key,row[i]])))];}));
  assert.equal(tables.Stats[0].salesAmountCents,10);const decoded=decodeSheetState(tables);assert.equal(decoded.Stats[0].salesAmount,.1);assert.equal(decoded.Stats[0].commission,null);assert.equal(decoded.Events[0].submittedBy,'admin');
});
test('Google reminders persist once and exclude completed members',()=>{
  let id=0;const hub=new SheetHub(data(),'2026-10-23T09:00:00Z',()=>String(++id));const event=hub.execute('admin','events',{brand:'Chain',name:'Test',eventDate:'2026-10-21',submissionDeadline:'2026-10-24T18:00:00+08:00',picUserId:'admin',assignedUserIds:['a','b']}).event;
  hub.execute('a',`events/${event.id}/own-row`,{revision:1,row:row('a')});assert.equal(hub.remind().deliveredInApp,2);assert.equal(hub.remind().deliveredInApp,0);assert.equal(hub.execute('a','inbox').length,0);assert.equal(hub.execute('b','inbox').length,1);
});
test('Apps Script bundle has valid V8 syntax and public endpoints',()=>{
  const files=['../core.mjs','../phone.mjs','../attendance.mjs','sheet-schema.mjs','sheet-state.mjs','phone-sessions.mjs','sheet-service.mjs'];
  const source=files.map(file=>readFileSync(new URL('../google/'+file,import.meta.url),'utf8').replace(/^import .*?;\r?\n/gm,'').replace(/^export /gm,'')).join('\n')+'\n'+readFileSync(new URL('../google/Runtime.gs',import.meta.url),'utf8');
  new vm.Script(source);assert.ok(source.includes('function hubLogin('));assert.ok(source.includes('function runScheduledReminders_('));
});
test('Apps Script commit uses one atomic batch and treats user text as strings',()=>{
  const files=['../core.mjs','../phone.mjs','../attendance.mjs','sheet-schema.mjs','sheet-state.mjs','phone-sessions.mjs','sheet-service.mjs'];
  const source=files.map(file=>readFileSync(new URL('../google/'+file,import.meta.url),'utf8').replace(/^import .*?;\r?\n/gm,'').replace(/^export /gm,'')).join('\n')+'\n'+readFileSync(new URL('../google/Runtime.gs',import.meta.url),'utf8');
  const calls=[],sheet={getLastRow:()=>5,getMaxRows:()=>1000,getSheetId:()=>123};
  const context=vm.createContext({PropertiesService:{getScriptProperties:()=>({getProperty:()=> 'test-book'})},SpreadsheetApp:{openById:()=>({getSheetByName:()=>sheet,getId:()=> 'test-book'})},Sheets:{Spreadsheets:{batchUpdate:(body,id)=>calls.push({body,id})}}});
  vm.runInContext(source,context);
  vm.runInContext("hubCommit_({changed:new Set(['Stats','Audit']),data:{Stats:[{eventId:'e',userId:'u',salesAmount:1.23,commission:null,dealIncentive:0,notes:'=not-a-formula'}],Audit:[]}})",context);
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
