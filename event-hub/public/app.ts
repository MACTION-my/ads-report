export {};
type Role='admin'|'pic'|'telesales'|'viewer';
interface Member {id:string;displayName:string;role:Role}
interface EventData {id:string;name:string;brand:string;eventDate:string;submissionDeadline:string;picUserId:string;assignedUserIds:string[];status:string;displayStatus:string;revision:number;reportVersion:number;venue:string;notes:string;archived:boolean;correctionReason?:string;submittedBy?:string;submittedAt?:string}
interface Stats {userId:string;displayName?:string;notes?:string;newLeads:number;junk:number;pta:number;newLeadPta:number|null;attended:number;closedDeals:number;salesAmount:number;commission:number|null;dealIncentive:number|null;warnings?:string[];rates?:Record<string,number|null>}
interface Report {event:EventData;rows:Stats[];total:Omit<Stats,'userId'>;rates:Record<string,number|null>;submissions:{version:number;actor:string;createdAt:string}[];completeness:{pendingUserIds:string[];missingNewLeadPta:number;unapprovedCommission:number};attendanceSummary:{records:number;attended:number;unattributed:number}}
interface Preview {rows:Stats[];errors:{line:number;message:string}[];matches:string[];warnings:{userId:string;message:string}[]}
const $=<T extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id) as T;
const fields=['newLeads','junk','pta','newLeadPta','attended','closedDeals','salesAmount','commission','dealIncentive'] as const;
const labels:Record<string,string>={newLeads:'New Leads',junk:'Junk',pta:'PTA（旧＋新）',newLeadPta:'新线索 PTA（未知留空）',attended:'出席',closedDeals:'成交',salesAmount:'销售额 RM',commission:'核准佣金 RM',dealIncentive:'核准奖励 RM'};
const rateLabels:Record<string,string>={leadToJunk:'Lead → Junk',leadToWon:'Lead → Won',ptaToWon:'PTA → Won',leadsToPta:'New Lead → PTA',ptaToAttended:'PTA → 出席',attendedToWon:'出席 → Won'};
const stateLabels:Record<string,string>={draft:'草稿',scheduled:'已排期',awaiting_data:'待填报',submitted:'已提交 · 待审核',needs_correction:'待更正',finalized:'最终版',overdue:'逾期',cancelled:'已取消'};
let me:Member,users:Member[]=[],reports:Report[]=[],selected:Report|null=null,editing:EventData|null=null,importPreview:{csv:string;revision:number}|null=null;
const money=(v:number|null|undefined)=>v===null||v===undefined?'待核准 / N/A':v.toLocaleString('en-MY',{minimumFractionDigits:2,maximumFractionDigits:2});
const rate=(v:number|null|undefined)=>v===null||v===undefined?'N/A':v.toFixed(1)+'%';
const name=(id:string)=>users.find(u=>u.id===id)?.displayName||id;
const date=(iso:string)=>new Date(iso).toLocaleString('zh-CN',{timeZone:'Asia/Kuala_Lumpur',hour12:false});
function el(tag:string,text='',className='') {const node=document.createElement(tag);node.textContent=text;if(className)node.className=className;return node;}
function message(text:string){$('message').textContent=text;}
async function api<T>(path:string,body?:unknown):Promise<T> {
  const response=await fetch('/report/api/'+path,{method:body===undefined?'GET':'POST',credentials:'same-origin',headers:body===undefined?{}:{'Content-Type':'application/json','X-Event-Hub-Request':'1'},body:body===undefined?undefined:JSON.stringify(body)});
  const result=await response.json();if(!response.ok)throw new Error(result.error||'请求失败');return result;
}
function run(action:()=>Promise<void>){return async()=>{try{await action();}catch(error){message(error instanceof Error?error.message:String(error));}};}
function card(title:string,value:string){const node=el('div','','card');node.append(el('span',title),el('strong',value));return node;}
function button(text:string,action:()=>Promise<void>|void,className=''){const node=el('button',text,className) as HTMLButtonElement;node.type='button';node.onclick=run(async()=>{node.disabled=true;try{await action();}finally{node.disabled=false;}});return node;}
function filtered(){
  const month=$<HTMLInputElement>('month').value,brand=$<HTMLSelectElement>('brand').value,pic=$<HTMLSelectElement>('pic').value,state=$<HTMLSelectElement>('state').value,query=$<HTMLInputElement>('search').value.toLowerCase();
  return reports.filter(r=>!r.event.archived&&r.event.eventDate.startsWith(month)&&(!brand||r.event.brand===brand)&&(!pic||r.event.picUserId===pic)&&r.event.name.toLowerCase().includes(query)&&(!state||(state==='pending'?['draft','scheduled','awaiting_data','needs_correction','overdue'].includes(r.event.displayStatus):r.event.displayStatus===state)));
}
function aggregate(rows:Stats[]):{total:Stats;rates:Record<string,number|null>} {
  const total=Object.fromEntries(fields.map(key=>[key,rows.some(r=>r[key]===null)?null:rows.reduce((sum,r)=>sum+(r[key]||0),0)])) as unknown as Stats;
  const ratio=(a:number|null,b:number)=>a===null||!b?null:a/b*100;
  return {total,rates:{leadToJunk:ratio(total.junk,total.newLeads),leadToWon:ratio(total.closedDeals,total.newLeads),ptaToWon:ratio(total.closedDeals,total.pta),leadsToPta:ratio(total.newLeadPta,total.newLeads),ptaToAttended:ratio(total.attended,total.pta),attendedToWon:ratio(total.closedDeals,total.attended)}};
}
function render(){
  const list=filtered(),active=list.filter(r=>r.event.status!=='cancelled'),rows=active.flatMap(r=>r.rows),{total,rates}=aggregate(rows);
  $('summary').replaceChildren(card('已排期 / 当前筛选',String(active.length)),card('已提交（含最终版）',String(active.filter(r=>['submitted','finalized'].includes(r.event.status)).length)),card('待提交',String(active.filter(r=>!['submitted','finalized'].includes(r.event.status)).length)),card('逾期',String(active.filter(r=>r.event.displayStatus==='overdue').length)),card('出席',String(total.attended)),card('成交',String(total.closedDeals)),card('销售额 RM',money(total.salesAmount)),card('最终版',String(active.filter(r=>r.event.status==='finalized').length)));
  $('aggregate').replaceChildren(...Object.entries(rates).map(([key,value])=>card(rateLabels[key],rate(value))));
  const table=$('events');table.replaceChildren();
  for(const report of list.sort((a,b)=>a.event.eventDate.localeCompare(b.event.eventDate))){const e=report.event,tr=el('tr');
    for(const text of [e.brand+' · '+e.name,e.eventDate+' / '+name(e.picUserId),date(e.submissionDeadline),(stateLabels[e.displayStatus]||e.displayStatus)+(e.status!=='finalized'?'（非最终）':''),String(report.total.attended),String(report.total.closedDeals),money(report.total.salesAmount)])tr.append(el('td',text));
    const cell=el('td');cell.append(button('打开',async()=>{await openReport(e.id);}));tr.append(cell);table.append(tr);
  }
  if(!list.length){const tr=el('tr'),td=el('td','暂无活动。由 Admin 新建场次后，PIC 从这里填报。') as HTMLTableCellElement;td.colSpan=8;tr.append(td);table.append(tr);}
  const groups=new Map<string,Stats[]>();for(const row of rows)groups.set(row.userId,[...(groups.get(row.userId)||[]),row]);
  const ranks=[...groups].map(([id,values])=>({id,...aggregate(values).total})).sort((a,b)=>b.salesAmount-a.salesAmount);
  $('ranking').replaceChildren(...ranks.map((item,i)=>{const node=el('div','','rankrow');node.append(el('span',`${i+1}. ${name(item.id)}`),el('span',`${item.closedDeals} 单 · RM ${money(item.salesAmount)}`));return node;}));
}
async function refresh(){reports=await api<Report[]>('events');render();}
function controls(e:EventData){return me.role==='admin'||me.id===e.picUserId;}
function editable(e:EventData){return controls(e)&&!e.archived&&['scheduled','draft','awaiting_data','needs_correction'].includes(e.status);}
async function openReport(id:string){selected=await api<Report>('events/'+id);importPreview=null;renderDetail();$('detail').scrollIntoView({behavior:'smooth'});}
function table(rows:Stats[],total:Report['total'],rates:Record<string,number|null>){
  const wrap=el('div','','scroll'),tbl=el('table'),head=el('tr');
  for(const label of ['Telesales',...fields.map(k=>labels[k]),...Object.values(rateLabels)])head.append(el('th',label));const thead=el('thead');thead.append(head);tbl.append(thead);const body=el('tbody');
  for(const row of [...rows,{...total,userId:'',displayName:'合计',rates}]){const tr=el('tr');tr.append(el('td',row.displayName||name(row.userId)));for(const key of fields)tr.append(el('td',row[key]===null?'N/A':key==='salesAmount'||key==='commission'||key==='dealIncentive'?money(row[key]):String(row[key])));const rowRates=row.rates||aggregate([row]).rates;for(const key of Object.keys(rateLabels))tr.append(el('td',rate(rowRates[key])));body.append(tr);}tbl.append(body);wrap.append(tbl);return wrap;
}
function renderDetail(){
  if(!selected)return;const r=selected,e=r.event,section=$('detail');section.hidden=false;section.replaceChildren();
  section.append(el('h2',e.brand+' · '+e.name),el('p',`${e.eventDate} · PIC ${name(e.picUserId)} · ${stateLabels[e.displayStatus]} · v${e.reportVersion} · 数据修订 ${e.revision}`),el('p',`截止 ${date(e.submissionDeadline)} · 提交人 ${e.submittedBy?name(e.submittedBy):'尚未提交'} · ${e.submittedAt?date(e.submittedAt):''}`));
  if(e.status!=='finalized')section.append(el('p','草稿 / 未最终确认，不作为最终结算依据。','notice'));
  section.append(el('p',`缺少新线索 PTA：${r.completeness.missingNewLeadPta} 人；待核准佣金/奖励：${r.completeness.unapprovedCommission} 人。`));
  section.append(el('p','尚未填报：'+(r.completeness.pendingUserIds.map(name).join('、')||'全部已填报')));
  section.append(el('p',`名单记录 ${r.attendanceSummary.records}；确认出席 ${r.attendanceSummary.attended}；未归属 ${r.attendanceSummary.unattributed}。名单与绩效填报分开核对，不自动覆盖人数。`));
  if(r.attendanceSummary.records && r.attendanceSummary.attended!==r.total.attended)section.append(el('p','名单出席人数与绩效填报不一致，请 PIC 核对。','warning'));
  if(e.correctionReason)section.append(el('p','退回原因：'+e.correctionReason,'warning'));
  section.append(table(r.rows,r.total,r.rates));if(e.notes)section.append(el('p','活动备注：'+e.notes));
  for(const row of r.rows){if(row.notes)section.append(el('p',name(row.userId)+'：'+row.notes));for(const warning of row.warnings||[])section.append(el('p',name(row.userId)+'：'+warning,'warning'));}
  const actions=el('div','','toolbar no-print');actions.append(button('打印 / 保存 PDF',()=>window.print()),button('导出本场 CSV',()=>download(`events/${e.id}/export`,e.name+'.csv')));
  for(const version of r.submissions)actions.append(button('查看提交版本 '+version.version,async()=>{const snapshot=await api<{event:EventData;rows:Stats[];total:Report['total'];rates:Record<string,number|null>}>(`events/${e.id}/history?version=${version.version}`);const box=el('div');box.append(el('h3',`提交版本 ${version.version} · ${name(version.actor)} · ${date(version.createdAt)}`),table(snapshot.rows,snapshot.total,snapshot.rates));section.append(box);}));
  if(me.role==='admin'){
    if(editable(e))actions.append(button('编辑活动',()=>showEvent(e)),button('取消活动',async()=>{if(confirm('确认取消活动？历史记录会保留。'))await transition('cancel');}));
    actions.append(button('复制为新场次',()=>showEvent(e,true)),button('归档',async()=>{if(confirm('确认归档？汇总默认隐藏该活动，记录仍保留。'))await transition('archive');}));
    if(['submitted','finalized'].includes(e.status))actions.append(button('退回更正',async()=>{const reason=prompt('请输入退回原因');if(reason?.trim())await transition('return',{reason});}));
    if(e.status==='submitted')actions.append(button('确认最终版',async()=>{if(confirm('确认数字、佣金和奖励已审核？'))await transition('finalize');}));
  }
  section.append(actions);
  if(controls(e))renderAttendance(section,r);
  if(editable(e))renderInputs(section,r);
  else if(!e.archived&&['scheduled','draft','awaiting_data','needs_correction'].includes(e.status)&&e.assignedUserIds.includes(me.id)&&['telesales','pic'].includes(me.role))renderInputs(section,r,true);
  if(me.role==='admin'&&editable(e))renderImport(section,r);
}
function renderAttendance(section:HTMLElement,r:Report){
  const box=el('div','','no-print person');box.append(el('h3','出席名单 · 仅 Admin / 本场 PIC'),el('p','使用本场唯一外部人员 ID 去重。attended=1 表示确认出席，0 表示未出席；注册名单不能直接当出席名单。名单不会自动改变绩效归属。'));
  const output=el('pre');box.append(button('查看受限名单',async()=>{output.textContent=JSON.stringify(await api(`events/${r.event.id}/attendance`),null,2);}));
  if(editable(r.event)){
    const file=el('input') as HTMLInputElement;file.type='file';file.accept='.csv';file.setAttribute('aria-label','选择出席名单 CSV');
    const mode=el('select') as HTMLSelectElement;mode.setAttribute('aria-label','名单导入模式');for(const [value,text] of [['','选择处理方式'],['merge','合并 / 更新匹配 ID'],['replace','替换整场名单']]){const option=el('option',text) as HTMLOptionElement;option.value=value;mode.append(option);}
    let ready:{csv:string;revision:number}|null=null;
    const commit=button('确认保存名单',async()=>{if(!ready)return;if(!confirm('确认'+(mode.value==='replace'?'替换整场名单':'合并名单')+'？'))return;selected=await api<Report>(`events/${r.event.id}/attendance-import`,{...ready,mode:mode.value});await refresh();renderDetail();message('名单已保存并去重；绩效数字未自动改写。');});commit.disabled=true;
    file.onchange=()=>{ready=null;commit.disabled=true;output.textContent='';};mode.onchange=()=>{commit.disabled=!ready||!mode.value;};
    box.append(button('下载名单模板',()=>download('attendance-template','attendance-template.csv')),file,button('预览名单',async()=>{const source=file.files?.[0];if(!source)throw new Error('请选择 CSV');if(source.size>2_000_000)throw new Error('文件过大');const csv=await source.text(),preview=await api<{errors:unknown[]}>(`events/${r.event.id}/attendance-preview`,{csv,revision:r.event.revision});output.textContent=JSON.stringify(preview,null,2);ready=preview.errors.length?null:{csv,revision:r.event.revision};commit.disabled=!ready||!mode.value;}),mode,commit);
  }
  box.append(output);section.append(box);
}
function renderInputs(section:HTMLElement,r:Report,own=false){
  const form=el('form','','no-print') as HTMLFormElement;form.append(el('h3',own?'填写我的活动数据 · 仅修改本人记录':'PIC / Admin 汇总与补录 · 所有数字均为本场归属'));
  const inputs=new Map<string,Record<string,HTMLInputElement|HTMLTextAreaElement>>();
  for(const id of own?[me.id]:r.event.assignedUserIds){
    const old=r.rows.find(row=>row.userId===id),person=el('div','','person'),grid=el('div','','inputs');person.append(el('h3',name(id)));const rowInputs:Record<string,HTMLInputElement|HTMLTextAreaElement>={};
    for(const key of fields){const label=el('label',labels[key]),input=el('input') as HTMLInputElement;input.type='number';input.min='0';input.step=['salesAmount','commission','dealIncentive'].includes(key)?'.01':'1';input.value=old?.[key]===null?'':String(old?.[key]??(['newLeadPta','commission','dealIncentive'].includes(key)?'':0));input.required=!['newLeadPta','commission','dealIncentive'].includes(key);if(['commission','dealIncentive'].includes(key)&&me.role!=='admin')input.readOnly=true;rowInputs[key]=input;label.append(input);grid.append(label);}
    const notesLabel=el('label','异常说明 / 备注'),notes=el('textarea') as HTMLTextAreaElement;notes.value=old?.notes||'';notes.maxLength=4000;rowInputs.notes=notes;notesLabel.append(notes);person.append(grid,notesLabel);form.append(person);inputs.set(id,rowInputs);
  }
  const save=el('button',own?'提交我的数据':'保存草稿') as HTMLButtonElement;save.type='submit';const submit=button('提交并锁定',async()=>{if(!form.reportValidity())return;if(!confirm('先保存当前输入，再提交并锁定。若有异常数字，是否已确认归属？'))return;await saveData();await transition('submit',{acknowledgeWarnings:true});});
  const saveData=async()=>{const rows=[...inputs].map(([userId,values])=>Object.fromEntries([['userId',userId],...Object.entries(values).map(([key,input])=>[key,key==='notes'?input.value:input.value===''?null:Number(input.value)])]));selected=await api<Report>('events/'+r.event.id+(own?'/own-row':'/rows'),own?{revision:selected!.event.revision,row:rows[0],acknowledgeWarnings:true}:{revision:selected!.event.revision,rows});};
  form.onsubmit=event=>{event.preventDefault();if(own&&!confirm('确认本人数字及异常归属无误并提交？'))return;void run(async()=>{save.disabled=true;try{await saveData();await refresh();renderDetail();message(own?'本人数据已提交，系统已自动汇总。':'草稿已保存到数据库。');}finally{save.disabled=false;}})();};
  form.append(save);if(!own)form.append(document.createTextNode(' '),submit);section.append(form);
}
function renderImport(section:HTMLElement,r:Report){
  const box=el('div','','no-print person');box.append(el('h3','CSV 导入 · Admin'),el('p',`当前 eventId：${r.event.id}。使用用户 ID，导入前请预览；不会信任电子表格百分比公式。`));
  const input=el('input') as HTMLInputElement;input.type='file';input.accept='.csv,text/csv';input.setAttribute('aria-label','选择绩效 CSV');const result=el('pre');
  input.onchange=()=>{importPreview=null;result.textContent='';};
  const commit=button('确认导入',async()=>{if(!importPreview)return;if(!confirm(mode.value==='replace'?'替换会移除本场未出现在 CSV 的数据行，是否继续？':'合并会替换匹配人员行，是否继续？'))return;selected=await api<Report>(`events/${r.event.id}/import`,{...importPreview,mode:mode.value});importPreview=null;await refresh();renderDetail();message('CSV 已导入并记录审计。');});commit.disabled=true;
  const mode=el('select') as HTMLSelectElement;mode.setAttribute('aria-label','导入模式');for(const [value,text] of [['','选择合并或替换'],['merge','合并（匹配人员整行更新）'],['replace','替换本场全部数据行']]){const option=el('option',text) as HTMLOptionElement;option.value=value;mode.append(option);}
  mode.onchange=()=>{commit.disabled=!importPreview||!mode.value;};
  box.append(button('下载标准模板',()=>download('template','event-performance-template.csv')),input,button('预览与校验',async()=>{const file=input.files?.[0];if(!file)throw new Error('请先选择文件');if(file.size>2_000_000)throw new Error('CSV 不能超过 2MB');const csv=await file.text();const preview=await api<Preview>(`events/${r.event.id}/preview`,{revision:r.event.revision,csv});result.textContent=JSON.stringify(preview,null,2);importPreview=preview.errors.length?null:{csv,revision:r.event.revision};commit.disabled=!importPreview||!mode.value;}),result,mode,commit);section.append(box);
}
async function transition(action:string,extra:object={}){if(!selected)return;selected=await api<Report>(`events/${selected.event.id}/transition`,{revision:selected.event.revision,action,...extra});await refresh();renderDetail();message('状态已更新。');}
async function download(path:string,fileName:string){const response=await fetch('/report/api/'+path,{credentials:'same-origin'});if(!response.ok){const error=await response.json();throw new Error(error.error);}const url=URL.createObjectURL(await response.blob()),link=el('a') as HTMLAnchorElement;link.href=url;link.download=fileName;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function showEvent(event:EventData|null=null,duplicate=false){
  editing=duplicate?null:event;const form=$<HTMLFormElement>('eventForm');form.reset();$('formTitle').textContent=duplicate?'复制活动 · 请确认新日期':event?'编辑活动':'新建活动';
  const control=(key:string)=>form.elements.namedItem(key) as HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement;
  const select=control('picUserId') as HTMLSelectElement;select.replaceChildren(...users.map(user=>{const option=el('option',user.displayName) as HTMLOptionElement;option.value=user.id;return option;}));
  if(event){for(const key of ['name','brand','venue','notes','picUserId'] as const)control(key).value=event[key];if(!duplicate){control('eventDate').value=event.eventDate;control('deadline').value=new Date(Date.parse(event.submissionDeadline)+8*3600_000).toISOString().slice(0,16);}else control('name').value=event.name+'（新场次）';}
  $('members').replaceChildren(...users.map(user=>{const label=el('label',user.displayName,'member'),checkbox=el('input') as HTMLInputElement;checkbox.type='checkbox';checkbox.name='assigned';checkbox.value=user.id;checkbox.checked=event?.assignedUserIds.includes(user.id)||false;label.prepend(checkbox);return label;}));
  $<HTMLDialogElement>('eventDialog').showModal();
}
$<HTMLFormElement>('eventForm').onsubmit=event=>{event.preventDefault();void run(async()=>{const form=new FormData($<HTMLFormElement>('eventForm'));const body={name:form.get('name'),brand:form.get('brand'),eventDate:form.get('eventDate'),submissionDeadline:form.get('deadline')+':00+08:00',picUserId:form.get('picUserId'),assignedUserIds:form.getAll('assigned'),venue:form.get('venue'),notes:form.get('notes'),revision:editing?.revision};const report=await api<Report>('events'+(editing?'/'+editing.id:''),body);$<HTMLDialogElement>('eventDialog').close();await refresh();await openReport(report.event.id);message('活动已保存。');})();};
$('closeDialog').onclick=()=>$<HTMLDialogElement>('eventDialog').close();
$('create').onclick=()=>showEvent();$('refresh').onclick=run(refresh);
for(const id of ['month','brand','pic','state','search'])$(id).addEventListener('input',render);
$('monthly').onclick=run(()=>download('export?month='+$<HTMLInputElement>('month').value,'final-events-'+$<HTMLInputElement>('month').value+'.csv'));
void run(async()=>{
  $<HTMLInputElement>('month').value=new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Kuala_Lumpur'}).slice(0,7);
  const result=await api<{user:Member;users:Member[]}>('me');me=result.user;users=result.users;$('identity').textContent=me.displayName+' · '+me.role;$('create').hidden=me.role!=='admin';
  for(const user of users){const option=el('option',user.displayName) as HTMLOptionElement;option.value=user.id;$('pic').append(option);}
  await refresh();$('content').hidden=false;message('');
  const inbox=await api<{eventId:string;eventName:string;type:string;status:string}[]>('inbox');
  const pending=inbox.filter(item=>!['submitted','finalized','cancelled'].includes(item.status));
  if(pending.length){const box=el('section','','notice no-print');box.append(el('h2','我的催交待办'));for(const item of pending)box.append(button(item.eventName+' · '+item.type,async()=>{await openReport(item.eventId);}));$('content').prepend(box);}
})();
