import test from 'node:test';
import assert from 'node:assert/strict';
import {calendarCourse,syncCalendarSnapshot} from '../google/calendar-sync.mjs';
import {SheetHub} from '../google/sheet-service.mjs';
import {sheetSchema} from '../google/sheet-schema.mjs';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const item=(id='course-1',summary='Online 绩效 - 李金昭',start='2026-11-05T20:00:00+08:00')=>({id,summary,status:'confirmed',start:{dateTime:start},end:{dateTime:new Date(Date.parse(start)+7200000).toISOString()}});
function setup(){let n=0;const data=Object.fromEntries(Object.keys(sheetSchema).map(k=>[k,[]]));data.Members=[{userId:'admin',displayName:'Admin',role:'admin',active:true},{userId:'staff',displayName:'Staff',role:'telesales',active:true}];return {data,hub:new SheetHub(data,'2026-10-24T12:00:00Z',()=>String(++n))};}
test('Calendar includes every supported course category, excludes private travel and uses Malaysia dates',()=>{
 for(const [title,brand] of [['Online 绩效 - 李金昭','Pinyu'],['绩效系统研修班 第24届','Pinyu'],['绩效系统复习班','Pinyu'],['FRANCHISE KL OFFLINE','Franchise'],['JB OFFLINE','Franchise'],['Online 连锁申请A-Z','Franchise'],['连锁申请A-Z (一天课)','Franchise'],['连锁系统落地方案班','Franchise'],['Selena Teh 1to1 Franchie Course','Franchise'],['AI AGENT','AI'],['Leadership workshop','Other Courses']])assert.equal(calendarCourse(item('id',title)).brand,brand,title);
 assert.equal(calendarCourse(item('id','Flight to Kuala Lumpur')),null);assert.equal(calendarCourse({...item(),visibility:'private'}),null);assert.equal(calendarCourse({...item(),eventType:'fromGmail'}),null);
 assert.equal(calendarCourse(item('id','AI AGENT','2026-11-04T18:00:00Z')).eventDate,'2026-11-05');assert.equal(calendarCourse({...item(),start:{date:'2026-11-19'},end:{date:'2026-11-20'}}).deadlineDate,'2026-11-19');assert.equal(calendarCourse({...item(),end:{dateTime:'2026-11-06T18:00:00+08:00'}}).deadlineDate,'2026-11-06');
});
test('Calendar creates empty courses once, uses stable instance IDs and never restores deleted reports',()=>{
 const {data,hub}=setup();assert.throws(()=>syncCalendarSnapshot(hub,'staff','primary',[item()]),/Admin/);
 assert.equal(syncCalendarSnapshot(hub,'admin','primary',[item()]).counts.created,1);const e=data.Events[0];assert.equal(data.Stats.length,0);assert.deepEqual(e.assignedUserIds,[]);assert.equal(e.status,'scheduled');
 const revision=e.revision;assert.equal(syncCalendarSnapshot(hub,'admin','primary',[item()]).counts.unchanged,1);assert.equal(e.revision,revision);
 syncCalendarSnapshot(hub,'admin','primary',[item('course-1','Online 绩效 - 李金昭','2026-11-06T20:00:00+08:00')]);assert.equal(data.Events.length,1);assert.equal(e.eventDate,'2026-11-06');assert.equal(e.submissionDeadline,'2026-11-06T23:59:00+08:00');
 e.archived=true;e.deletedAt=hub.now;assert.equal(syncCalendarSnapshot(hub,'admin','primary',[item()]).counts.skipped,1);assert.equal(e.archived,true);
});
test('Connector snapshot import uses existing Admin session and keeps Calendar OAuth optional',()=>{
 const {data,hub}=setup();assert.throws(()=>hub.execute('staff','calendar-import',{calendarId:'primary',items:[item()]}),/Admin/);
 assert.equal(hub.execute('admin','calendar-import',{calendarId:'primary',items:[item()]}).counts.created,1);assert.equal(hub.execute('admin','calendar-import',{calendarId:'primary',items:[item()]}).counts.unchanged,1);assert.equal(data.Stats.length,0);
 const manifest=JSON.parse(readFileSync(new URL('../google/appsscript.json',import.meta.url),'utf8'));assert(!manifest.oauthScopes.some(s=>s.includes('/calendar')));assert(!manifest.dependencies.enabledAdvancedServices.some(s=>s.serviceId==='calendar'));
});
test('Calendar runtime authenticates Admin before fetching and rejects client-supplied source data',()=>{
 const runtime=readFileSync(new URL('../google/Runtime.gs',import.meta.url),'utf8');let fetched=0;class TestError extends Error{constructor(message,status){super(message);this.status=status;}}
 const ctx=vm.createContext({console,HubError:TestError,assert:(ok,message,status)=>{if(!ok)throw new TestError(message,status);},SheetHub:class{admin(actor){if(actor!=='admin')throw new TestError('Admin required',403);}},Utilities:{getUuid:()=> 'ref'}});vm.runInContext(runtime,ctx);
 ctx.fetchCalendar=()=>{fetched++;return {};};vm.runInContext("hubLoad_=function(){return {Members:[]};};hubSession_=function(){return {actor:function(token){return token;}}};hubCalendarSync_=fetchCalendar;hubProperties_=function(){return {getProperty:function(){return '';}}};",ctx);
 assert.equal(vm.runInContext("hubCall('staff','calendar-sync',{})",ctx).status,403);assert.equal(fetched,0);
 assert.equal(vm.runInContext("hubCall('admin','calendar-sync',{events:[]})",ctx).ok,false);assert.equal(fetched,0);
 assert.equal(vm.runInContext("hubCall('admin','calendar-sync',{})",ctx).ok,true);assert.equal(fetched,1);
 assert.equal(vm.runInContext("hubCall('admin','calendar-status',null)",ctx).data.enabled,false);
});
test('Calendar runtime pages completely before one fresh locked commit; page failures never commit',()=>{
 const runtime=readFileSync(new URL('../google/Runtime.gs',import.meta.url),'utf8');let committed=0,pages=0,applied=0,fail=false;const properties=new Map([['HUB_CALENDAR_ENABLED','true']]);const ctx=vm.createContext({console,Date,Set,assert:(ok,message)=>{if(!ok)throw Error(message);},Utilities:{getUuid:()=> 'id'},Calendar:{Events:{list(_id,options){pages++;if(options.pageToken){if(fail)throw Error('quota');return {items:[item('second')]};}return {items:[item()],nextPageToken:'next'};}}},SheetHub:class{constructor(data){this.data=data;}admin(actor){assert.equal(actor,'admin');}},syncCalendarSnapshot(_hub,actor,id,items){applied++;assert.equal(actor,'admin');assert.equal(id,'primary');assert.equal(items.length,2);return {counts:{created:2}};}});vm.runInContext(runtime,ctx);ctx.props={getProperty:key=>properties.get(key),setProperty:(key,value)=>properties.set(key,value),deleteProperty:key=>properties.delete(key)};ctx.commit=()=>committed++;vm.runInContext("hubProperties_=function(){return props;};hubLoad_=function(){return {Members:[{userId:'admin',active:true,role:'admin'}],Events:[]};};hubWithLock_=function(operation){return operation();};hubCommit_=commit;",ctx);
 assert.equal(vm.runInContext('hubCalendarSync_()',ctx).counts.created,2);assert.equal(pages,2);assert.equal(committed,1);assert(properties.has('HUB_CALENDAR_LAST_SYNC'));
 fail=true;assert.throws(()=>vm.runInContext('hubCalendarSync_()',ctx),/quota/);assert.equal(committed,1);assert.equal(applied,1);assert(properties.has('HUB_CALENDAR_LAST_ERROR'));
});
test('Calendar protects saved results, attendance, finalized versions and manual schedule edits',()=>{
 const {data,hub}=setup();syncCalendarSnapshot(hub,'admin','primary',[item()]);const e=data.Events[0];data.Stats.push({eventId:e.id,userId:'staff',salesAmount:123});data.Attendance.push({eventId:e.id,externalId:'x'});data.Versions.push({eventId:e.id,version:1});e.status='finalized';
 const protectedTables=JSON.stringify([data.Stats,data.Attendance,data.Versions]);const moved=item('course-1','Online 绩效 - updated','2026-11-06T20:00:00+08:00');assert.equal(syncCalendarSnapshot(hub,'admin','primary',[moved]).counts.review,1);assert.equal(e.eventDate,'2026-11-05');assert.match(e.calendarIssue,/Admin review/);const revision=e.revision;syncCalendarSnapshot(hub,'admin','primary',[moved]);assert.equal(e.revision,revision);assert.equal(JSON.stringify([data.Stats,data.Attendance,data.Versions]),protectedTables);
 syncCalendarSnapshot(hub,'admin','primary',[{id:'course-1',status:'cancelled'}]);assert.equal(e.status,'finalized');assert.match(e.calendarIssue,/Cancelled/);assert.equal(JSON.stringify([data.Stats,data.Attendance,data.Versions]),protectedTables);
 const other=setup();syncCalendarSnapshot(other.hub,'admin','primary',[item()]);other.data.Events[0].name='Manual name';syncCalendarSnapshot(other.hub,'admin','primary',[item('course-1','Updated Pinyu')]);assert.equal(other.data.Events[0].name,'Manual name');assert.match(other.data.Events[0].calendarIssue,/name/);
});
test('Calendar links a unique matching existing report, flags ambiguity and skips unrecorded history',()=>{
 const {data,hub}=setup();const e=hub.execute('admin','events',{brand:'Pinyu',name:'Pinyu · Online · 05.11.2026',eventDate:'2026-11-05',submissionDeadline:'2026-11-06T18:00:00+08:00',picUserId:'admin',assignedUserIds:['staff']}).event;
 assert.equal(syncCalendarSnapshot(hub,'admin','primary',[item()]).counts.linked,1);assert.equal(data.Events.length,1);assert.equal(data.Events[0].id,e.id);
 assert.equal(syncCalendarSnapshot(hub,'admin','primary',[item('different-event')]).counts.review,1);assert.equal(data.Events.length,1);
 assert.equal(syncCalendarSnapshot(hub,'admin','primary',[item('past','Online 绩效','2026-10-01T20:00:00+08:00')]).counts.skipped,1);
 assert.throws(()=>syncCalendarSnapshot(hub,'admin','primary',[item(),item()]),/Duplicate/);
});
