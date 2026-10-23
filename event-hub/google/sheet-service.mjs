import {assert,validateRow,totals,rates,warnings,status,parseCsv,csvExport,csvHeaders} from '../core.mjs';
import {parseAttendance,attendanceHeaders} from '../attendance.mjs';

// Pure domain service shared by Apps Script and tests. The adapter commits all changed
// tables in one atomic Sheets batch under a script lock; no SQL emulator is involved.
export class SheetHub {
  constructor(data,now,uuid){this.data=data;this.now=now;this.uuid=uuid;this.changed=new Set();}
  user(id){const user=this.data.Members.find(row=>row.userId===id&&row.active===true);assert(user,'账号未启用',403);return user;}
  admin(id){assert(this.user(id).role==='admin','仅 Admin 可操作',403);}
  members(){return this.data.Members.filter(row=>row.active).map(row=>({id:row.userId,displayName:row.displayName,role:row.role}));}
  event(id){const event=this.data.Events.find(row=>row.id===id);assert(event,'活动不存在',404);return event;}
  rows(id){return this.data.Stats.filter(row=>row.eventId===id).map(row=>({...row,displayName:this.data.Members.find(u=>u.userId===row.userId)?.displayName||row.userId}));}
  report(id){const event=this.event(id),rows=this.rows(id),total=totals(rows),attendance=this.data.Attendance.filter(row=>row.eventId===id);
    return {event:{...event,displayStatus:status(event,new Date(this.now))},rows:rows.map(row=>({...row,rates:rates(row),warnings:warnings(row)})),total,rates:rates(total),
      submissions:this.data.Versions.filter(row=>row.eventId===id).map(row=>({version:row.version,actor:row.actorUserId,createdAt:row.createdAt})),
      completeness:{pendingUserIds:event.assignedUserIds.filter(userId=>!rows.some(row=>row.userId===userId)),missingNewLeadPta:rows.filter(row=>row.newLeadPta===null).length,unapprovedCommission:rows.filter(row=>row.commission===null||row.dealIncentive===null).length},
      attendanceSummary:{records:attendance.length,attended:attendance.filter(row=>row.attended===1).length,unattributed:attendance.filter(row=>!row.userId).length}};
  }
  audit(actor,action,id,detail){this.data.Audit.push({auditId:this.uuid(),actorUserId:actor,action,entityId:id,createdAt:this.now,detailJson:JSON.stringify(detail)});this.changed.add('Audit');}
  edit(actor,event,revision,own=false){const user=this.user(actor);assert(user.role==='admin'||event.picUserId===actor||(own&&['telesales','pic'].includes(user.role)&&event.assignedUserIds.includes(actor)),'无本场编辑权限',403);assert(!event.archived&&['scheduled','draft','awaiting_data','needs_correction'].includes(event.status),'报表已锁定');assert(event.revision===revision,'数据版本已变，请刷新后重试',409);}
  touch(event){event.revision++;event.updatedAt=this.now;this.changed.add('Events');}
  prepare(actor,event,inputs){assert(Array.isArray(inputs)&&inputs.length<=500,'无效数据行');const seen=new Set();return inputs.map(input=>{const row=validateRow(input);this.user(row.userId);assert(event.assignedUserIds.includes(row.userId),'成员未分配到活动');assert(!seen.has(row.userId),'同场同人重复');seen.add(row.userId);const old=this.rows(event.id).find(item=>item.userId===row.userId);if(this.user(actor).role!=='admin')for(const key of ['commission','dealIncentive'])assert(row[key]===(old?.[key]??null),'佣金/奖励仅 Admin 可核准',403);return {...row,eventId:event.id,updatedBy:actor,updatedAt:this.now};});}
  replaceStats(id,rows){this.data.Stats=this.data.Stats.filter(row=>row.eventId!==id).concat(rows);this.changed.add('Stats');}
  saveEvent(actor,input,id){this.admin(actor);let event=id?this.event(id):null;if(event){this.edit(actor,event,input.revision);}
    assert(['Pinyu','Chain'].includes(input.brand),'品牌无效');assert(typeof input.name==='string'&&input.name.trim()&&input.name.length<=200,'活动名必填');
    assert(typeof input.eventDate==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(input.eventDate)&&Number.isFinite(Date.parse(input.eventDate))&&new Date(input.eventDate).toISOString().slice(0,10)===input.eventDate,'活动日期无效');
    assert(typeof input.submissionDeadline==='string'&&/(?:Z|[+-]\d\d:\d\d)$/.test(input.submissionDeadline)&&Number.isFinite(Date.parse(input.submissionDeadline)),'截止日期须含时区');
    this.user(input.picUserId);assert(Array.isArray(input.assignedUserIds)&&input.assignedUserIds.length,'请选择团队成员');const ids=[...new Set(input.assignedUserIds)];ids.forEach(userId=>assert(this.user(userId).role!=='viewer','只读成员不可指定填报'));if(event)assert(this.rows(id).every(row=>ids.includes(row.userId)),'先清理被移除人员数据');
    const before=event?JSON.parse(JSON.stringify(event)):null;
    const next={...event,id:id||this.uuid(),brand:input.brand,name:input.name.trim(),eventDate:input.eventDate,picUserId:input.picUserId,assignedUserIds:ids,submissionDeadline:new Date(input.submissionDeadline).toISOString(),notes:String(input.notes||'').slice(0,4000),venue:String(input.venue||'').slice(0,500),status:event?.status||'scheduled',revision:event?.revision||0,reportVersion:event?.reportVersion||0,archived:false,createdBy:event?.createdBy||actor,createdAt:event?.createdAt||this.now};
    if(event)Object.assign(event,next);else{event=next;this.data.Events.push(event);}this.touch(event);this.audit(actor,'event.save',event.id,{before,after:event});return this.report(event.id);
  }
  transition(actor,event,body){assert(event.revision===body.revision,'版本冲突',409);const before=JSON.parse(JSON.stringify(event));
    if(body.action==='submit'){
      this.edit(actor,event,body.revision);const rows=this.rows(event.id);assert(rows.length&&event.assignedUserIds.every(id=>rows.some(row=>row.userId===id)),'仍有人员未填报');assert(!rows.some(row=>warnings(row).length)||body.acknowledgeWarnings===true,'请确认异常数据警告');
      event.status='submitted';event.reportVersion++;event.submittedBy=actor;event.submittedAt=this.now;
      this.data.Versions.push({eventId:event.id,version:event.reportVersion,status:'submitted',actorUserId:actor,createdAt:this.now,eventSnapshotJson:JSON.stringify(event)});
      for(const row of rows)this.data.VersionStats.push({eventId:event.id,version:event.reportVersion,userId:row.userId,statsSnapshotJson:JSON.stringify(row)});
      this.changed.add('Versions');this.changed.add('VersionStats');
    }else{this.admin(actor);
      if(body.action==='return'){assert(['submitted','finalized'].includes(event.status),'当前状态不可退回');assert(typeof body.reason==='string'&&body.reason.trim(),'退回必须说明原因');event.status='needs_correction';event.correctionReason=body.reason.slice(0,4000);}
      else if(body.action==='finalize'){assert(event.status==='submitted','只有已提交报表可确认');assert(this.rows(event.id).every(row=>row.commission!==null&&row.dealIncentive!==null),'佣金/奖励仍未核准，请退回补齐');event.status='finalized';event.finalizedBy=actor;event.finalizedAt=this.now;}
      else if(body.action==='archive')event.archived=true;
      else if(body.action==='cancel'){assert(!['submitted','finalized'].includes(event.status),'锁定报表须先退回');event.status='cancelled';}
      else assert(false,'未知状态操作');
    }this.touch(event);this.audit(actor,body.action,event.id,{before,after:event});return this.report(event.id);
  }
  attendanceAccess(actor,event){assert(this.user(actor).role==='admin'||event.picUserId===actor,'名单明细仅 Admin / 本场 PIC 可见',403);}
  execute(actor,path,body){this.user(actor);assert(typeof path==='string'&&path.length<=300,'路径无效');
    if(path==='me'&&body===undefined)return {user:this.members().find(row=>row.id===actor),users:this.members()};
    if(path==='events')return body===undefined?this.data.Events.map(event=>this.report(event.id)):this.saveEvent(actor,body,null);
    if(path==='inbox')return this.data.Reminders.filter(row=>row.recipientUserId===actor&&row.deliveryStatus==='delivered_in_app').filter(row=>{const e=this.event(row.eventId);return !e.archived&&!['submitted','finalized','cancelled'].includes(e.status)&&(e.picUserId===actor||this.user(actor).role==='admin'||!this.rows(e.id).some(item=>item.userId===actor));}).map(row=>({...row,eventName:this.event(row.eventId).name,status:this.event(row.eventId).status}));
    if(path==='template')return '\uFEFF'+csvHeaders.join(',')+'\r\n';
    if(path==='attendance-template')return '\uFEFF'+attendanceHeaders.join(',')+'\r\n';
    if(path==='audit'){this.admin(actor);return this.data.Audit.slice(-200).reverse();}
    if(path.startsWith('export?')){const month=path.match(/[?&]month=(\d{4}-\d{2})(?:&|$)/)?.[1];assert(month,'月份无效');return csvExport(this.data.Events.filter(e=>e.eventDate.startsWith(month)&&e.status==='finalized'&&!e.archived).flatMap(e=>this.rows(e.id)));}
    const match=path.match(/^events\/([^/?]+)(?:\/(own-row|rows|transition|export|history|preview|import|attendance|attendance-preview|attendance-import))?(?:\?version=(\d+))?$/);assert(match,'接口不存在',404);
    const [,id,action,version]=match,event=this.event(id);
    if(!action)return body===undefined?this.report(id):this.saveEvent(actor,body,id);
    if(action==='history'){const stored=this.data.Versions.find(row=>row.eventId===id&&row.version===Number(version));assert(stored,'版本不存在',404);const rows=this.data.VersionStats.filter(row=>row.eventId===id&&row.version===Number(version)).map(row=>JSON.parse(row.statsSnapshotJson));return {event:JSON.parse(stored.eventSnapshotJson),rows,total:totals(rows),rates:rates(totals(rows))};}
    if(action==='export')return csvExport(this.rows(id));
    if(action==='attendance'){this.attendanceAccess(actor,event);return this.data.Attendance.filter(row=>row.eventId===id);}
    assert(body&&typeof body==='object','缺少操作数据');
    if(action==='transition')return this.transition(actor,event,body);
    if(action==='rows'||action==='own-row'){
      this.edit(actor,event,body.revision,action==='own-row');const before=this.rows(id);let rows;
      if(action==='own-row'){assert(body.row?.userId===actor,'只能填写本人',403);assert(event.assignedUserIds.includes(actor),'未分配本场');const prepared=this.prepare(actor,event,[body.row]);assert(!warnings(prepared[0]).length||body.acknowledgeWarnings===true,'请确认异常警告');prepared[0].submittedAt=this.now;rows=before.filter(row=>row.userId!==actor).concat(prepared);}
      else rows=this.prepare(actor,event,body.rows);
      this.replaceStats(id,rows);event.status='draft';this.touch(event);this.audit(actor,action,id,{before,after:rows});return this.report(id);
    }
    if(action==='preview'||action==='import'){
      this.admin(actor);this.edit(actor,event,body.revision);const preview=parseCsv(body.csv);
      preview.rows.forEach((row,index)=>{try{assert(row.eventId===id,'eventId 不匹配');this.prepare(actor,event,[row]);}catch(error){preview.errors.push({line:index+2,message:error.message});}});
      const previous=this.rows(id),matches=preview.rows.filter(row=>previous.some(old=>old.userId===row.userId)).map(row=>row.userId);
      if(action==='preview')return {...preview,matches,warnings:preview.rows.flatMap(row=>warnings(row).map(message=>({userId:row.userId,message})))};
      assert(!preview.errors.length,JSON.stringify(preview.errors));assert(['merge','replace'].includes(body.mode),'请选择合并/替换');const incoming=this.prepare(actor,event,preview.rows);this.replaceStats(id,body.mode==='replace'?incoming:previous.filter(row=>!matches.includes(row.userId)).concat(incoming));event.status='draft';this.touch(event);
      this.data.Imports.push({jobId:this.uuid(),sourceFileId:'csv',eventId:id,actorUserId:actor,createdAt:this.now,rowCount:incoming.length,outcome:body.mode,errorsJson:'[]'});this.changed.add('Imports');this.audit(actor,'csv.import',id,{rows:incoming.length,mode:body.mode});return this.report(id);
    }
    if(action==='attendance-preview'||action==='attendance-import'){
      this.attendanceAccess(actor,event);this.edit(actor,event,body.revision);const preview=parseAttendance(body.csv),previous=this.data.Attendance.filter(row=>row.eventId===id);
      preview.rows.forEach((row,index)=>{if(row.userId&&!event.assignedUserIds.includes(row.userId))preview.errors.push({line:index+2,message:'归属人员未分配本场'});});
      const matches=preview.rows.filter(row=>previous.some(old=>old.externalId===row.externalId)).map(row=>row.externalId);
      if(action==='attendance-preview')return {...preview,matches};
      assert(!preview.errors.length,JSON.stringify(preview.errors));assert(['merge','replace'].includes(body.mode),'请选择合并/替换');
      const incoming=preview.rows.map(row=>({...row,eventId:id,updatedBy:actor,updatedAt:this.now}));this.data.Attendance=this.data.Attendance.filter(row=>row.eventId!==id||(body.mode==='merge'&&!matches.includes(row.externalId))).concat(incoming);this.changed.add('Attendance');this.touch(event);this.audit(actor,'attendance.import',id,{count:incoming.length,mode:body.mode});return this.report(id);
    }assert(false,'接口不存在',404);
  }
  remind(){let delivered=0;const now=Date.parse(this.now),day=86400_000;
    for(const event of this.data.Events){if(event.archived||['submitted','finalized','cancelled'].includes(event.status))continue;const deadline=Date.parse(event.submissionDeadline),eventDay=Date.parse(event.eventDate+'T00:00:00+08:00');let type,window;
      if(now>=deadline+2*day){type='escalation';window=new Date(deadline+2*day).toISOString();}else if(now>=deadline){type='overdue';window=event.submissionDeadline;}else if(now>=deadline-day){type='deadline';window=new Date(deadline-day).toISOString();}else if(now>=eventDay+day){type='after_event';window=new Date(eventDay+day).toISOString();}else continue;
      const recipients=new Set([event.picUserId,...event.assignedUserIds.filter(id=>!this.rows(event.id).some(row=>row.userId===id)),...(type==='escalation'?this.data.Members.filter(u=>u.role==='admin'&&u.active).map(u=>u.userId):[])]);
      for(const recipientUserId of recipients){if(!this.data.Members.some(u=>u.userId===recipientUserId&&u.active))continue;if(this.data.Reminders.some(row=>row.eventId===event.id&&row.recipientUserId===recipientUserId&&row.type===type&&row.window===window))continue;this.data.Reminders.push({eventId:event.id,recipientUserId,type,window,deliveryStatus:'delivered_in_app',sentAt:this.now,error:''});this.changed.add('Reminders');delivered++;}
    }return {deliveredInApp:delivered,sms:'not_configured',email:'not_configured'};
  }
}
