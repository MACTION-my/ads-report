export {};
interface GoogleReply {ok:boolean;data?:unknown;error?:string;status?:number}
interface GoogleRunner {withSuccessHandler(callback:(reply:GoogleReply)=>void):GoogleRunner;withFailureHandler(callback:(error:{message:string})=>void):GoogleRunner;hubLogin(phone:string):void;hubStart(phone:string):void;hubLogout(token:string):void;hubCall(token:string,path:string,body:unknown):void}
declare global {interface Window {google?:{script?:{run:GoogleRunner}}}}
type Role='admin'|'pic'|'telesales'|'viewer';
interface Member {id:string;displayName:string;role:Role}
interface EventData {id:string;name:string;brand:string;eventDate:string;submissionDeadline:string;picUserId:string;assignedUserIds:string[];status:string;displayStatus:string;revision:number;reportVersion:number;venue:string;notes:string;archived:boolean;correctionReason?:string;submittedBy?:string;submittedAt?:string;legacySourceFileId?:string;legacySourceSection?:string;legacyPlaceholderDeadline?:string;rankingExcludedUserIds?:string[]}
interface Stats {userId:string;displayName?:string;notes?:string;newLeads:number;junk:number;pta:number;newLeadPta:number|null;attended:number;closedDeals:number;salesAmount:number;commission:number|null;dealIncentive:number|null;warnings?:string[];rates?:Record<string,number|null>}
interface Report {event:EventData;rows:Stats[];total:Omit<Stats,'userId'>;rates:Record<string,number|null>;submissions:{version:number;actor:string;createdAt:string}[];completeness:{pendingUserIds:string[];missingNewLeadPta:number;unapprovedCommission:number};attendanceSummary:{records:number;attended:number;unattributed:number}}
interface Preview {rows:Stats[];errors:{line:number;message:string}[];matches:string[];warnings:{userId:string;message:string}[]}
interface InboxItem {eventId:string;eventName:string;type:string;status:string}
interface InitialData {user:Member;users:Member[];reports:Report[];inbox:InboxItem[]}
const $=<T extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id) as T;
const fields=['newLeads','junk','pta','attended','closedDeals','salesAmount','commission','dealIncentive'] as const;
const labels:Record<string,string>={newLeads:'New Leads (from ads)',junk:'Junk (invalid / fake leads)',pta:'PTA (confirmed to attend)',newLeadPta:'New-lead PTA (optional)',attended:'Attended (actual turnout)',closedDeals:'Closed Deals',salesAmount:'Amount (RM)',commission:'Commission (manual, RM)',dealIncentive:'Approved Incentive (RM)'};
const rateLabels:Record<string,string>={leadToJunk:'Lead → Junk',leadToWon:'Lead → Won',ptaToWon:'PTA → Won',leadsToPta:'Lead → PTA',leadToAttended:'Lead → Attended',ptaToAttended:'PTA → Attended',attendedToWon:'Attended → Won'};
const stateLabels:Record<string,string>={draft:'Draft',scheduled:'Scheduled',awaiting_data:'Awaiting data',submitted:'Submitted · awaiting review',needs_correction:'Needs correction',finalized:'Final',overdue:'Overdue',cancelled:'Cancelled'};
let me:Member,users:Member[]=[],reports:Report[]=[],selected:Report|null=null,editing:EventData|null=null,importPreview:{csv:string;revision:number}|null=null;
const endpoint=document.querySelector<HTMLMetaElement>('meta[name="event-hub-endpoint"]')?.content||'';
// Translate legacy backend validation text without changing stored business data.
const backendMessages:Record<string,string>={
  'CSV 太大或格式无效':'CSV is too large or invalid','CSV 引号未闭合':'Unclosed CSV quote','CSV 没有数据行':'CSV has no data rows','CSV 表头必须与模板一致':'CSV headers must match the template','Email 格式无效':'Invalid email format','Junk 大于 New Leads':'Junk exceeds New Leads','attended 必须是 0（未出席）或 1（已出席）':'attended must be 0 (absent) or 1 (attended)','eventId 不匹配':'Event ID does not match','不接受写入数据':'This action does not accept data','仅 Admin 可操作':'Admin access required','仍有人员未填报':'Some team members have not submitted','佣金/奖励仍未核准，请退回补齐':'Commission or incentives are incomplete. Return for correction.','先完成部署配置':'Complete deployment setup first','先清理被移除人员数据':'Remove the affected member records first','出席大于 PTA':'Attended exceeds PTA','列数不一致':'Column count does not match','单格内容过长，未写入':'Cell content is too long; nothing was saved','只有已提交报表可确认':'Only submitted reports can be approved','只能填写本人':'You can only submit your own results','只能填写本人佣金；奖励由 Admin 核准':'You can only enter your own commission. Incentives require Admin approval.','只读成员不可指定填报':'Viewers cannot be assigned to submit results','同场同人重复':'Duplicate member in this event','名单明细仅 Admin / 本场 PIC 可见':'Attendance details are restricted to Admin and the event PIC','后台总表尚未配置':'Backend spreadsheet is not configured','后台表头不匹配 ':'Backend headers do not match: ','品牌无效':'Invalid brand','姓名必填且最多 200 字':'Name is required (maximum 200 characters)','尝试次数过多，请稍后再试':'Too many attempts. Please try again later.','引号位置不正确':'Incorrect CSV quote position','引号后有非法字符':'Invalid character after CSV quote','归属人员未分配本场':'The assigned owner is not part of this event','当前状态不可退回':'This report cannot be returned in its current status','成交大于出席，请确认后续成交归属':'Closed deals exceed attendance. Verify attribution of later sales.','成员未分配到活动':'Member is not assigned to this event','截止日期须含时区':'Deadline must include a time zone','手机号未登记或账号未启用':'Phone number is not registered or the account is inactive','手机号登录尚未开放':'Phone sign-in is not enabled','手机号登录未开放':'Phone sign-in is not enabled','手机号须为文字':'Phone number must be text','报表已锁定':'This report is locked','接口不存在':'Endpoint not found','数据版本已变，请刷新后重试':'This report has changed. Refresh and try again.','数据过大':'Data is too large','数据量超过当前单表版本限制':'Data exceeds the current sheet limit','数据量超过当前版本限制':'Data exceeds the current version limit','文件中 externalId 重复':'Duplicate externalId in the file','无效数据行':'Invalid data row','无本场编辑权限':'You do not have permission to edit this event','月份无效':'Invalid month','有销售额但没有成交数':'Revenue entered without any closed deals','服务处理失败，请管理员检查 Apps Script 执行记录':'Unable to process the request. Ask an Admin to check the Apps Script execution log.','未分配本场':'Not assigned to this event','未知后台页签':'Unknown backend sheet','未知状态操作':'Unknown status action','活动不存在':'Event not found','活动名必填':'Event name is required','活动日期无效':'Invalid event date','版本不存在':'Version not found','版本冲突':'Version conflict. Refresh and try again.','登录已过期，请重新登录':'Your session expired. Please sign in again.','缺少 eventId':'Missing eventId','缺少 telesales ID':'Missing telesales ID','缺少操作数据':'Missing action data','请先登录':'Please sign in first','请求无效':'Invalid request','请确认异常数据警告':'Review and acknowledge the data warnings','请确认异常警告':'Review and acknowledge the warnings','请输入有效马来西亚手机号码':'Enter a valid Malaysian phone number','请选择合并/替换':'Choose merge or replace','请选择团队成员':'Select team members','账号已停用':'Account is disabled','账号未启用':'Account is inactive','路径无效':'Invalid path','退回必须说明原因':'A correction reason is required','重复 event/person':'Duplicate event / person','锁定报表须先退回':'Return the locked report for correction first','需要本场唯一外部人员 ID（不是会议 ID）':'A unique attendee ID for this event is required (not the meeting ID)',
  '不可为空':'is required','格式错误':'has an invalid format','必须是非负有效数字':'must be a valid non-negative number','必须是整数':'must be a whole number','最多两位小数':'must have at most two decimal places'
};
function englishMessage(text:string){for(const [original,translated]of Object.entries(backendMessages).sort((a,b)=>b[0].length-a[0].length))text=text.replaceAll(original,translated);return text;}
const gasMode=Boolean(window.google?.script?.run||endpoint);
let sessionToken='';
function showLogin(){document.body.classList.add('is-login');sessionToken='';try{sessionStorage.removeItem('eventHubSession');}catch{}$('login').hidden=false;$('content').hidden=true;$('logout').hidden=true;$('identity').textContent='';$('detail').replaceChildren();selected=null;reports=[];}
function googleCall<T>(method:'hubLogin'|'hubStart'|'hubLogout'|'hubCall',args:unknown[]):Promise<T>{return new Promise((resolve,reject)=>{
  const receive=(reply:GoogleReply)=>{if(reply.ok)resolve(reply.data as T);else{if(reply.status===401||reply.status===403&&method==='hubCall')showLogin();reject(new Error(reply.error||'Request failed'));}};
  if(endpoint){
    if(!/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(endpoint)){reject(new Error('Invalid backend address'));return;}
    void fetch(endpoint,{method:'POST',credentials:'omit',redirect:'follow',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({method,args})}).then(async response=>{if(!response.ok)throw new Error('Backend connection failed');receive(await response.json() as GoogleReply);}).catch(()=>reject(new Error('Unable to connect. Please try again shortly.')));return;
  }
  const runner=window.google?.script?.run;if(!runner){reject(new Error('Google service is not connected'));return;}const call=runner.withSuccessHandler(receive).withFailureHandler(error=>reject(new Error(error.message||'Google service is unavailable')));if(method==='hubLogin')call.hubLogin(args[0] as string);else if(method==='hubStart')call.hubStart(args[0] as string);else if(method==='hubLogout')call.hubLogout(args[0] as string);else call.hubCall(args[0] as string,args[1] as string,args[2]);
});}
const money=(v:number|null|undefined)=>v===null||v===undefined?'Pending / N/A':v.toLocaleString('en-MY',{minimumFractionDigits:2,maximumFractionDigits:2});
const rate=(v:number|null|undefined)=>v===null||v===undefined?'N/A':v.toFixed(1)+'%';
const name=(id:string)=>users.find(u=>u.id===id)?.displayName||reports.flatMap(r=>r.rows).find(row=>row.userId===id)?.displayName||id;
const date=(iso:string)=>new Date(iso).toLocaleString('en-MY',{timeZone:'Asia/Kuala_Lumpur',hour12:false});
function el(tag:string,text='',className='') {const node=document.createElement(tag);node.textContent=text;if(className)node.className=className;return node;}
function message(text:string){$('message').textContent=englishMessage(text);}
async function api<T>(path:string,body?:unknown):Promise<T> {
  if(gasMode)return googleCall<T>('hubCall',[sessionToken,path,body===undefined?null:body]);
  const response=await fetch('/report/api/'+path,{method:body===undefined?'GET':'POST',credentials:'same-origin',headers:body===undefined?{}:{'Content-Type':'application/json','X-Event-Hub-Request':'1'},body:body===undefined?undefined:JSON.stringify(body)});
  const result=await response.json();if(!response.ok)throw new Error(result.error||'Request failed');return result;
}
function run(action:()=>Promise<void>){return async()=>{try{await action();}catch(error){message(error instanceof Error?error.message:String(error));}};}
function card(title:string,value:string){const node=el('div','','card');node.append(el('span',title),el('strong',value));return node;}
function button(text:string,action:()=>Promise<void>|void,className=''){const node=el('button',text,className) as HTMLButtonElement;node.type='button';node.onclick=run(async()=>{node.disabled=true;try{await action();}finally{node.disabled=false;}});return node;}
function filtered(){
  const month=$<HTMLInputElement>('month').value,brand=$<HTMLSelectElement>('brand').value,pic=$<HTMLSelectElement>('pic').value,state=$<HTMLSelectElement>('state').value,query=$<HTMLInputElement>('search').value.toLowerCase();
  return reports.filter(r=>!r.event.archived&&r.event.eventDate.startsWith(month)&&(!brand||r.event.brand===brand)&&(!pic||r.event.picUserId===pic)&&r.event.name.toLowerCase().includes(query)&&(!state||(state==='pending'?['draft','scheduled','awaiting_data','needs_correction','overdue'].includes(r.event.displayStatus):r.event.displayStatus===state)));
}
function aggregate(rows:Stats[]):{total:Stats;rates:Record<string,number|null>} {
  const total=Object.fromEntries(fields.map(key=>[key,rows.some(r=>r[key]==null)?null:rows.reduce((sum,r)=>sum+(r[key]||0),0)])) as unknown as Stats;
  const ratio=(a:number|null,b:number)=>a===null||!b?null:a/b*100;
  return {total,rates:{leadToJunk:ratio(total.junk,total.newLeads),leadToWon:ratio(total.closedDeals,total.newLeads),ptaToWon:ratio(total.closedDeals,total.pta),leadsToPta:ratio(total.pta,total.newLeads),leadToAttended:ratio(total.attended,total.newLeads),ptaToAttended:ratio(total.attended,total.pta),attendedToWon:ratio(total.closedDeals,total.attended)}};
}
function render(){
  const list=filtered(),active=list.filter(r=>r.event.status!=='cancelled'),rows=active.flatMap(r=>r.rows),{total,rates}=aggregate(rows);
  $('summary').replaceChildren(card('Revenue · RM',money(total.salesAmount)),card('Attended',String(total.attended)),card('Closed Deals',String(total.closedDeals)),card('Pending submissions',String(active.filter(r=>!['submitted','finalized'].includes(r.event.status)).length)),card('Scheduled events',String(active.length)),card('Submitted incl. finals',String(active.filter(r=>['submitted','finalized'].includes(r.event.status)).length)),card('Overdue submissions',String(active.filter(r=>r.event.displayStatus==='overdue').length)),card('Final reports',String(active.filter(r=>r.event.status==='finalized').length)));
  $('aggregate').replaceChildren(...Object.entries(rates).map(([key,value])=>card(rateLabels[key],rate(value))));
  const table=$('events');table.replaceChildren();
  for(const report of list.sort((a,b)=>a.event.eventDate.localeCompare(b.event.eventDate))){const e=report.event,tr=el('tr');
    const title=el('td');title.append(el('span',e.brand,'brand-label'),document.createTextNode(e.name));tr.append(title);
    tr.append(el('td',e.eventDate+' / '+name(e.picUserId)),el('td',isPlaceholder(e)?'Not set':date(e.submissionDeadline)));
    const statusCell=el('td');statusCell.append(el('span',(stateLabels[e.displayStatus]||e.displayStatus)+(e.status!=='finalized'?' · Not final':''),'status-badge status-'+e.displayStatus));tr.append(statusCell);
    for(const text of [String(report.total.attended),String(report.total.closedDeals),money(report.total.salesAmount)])tr.append(el('td',text));
    const cell=el('td');cell.append(button('Open',async()=>{await openReport(e.id);}));tr.append(cell);table.append(tr);
  }
  if(!list.length){const tr=el('tr'),td=el('td','','empty-cell') as HTMLTableCellElement;td.colSpan=8;const icon=el('span','▤','empty-icon');icon.setAttribute('aria-hidden','true');td.append(icon,el('strong','Your next event starts here'),el('small',reports.some(r=>!r.event.archived)?'Try a different month or filter.':'An admin can create an event to get the team started.'));tr.append(td);table.append(tr);}
  const rankingRows=active.flatMap(report=>report.rows.filter(row=>!report.event.rankingExcludedUserIds?.includes(row.userId)));
  const groups=new Map<string,Stats[]>();for(const row of rankingRows)groups.set(row.userId,[...(groups.get(row.userId)||[]),row]);
  const ranks=[...groups].map(([id,values])=>({id,...aggregate(values).total})).sort((a,b)=>b.salesAmount-a.salesAmount);
  $('ranking').replaceChildren(...ranks.map((item,i)=>{const node=el('div','','rankrow');node.append(el('span',`${i+1}. ${name(item.id)}`),el('span',`${item.closedDeals} deals · RM ${money(item.salesAmount)}`));return node;}));
  if(!ranks.length)$('ranking').append(el('p','Team results will appear after the first submission.','rank-empty'));
}
async function refresh(){reports=await api<Report[]>('events');render();}
function isPlaceholder(e:EventData){return Boolean(e.legacyPlaceholderDeadline&&e.legacyPlaceholderDeadline===e.submissionDeadline);}
function controls(e:EventData){return me.role==='admin'||me.id===e.picUserId;}
function editable(e:EventData){return controls(e)&&!e.archived&&['scheduled','draft','awaiting_data','needs_correction'].includes(e.status);}
async function openReport(id:string){selected=await api<Report>('events/'+id);importPreview=null;renderDetail();$('detail').scrollIntoView({behavior:'smooth'});}
function table(rows:Stats[],total:Report['total'],rates:Record<string,number|null>){
  const wrap=el('div','','scroll'),tbl=el('table'),head=el('tr');
  for(const label of ['Telesales',...fields.map(k=>labels[k]),...Object.values(rateLabels)])head.append(el('th',label));const thead=el('thead');thead.append(head);tbl.append(thead);const body=el('tbody');
  for(const row of [...rows,{...total,userId:'',displayName:'Total',rates}]){const tr=el('tr');tr.append(el('td',row.displayName||name(row.userId)));for(const key of fields)tr.append(el('td',row[key]==null?'N/A':key==='salesAmount'||key==='commission'||key==='dealIncentive'?money(row[key]):String(row[key])));const rowRates=row.rates||aggregate([row]).rates;for(const key of Object.keys(rateLabels))tr.append(el('td',rate(rowRates[key])));body.append(tr);}tbl.append(body);wrap.append(tbl);return wrap;
}
function renderDetail(){
  if(!selected)return;const r=selected,e=r.event,section=$('detail');section.hidden=false;section.replaceChildren();
  section.append(el('h2',e.brand+' · '+e.name),el('p',`${e.eventDate} · PIC ${name(e.picUserId)} · ${stateLabels[e.displayStatus]} · v${e.reportVersion} · Revision ${e.revision}`),el('p',`Deadline ${isPlaceholder(e)?'Not set':date(e.submissionDeadline)} · Submitted by ${e.submittedBy?name(e.submittedBy):'Not submitted'} · ${e.submittedAt?date(e.submittedAt):''}`));
  if(e.status!=='finalized')section.append(el('p','Draft / not final. Do not use for final settlement.','notice'));
  if(e.legacySourceSection)section.append(el('p','Historical snapshot imported from Drive. Source values are preserved and have not been newly approved. Empty template rows were skipped.','notice'));
  section.append(el('p',`Commission or incentive pending: ${r.completeness.unapprovedCommission} member(s).`));
  section.append(el('p','Awaiting submission: '+(r.completeness.pendingUserIds.map(name).join(', ')||'Everyone has submitted')));
  section.append(el('p',`Attendance records: ${r.attendanceSummary.records}; attended: ${r.attendanceSummary.attended}; unassigned: ${r.attendanceSummary.unattributed}. Attendance lists are reviewed separately and do not overwrite performance counts.`));
  if(r.attendanceSummary.records && r.attendanceSummary.attended!==r.total.attended)section.append(el('p','Attendance list and performance counts differ. PIC review required.','warning'));
  if(e.correctionReason)section.append(el('p','Correction reason: '+e.correctionReason,'warning'));
  if(isPlaceholder(e))section.append(el('p','Awaiting actual data. Zero totals are placeholders, not confirmed results. Use Edit event to assign a team and set a submission deadline.','notice'));
  section.append(table(r.rows,r.total,r.rates));if(e.notes)section.append(el('p','Event notes: '+e.notes));
  for(const row of r.rows){if(row.notes)section.append(el('p',name(row.userId)+': '+row.notes));for(const warning of row.warnings||[])section.append(el('p',name(row.userId)+': '+englishMessage(warning),'warning'));}
  const actions=el('div','','toolbar no-print');actions.append(button('Print / Save PDF',()=>window.print()),button('Export event CSV',()=>download(`events/${e.id}/export`,e.name+'.csv')));
  for(const version of r.submissions)actions.append(button('View version '+version.version,async()=>{const snapshot=await api<{event:EventData;rows:Stats[];total:Report['total'];rates:Record<string,number|null>}>(`events/${e.id}/history?version=${version.version}`);const box=el('div');box.append(el('h3',`Submitted version ${version.version} · ${name(version.actor)} · ${date(version.createdAt)}`),table(snapshot.rows,snapshot.total,snapshot.rates));section.append(box);}));
  if(me.role==='admin'){
    if(editable(e))actions.append(button('Edit event',()=>showEvent(e)),button('Cancel event',async()=>{if(confirm('Cancel this event? History will be retained.'))await transition('cancel');}));
    actions.append(button('Duplicate event',()=>showEvent(e,true)),button('Archive',async()=>{if(confirm('Archive this event? It will be hidden from totals, but records will be retained.'))await transition('archive');}));
    if(['submitted','finalized'].includes(e.status))actions.append(button('Return for correction',async()=>{const reason=prompt('Enter the reason for correction');if(reason?.trim())await transition('return',{reason});}));
    if(e.status==='submitted')actions.append(button('Approve final report',async()=>{if(confirm('Confirm that results, commission and incentives have been reviewed?'))await transition('finalize');}));
  }
  if(controls(e)&&e.legacySourceFileId&&/^[A-Za-z0-9_-]+$/.test(e.legacySourceFileId)){const source=el('a','Open original Drive report','source-report-link') as HTMLAnchorElement;source.href='https://docs.google.com/spreadsheets/d/'+e.legacySourceFileId+'/edit';source.target='_blank';source.rel='noopener';actions.append(source);}
  section.append(actions);
  if(controls(e))renderAttendance(section,r);
  if(editable(e)&&e.assignedUserIds.length)renderInputs(section,r);
  else if(!e.archived&&['scheduled','draft','awaiting_data','needs_correction'].includes(e.status)&&e.assignedUserIds.includes(me.id)&&['telesales','pic'].includes(me.role))renderInputs(section,r,true);
  if(me.role==='admin'&&editable(e))renderImport(section,r);
}
function renderAttendance(section:HTMLElement,r:Report){
  const box=el('div','','no-print person');box.append(el('h3','Attendance list · Admin / event PIC only'),el('p','Deduplicated by external attendee ID within this event. Set attended=1 for actual attendance or 0 for absence. Registration is not proof of attendance. Imports do not change performance ownership.'));
  box.append(el('p','Upload here: download the attendance template, paste the actual attendee records, save as CSV, then preview and save. Only assign a team member when you know who owns that attendee. Leave unknown ownership blank.'));
  if(!editable(r.event))box.append(el('p','Uploads are available while the report is editable. Ask an Admin to return a submitted report for correction before changing its attendance list.','hint'));
  const output=el('pre');box.append(button('View restricted attendance',async()=>{output.textContent=JSON.stringify(await api(`events/${r.event.id}/attendance`),null,2);}));
  if(editable(r.event)){
    const file=el('input') as HTMLInputElement;file.type='file';file.accept='.csv';file.setAttribute('aria-label','Choose attendance CSV');
    const mode=el('select') as HTMLSelectElement;mode.setAttribute('aria-label','Attendance import mode');for(const [value,text] of [['','Choose import mode'],['merge','Merge / update matching IDs'],['replace','Replace entire attendance list']]){const option=el('option',text) as HTMLOptionElement;option.value=value;mode.append(option);}
    let ready:{csv:string;revision:number}|null=null;
    const commit=button('Save attendance list',async()=>{if(!ready)return;if(!confirm('Confirm '+(mode.value==='replace'?'Replace entire attendance list':'merge attendance records')+'?'))return;selected=await api<Report>(`events/${r.event.id}/attendance-import`,{...ready,mode:mode.value});await refresh();renderDetail();message('Attendance saved and deduplicated. Performance counts were not changed.');});commit.disabled=true;
    file.onchange=()=>{ready=null;commit.disabled=true;output.textContent='';};mode.onchange=()=>{commit.disabled=!ready||!mode.value;};
    box.append(button('Download attendance template',()=>download('attendance-template','attendance-template.csv')),file,button('Preview attendance',async()=>{const source=file.files?.[0];if(!source)throw new Error('Choose a CSV file');if(source.size>2_000_000)throw new Error('File is too large');const csv=await source.text(),preview=await api<{errors:unknown[]}>(`events/${r.event.id}/attendance-preview`,{csv,revision:r.event.revision});output.textContent=JSON.stringify(preview,(key,value)=>key==='message'&&typeof value==='string'?englishMessage(value):value,2);ready=preview.errors.length?null:{csv,revision:r.event.revision};commit.disabled=!ready||!mode.value;}),mode,commit);
  }
  box.append(output);section.append(box);
}
function renderInputs(section:HTMLElement,r:Report,own=false){
  const form=el('form','','no-print') as HTMLFormElement;form.append(el('h3',own?'My event results · edit your own record':'PIC / Admin entry · figures attributed to this event'));
  const inputs=new Map<string,Record<string,HTMLInputElement|HTMLTextAreaElement>>();
  for(const id of own?[me.id]:r.event.assignedUserIds){
    const old=r.rows.find(row=>row.userId===id),person=el('div','','person'),grid=el('div','','input-sections');person.append(el('h3',name(id)));const rowInputs:Record<string,HTMLInputElement|HTMLTextAreaElement>={};
    const groups=[{title:'01 · Leads & confirmations',keys:['newLeads','junk','pta']},{title:'02 · Attendance & sales',keys:['attended','closedDeals','salesAmount']},{title:'03 · Commission & incentives',keys:['commission','dealIncentive']}] as const;
    for(const group of groups){const fieldset=el('fieldset','','input-group'),inner=el('div','','inputs');fieldset.append(el('legend',group.title));for(const key of group.keys){const label=el('label',labels[key]),input=el('input') as HTMLInputElement;input.type='number';input.min='0';input.step=['salesAmount','commission','dealIncentive'].includes(key)?'.01':'1';input.value=old?.[key]===null?'':String(old?.[key]??(['newLeadPta','commission','dealIncentive'].includes(key)?'':0));input.required=!['newLeadPta','commission','dealIncentive'].includes(key);if(me.role!=='admin'&&(key==='dealIncentive'||key==='commission'&&id!==me.id))input.readOnly=true;rowInputs[key]=input;label.append(input);inner.append(label);}fieldset.append(inner);grid.append(fieldset);}
    const notesLabel=el('label','Exceptions / notes'),notes=el('textarea') as HTMLTextAreaElement;notes.value=old?.notes||'';notes.maxLength=4000;rowInputs.notes=notes;notesLabel.append(notes);person.append(grid,notesLabel);form.append(person);inputs.set(id,rowInputs);
  }
  const save=el('button',own?'Submit my results':'Save draft') as HTMLButtonElement;save.type='submit';const submit=button('Submit & lock',async()=>{if(!form.reportValidity())return;if(!confirm('Save these entries, then submit and lock the report? Confirm ownership of any unusual figures first.'))return;await saveData();await transition('submit',{acknowledgeWarnings:true});});
  const saveData=async()=>{const rows=[...inputs].map(([userId,values])=>Object.fromEntries([['userId',userId],['newLeadPta',r.rows.find(row=>row.userId===userId)?.newLeadPta??null],...Object.entries(values).map(([key,input])=>[key,key==='notes'?input.value:input.value===''?null:Number(input.value)])]));selected=await api<Report>('events/'+r.event.id+(own?'/own-row':'/rows'),own?{revision:selected!.event.revision,row:rows[0],acknowledgeWarnings:true}:{revision:selected!.event.revision,rows});};
  form.onsubmit=event=>{event.preventDefault();if(own&&!confirm('Confirm your figures and ownership of any exceptions, then submit?'))return;void run(async()=>{save.disabled=true;try{await saveData();await refresh();renderDetail();message(own?'Your results have been submitted and included in the totals.':'Draft saved.');}finally{save.disabled=false;}})();};
  form.append(save);if(!own)form.append(document.createTextNode(' '),submit);section.append(form);
}
function renderImport(section:HTMLElement,r:Report){
  const box=el('div','','no-print person');box.append(el('h3','CSV import · Admin'),el('p',`Event ID: ${r.event.id}. Use user IDs and preview before importing. Spreadsheet percentage formulas are ignored.`));
  const input=el('input') as HTMLInputElement;input.type='file';input.accept='.csv,text/csv';input.setAttribute('aria-label','Choose performance CSV');const result=el('pre');
  input.onchange=()=>{importPreview=null;result.textContent='';};
  const commit=button('Confirm import',async()=>{if(!importPreview)return;if(!confirm(mode.value==='replace'?'Replace all event rows? Rows missing from this CSV will be removed.':'Merge and replace matching team member rows?'))return;selected=await api<Report>(`events/${r.event.id}/import`,{...importPreview,mode:mode.value});importPreview=null;await refresh();renderDetail();message('CSV imported and audit history recorded.');});commit.disabled=true;
  const mode=el('select') as HTMLSelectElement;mode.setAttribute('aria-label','Import mode');for(const [value,text] of [['','Choose merge or replace'],['merge','Merge (update matching rows)'],['replace','Replace all event rows']]){const option=el('option',text) as HTMLOptionElement;option.value=value;mode.append(option);}
  mode.onchange=()=>{commit.disabled=!importPreview||!mode.value;};
  box.append(button('Download CSV template',()=>download('template','event-performance-template.csv')),input,button('Preview & validate',async()=>{const file=input.files?.[0];if(!file)throw new Error('Choose a file first');if(file.size>2_000_000)throw new Error('CSV must be 2 MB or smaller');const csv=await file.text();const preview=await api<Preview>(`events/${r.event.id}/preview`,{revision:r.event.revision,csv});result.textContent=JSON.stringify(preview,(key,value)=>key==='message'&&typeof value==='string'?englishMessage(value):value,2);importPreview=preview.errors.length?null:{csv,revision:r.event.revision};commit.disabled=!importPreview||!mode.value;}),result,mode,commit);section.append(box);
}
async function transition(action:string,extra:object={}){if(!selected)return;selected=await api<Report>(`events/${selected.event.id}/transition`,{revision:selected.event.revision,action,...extra});await refresh();renderDetail();message('Status updated.');}
async function download(path:string,fileName:string){let blob:Blob;if(gasMode)blob=new Blob([await api<string>(path)],{type:'text/csv;charset=utf-8'});else{const response=await fetch('/report/api/'+path,{credentials:'same-origin'});if(!response.ok){const error=await response.json();throw new Error(error.error);}blob=await response.blob();}const url=URL.createObjectURL(blob),link=el('a') as HTMLAnchorElement;link.href=url;link.download=fileName;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function showEvent(event:EventData|null=null,duplicate=false){
  editing=duplicate?null:event;const form=$<HTMLFormElement>('eventForm');form.reset();$('formTitle').textContent=duplicate?'Duplicate event · set a new date':event?'Edit event':'New event';
  const control=(key:string)=>form.elements.namedItem(key) as HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement;
  const select=control('picUserId') as HTMLSelectElement;select.replaceChildren(...users.map(user=>{const option=el('option',user.displayName) as HTMLOptionElement;option.value=user.id;return option;}));
  if(event){for(const key of ['name','brand','venue','notes','picUserId'] as const)control(key).value=event[key];if(!duplicate){control('eventDate').value=event.eventDate;control('deadline').value=isPlaceholder(event)?'':new Date(Date.parse(event.submissionDeadline)+8*3600_000).toISOString().slice(0,16);}else control('name').value=event.name+' (new event)';}
  $('members').replaceChildren(...users.map(user=>{const label=el('label',user.displayName,'member'),checkbox=el('input') as HTMLInputElement;checkbox.type='checkbox';checkbox.name='assigned';checkbox.value=user.id;checkbox.checked=event?.assignedUserIds.includes(user.id)||false;label.prepend(checkbox);return label;}));
  $<HTMLDialogElement>('eventDialog').showModal();
}
$<HTMLFormElement>('eventForm').onsubmit=event=>{event.preventDefault();void run(async()=>{const form=new FormData($<HTMLFormElement>('eventForm'));const body={name:form.get('name'),brand:form.get('brand'),eventDate:form.get('eventDate'),submissionDeadline:form.get('deadline')+':00+08:00',picUserId:form.get('picUserId'),assignedUserIds:form.getAll('assigned'),venue:form.get('venue'),notes:form.get('notes'),revision:editing?.revision};const report=await api<Report>('events'+(editing?'/'+editing.id:''),body);$<HTMLDialogElement>('eventDialog').close();await refresh();await openReport(report.event.id);message('Event saved.');})();};
$('closeDialog').onclick=()=>$<HTMLDialogElement>('eventDialog').close();
$('create').onclick=()=>showEvent();$('refresh').onclick=run(refresh);
for(const id of ['month','brand','pic','state','search'])$(id).addEventListener('input',render);
$('monthly').onclick=run(()=>download('export?month='+$<HTMLInputElement>('month').value,'final-events-'+$<HTMLInputElement>('month').value+'.csv'));
function updateNavigation(){for(const link of document.querySelectorAll<HTMLAnchorElement>('.nav-link')){const active=link.hash===(location.hash||'#overview');link.classList.toggle('is-active',active);if(active)link.setAttribute('aria-current','location');else link.removeAttribute('aria-current');}}
window.addEventListener('hashchange',updateNavigation);updateNavigation();
async function initialize(initial?:InitialData){
  $<HTMLInputElement>('month').value=new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Kuala_Lumpur'}).slice(0,7);
  let result=initial;
  if(!result){if(gasMode)result=await api<InitialData>('bootstrap');else{const [identity,loadedReports,inbox]=await Promise.all([api<{user:Member;users:Member[]}>('me'),api<Report[]>('events'),api<InboxItem[]>('inbox')]);result={...identity,reports:loadedReports,inbox};}}
  me=result.user;users=result.users;$('identity').textContent=me.displayName+' · '+({admin:'Admin',pic:'Person in charge',telesales:'Team member',viewer:'Viewer'}[me.role]);$('create').hidden=me.role!=='admin';
  const allPic=el('option','All PICs') as HTMLOptionElement;allPic.value='';$('pic').replaceChildren(allPic);for(const old of $('content').querySelectorAll('[data-inbox]'))old.remove();
  for(const user of users){const option=el('option',user.displayName) as HTMLOptionElement;option.value=user.id;$('pic').append(option);}
  reports=result.reports;render();$('content').hidden=false;message('');
  const pending=result.inbox.filter(item=>!['submitted','finalized','cancelled'].includes(item.status));
  if(pending.length){const box=el('section','','notice no-print');box.dataset.inbox='true';box.append(el('h2','My submission reminders'));for(const item of pending)box.append(button(item.eventName+' · '+item.type,async()=>{await openReport(item.eventId);}));$('content').prepend(box);}
  $('login').hidden=true;$('logout').hidden=!gasMode;document.body.classList.remove('is-login');
}
$<HTMLFormElement>('phoneLogin').onsubmit=event=>{event.preventDefault();void run(async()=>{const form=$<HTMLFormElement>('phoneLogin'),submit=form.querySelector('button') as HTMLButtonElement;submit.disabled=true;submit.setAttribute('aria-busy','true');message('Signing in and loading your workspace…');try{const result=await googleCall<{token:string;initial:InitialData}>('hubStart',[String(new FormData(form).get('phone')||'')]);sessionToken=result.token;try{sessionStorage.setItem('eventHubSession',sessionToken);}catch{}form.reset();await initialize(result.initial);}finally{submit.disabled=false;submit.removeAttribute('aria-busy');}})();};
$('logout').onclick=run(async()=>{try{await googleCall('hubLogout',[sessionToken]);}finally{showLogin();message('You have signed out.');}});
if(gasMode){try{sessionToken=sessionStorage.getItem('eventHubSession')||'';}catch{}if(sessionToken)void run(initialize)();else{showLogin();message('');}}
else void run(initialize)();
