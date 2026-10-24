import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {assert,validateRow,warnings,totals,rates,status,parseCsv,money} from './core.mjs';
import {parseAttendance} from './attendance.mjs';
import {canonicalBrand,canonicalEvent} from './brands.mjs';

export class Hub {
  constructor(path=':memory:') {
    this.db=new DatabaseSync(path);
    this.db.exec(readFileSync(new URL('./schema.sql',import.meta.url),'utf8'));
    this.db.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;');
  }
  close(){this.db.close();}
  user(id) {
    const user=this.db.prepare('SELECT * FROM users WHERE id=? AND active=1').get(id);
    assert(user,'账号未启用或未登记',403); return user;
  }
  admin(actor) { const user=this.user(actor); assert(user.role==='admin','仅 Admin 可操作',403); return user; }
  users(actor) {this.user(actor);return this.db.prepare('SELECT id,displayName,role FROM users WHERE active=1 ORDER BY displayName').all();}
  transaction(fn) {
    this.db.exec('BEGIN IMMEDIATE');
    try {const result=fn();this.db.exec('COMMIT');return result;}catch(error){this.db.exec('ROLLBACK');throw error;}
  }
  audit(actor,action,id,data) {
    this.db.prepare('INSERT INTO auditLogs(actor,action,entityId,data,createdAt) VALUES(?,?,?,?,?)')
      .run(actor,action,id,JSON.stringify(data),new Date().toISOString());
  }
  event(id) {
    const record=this.db.prepare('SELECT * FROM events WHERE id=?').get(id);
    assert(record,'活动不存在',404);return {...canonicalEvent(JSON.parse(record.data)),revision:record.revision};
  }
  rows(id) {
    return this.db.prepare('SELECT s.*,u.displayName FROM stats s JOIN users u ON s.userId=u.id WHERE eventId=? ORDER BY u.displayName').all(id)
      .map(record=>{const row=JSON.parse(record.data);for(const key of money) if(row[key]!==null) row[key]/=100;return {...row,displayName:record.displayName};});
  }
  report(actor,id) {
    this.user(actor); const event=this.event(id);assert(!event.deletedAt||this.user(actor).role==='admin','Event not found',404);const rows=this.rows(id), total=totals(rows);
    const submissions=this.db.prepare('SELECT version,actor,createdAt FROM submissions WHERE eventId=? ORDER BY version DESC').all(id);
    return {event:{...event,displayStatus:status(event)},rows:rows.map(row=>({...row,rates:rates(row),warnings:warnings(row)})),total,rates:rates(total),submissions,
      attendanceSummary:this.attendanceSummary(id),
      completeness:{rows:rows.length,pendingUserIds:event.assignedUserIds.filter(id=>!rows.some(row=>row.userId===id)),missingNewLeadPta:rows.filter(row=>row.newLeadPta===null).length,unapprovedCommission:rows.filter(row=>row.commission===null||row.dealIncentive===null).length}};
  }
  list(actor) {
    this.user(actor);return this.db.prepare('SELECT id FROM events').all().filter(({id})=>this.user(actor).role==='admin'||!this.event(id).deletedAt).map(({id})=>this.report(actor,id));
  }
  saveEvent(actor,input,id=null) {
    this.admin(actor);
    input={...input,brand:canonicalBrand(input.brand)};
    return this.transaction(()=>{
      const previous=id?this.event(id):null;
      if(previous) {
        assert(input.revision===previous.revision,'活动已被修改，请刷新',409);
        assert(!['submitted','finalized','cancelled'].includes(previous.status),'已锁定活动不可修改');
      }
      assert(['Pinyu','Franchise','AI','Other Courses'].includes(input.brand),'Invalid course brand');
      assert(typeof input.name==='string' && input.name.trim() && input.name.length<=200,'活动名称必填且最多 200 字');
      assert(typeof input.eventDate==='string' && /^\d{4}-\d{2}-\d{2}$/.test(input.eventDate) && Number.isFinite(Date.parse(input.eventDate)) && new Date(input.eventDate).toISOString().slice(0,10)===input.eventDate,'活动日期无效');
      assert(typeof input.submissionDeadline==='string' && /(?:Z|[+-]\d{2}:\d{2})$/.test(input.submissionDeadline) && Number.isFinite(Date.parse(input.submissionDeadline)),'截止日期须包含时区');
      this.user(input.picUserId);
      assert(Array.isArray(input.assignedUserIds) && input.assignedUserIds.length>0,'请指定团队成员');
      const assignedUserIds=[...new Set(input.assignedUserIds)];assignedUserIds.forEach(userId=>assert(this.user(userId).role!=='viewer','只读成员不可指定为填报人员'));
      if(previous)assert(this.rows(id).every(row=>assignedUserIds.includes(row.userId)),'移除已填报成员前须先明确清理该人员数据');
      const event={...previous,id:id||randomUUID(),brand:input.brand,name:input.name.trim(),eventDate:input.eventDate,
        submissionDeadline:new Date(input.submissionDeadline).toISOString(),picUserId:input.picUserId,assignedUserIds,
        venue:String(input.venue||'').slice(0,500),notes:String(input.notes||'').slice(0,4000),
        status:previous?.status||'scheduled',reportVersion:previous?.reportVersion||0,
        createdBy:previous?.createdBy||actor,createdAt:previous?.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString(),
        archived:previous?.archived||false};
      if(previous) this.writeEvent(event,previous.revision);
      else this.db.prepare('INSERT INTO events(id,data) VALUES(?,?)').run(event.id,JSON.stringify(event));
      this.audit(actor,previous?'event.update':'event.create',event.id,{before:previous,after:event});
      return this.report(actor,event.id);
    });
  }
  writeEvent(event,revision) {
    const data={...event};delete data.revision;data.updatedAt=new Date().toISOString();
    const change=this.db.prepare('UPDATE events SET data=?,revision=revision+1 WHERE id=? AND revision=?').run(JSON.stringify(data),event.id,revision);
    assert(change.changes===1,'数据已被修改，请刷新',409);
  }
  editable(actor,event,revision) {
    const user=this.user(actor);
    assert(user.role==='admin'||event.picUserId===actor,'只有 Admin 或本场 PIC 可填报',403);
    assert(!event.archived && ['scheduled','awaiting_data','draft','needs_correction'].includes(event.status),'报表已锁定');
    assert(revision===event.revision,'数据版本已变，请刷新后重试',409);
  }
  prepareRows(actor,event,inputs) {
    const user=this.user(actor);assert(Array.isArray(inputs)&&inputs.length<=500,'无效数据行');
    const old=this.rows(event.id),seen=new Set();
    return inputs.map(input=>{
      const row=validateRow(input);this.user(row.userId);
      assert(event.assignedUserIds.includes(row.userId),'人员未分配到本场活动');
      assert(!seen.has(row.userId),'同场每人只可有一行');seen.add(row.userId);
      if(user.role!=='admin') {
        const previous=old.find(item=>item.userId===row.userId);
        for(const key of ['commission','dealIncentive']) {if(key==='commission'&&row.userId===actor)continue;assert(row[key]===(previous?.[key]??null),'只能填写本人佣金；奖励由 Admin 核准',403);}
      }
      return row;
    });
  }
  replaceRows(eventId,rows,actor) {
    this.db.prepare('DELETE FROM stats WHERE eventId=?').run(eventId);
    const statement=this.db.prepare('INSERT INTO stats(eventId,userId,data) VALUES(?,?,?)');
    for(const row of rows) {
      const stored={...row,updatedBy:actor,updatedAt:new Date().toISOString()};
      for(const key of money) if(stored[key]!==null) stored[key]=Math.round(stored[key]*100);
      statement.run(eventId,row.userId,JSON.stringify(stored));
    }
  }
  saveRows(actor,id,body) {
    return this.transaction(()=>{
      const event=this.event(id);this.editable(actor,event,body.revision);
      const rows=this.prepareRows(actor,event,body.rows),before=this.rows(id);
      this.replaceRows(id,rows,actor);this.writeEvent({...event,status:'draft'},event.revision);
      this.audit(actor,'report.draft',id,{before,after:rows});return this.report(actor,id);
    });
  }
  submitOwnRow(actor,id,body) {
    return this.transaction(()=>{
      const user=this.user(actor),event=this.event(id);
      assert(['telesales','pic','admin'].includes(user.role)&&event.assignedUserIds.includes(actor),'只有本场分配的填报人员可提交本人数据',403);
      assert(!event.archived&&['scheduled','awaiting_data','draft','needs_correction'].includes(event.status),'报表已锁定');
      assert(body.revision===event.revision,'数据版本已变，请刷新后重试',409);
      assert(body.row?.userId===actor,'只能填写本人数据',403);
      const [row]=this.prepareRows(actor,event,[body.row]);
      assert(!warnings(row).length||body.acknowledgeWarnings===true,'请确认异常数据警告');
      const before=this.rows(id).find(item=>item.userId===actor)||null;
      const stored={...row,updatedBy:actor,updatedAt:new Date().toISOString(),memberSubmittedAt:new Date().toISOString()};
      for(const key of money)if(stored[key]!==null)stored[key]=Math.round(stored[key]*100);
      this.db.prepare('INSERT INTO stats(eventId,userId,data) VALUES(?,?,?) ON CONFLICT(eventId,userId) DO UPDATE SET data=excluded.data').run(id,actor,JSON.stringify(stored));
      this.writeEvent({...event,status:'draft'},event.revision);
      this.audit(actor,'member.submit',id,{before,after:row});return this.report(actor,id);
    });
  }
  transition(actor,id,body) {
    return this.transaction(()=>{
      const event=this.event(id);assert(event.revision===body.revision,'版本冲突，请刷新',409);this.user(actor);
      const before={...event};
      if(body.action==='submit') {
        this.editable(actor,event,body.revision);const rows=this.rows(id);
        assert(rows.length>0,'空报表不能提交');
        assert(event.assignedUserIds.every(userId=>rows.some(row=>row.userId===userId)),'分配人员仍有缺报，请填写零值或说明');
        assert(!rows.some(row=>warnings(row).length) || body.acknowledgeWarnings===true,'请确认异常数据警告');
        event.status='finalized';event.reportVersion++;event.submittedBy=actor;event.submittedAt=new Date().toISOString();event.finalizedBy=actor;event.finalizedAt=event.submittedAt;
        this.db.prepare('INSERT INTO submissions(eventId,version,snapshot,actor,createdAt) VALUES(?,?,?,?,?)')
          .run(id,event.reportVersion,JSON.stringify({event,rows,total:totals(rows),rates:rates(totals(rows))}),actor,event.submittedAt);
      }else {
        this.admin(actor);
        if(body.action==='return') {
          assert(['submitted','finalized'].includes(event.status),'只有已提交/最终版能退回');
          assert(typeof body.reason==='string'&&body.reason.trim(),'退回必须提供原因');
          event.status='needs_correction';event.correctionReason=body.reason.slice(0,4000);
        }else if(body.action==='finalize') {
          assert(event.status==='submitted','只有已提交报表可最终确认');
          event.status='finalized';event.finalizedBy=actor;event.finalizedAt=new Date().toISOString();
        }else if(body.action==='delete'){assert(!event.deletedAt,'Event already deleted');event.deletedAt=new Date().toISOString();event.deletedBy=actor;event.archived=true;}
        else if(body.action==='restore'){assert(event.deletedAt,'Event is not deleted');delete event.deletedAt;delete event.deletedBy;event.archived=false;}
        else if(body.action==='archive') event.archived=true;
        else if(body.action==='cancel') {assert(!['submitted','finalized'].includes(event.status),'锁定报表须先退回');event.status='cancelled';}
        else assert(false,'未知状态操作');
      }
      this.writeEvent(event,event.revision);this.audit(actor,body.action,id,{before,after:event,reason:body.reason});return this.report(actor,id);
    });
  }
  previewImport(actor,id,body) {
    this.admin(actor);const event=this.event(id);this.editable(actor,event,body.revision);
    const parsed=parseCsv(body.csv),errors=[...parsed.errors];
    parsed.rows.forEach((row,index)=>{try {assert(row.eventId===id,'eventId 与当前活动不符');this.prepareRows(actor,event,[row]);}catch(error){errors.push({line:index+2,message:error.message});}});
    const old=this.rows(id);
    return {...parsed,errors,matches:parsed.rows.filter(row=>old.some(item=>item.userId===row.userId)).map(row=>row.userId),warnings:parsed.rows.flatMap(row=>warnings(row).map(message=>({userId:row.userId,message})))};
  }
  importRows(actor,id,body) {
    return this.transaction(()=>{
      const preview=this.previewImport(actor,id,body);
      assert(['merge','replace'].includes(body.mode),'必须明确选择 merge 或 replace');
      assert(preview.errors.length===0,JSON.stringify(preview.errors));
      const event=this.event(id),before=this.rows(id);
      const incoming=this.prepareRows(actor,event,preview.rows);
      const rows=body.mode==='replace'?incoming:[...before.filter(row=>!incoming.some(item=>item.userId===row.userId)),...incoming];
      this.replaceRows(id,rows,actor);this.writeEvent({...event,status:'draft'},event.revision);
      this.db.prepare('INSERT INTO importJobs(actor,eventId,rowCount,outcome,createdAt) VALUES(?,?,?,?,?)').run(actor,id,incoming.length,body.mode,new Date().toISOString());
      this.audit(actor,'csv.import',id,{before,after:rows,mode:body.mode});return this.report(actor,id);
    });
  }
  history(actor,id,version) {
    this.user(actor);assert(!this.event(id).deletedAt||this.user(actor).role==='admin','Event not found',404);const result=this.db.prepare('SELECT snapshot FROM submissions WHERE eventId=? AND version=?').get(id,version);
    assert(result,'版本不存在',404);const snapshot=JSON.parse(result.snapshot);return {...snapshot,event:canonicalEvent(snapshot.event)};
  }
  logs(actor) {this.admin(actor);return this.db.prepare('SELECT * FROM auditLogs ORDER BY id DESC LIMIT 200').all();}
  attendanceAccess(actor,id) {
    const user=this.user(actor),event=this.event(id);assert(!event.deletedAt||user.role==='admin','Event not found',404);
    assert(user.role==='admin'||event.picUserId===actor,'客户名单仅 Admin 或本场 PIC 可见',403);return event;
  }
  attendanceSummary(id) {
    const rows=this.db.prepare('SELECT data FROM attendance WHERE eventId=?').all(id).map(record=>JSON.parse(record.data));
    return {records:rows.length,attended:rows.filter(row=>row.attended===1).length,unattributed:rows.filter(row=>!row.userId).length};
  }
  attendanceList(actor,id) {
    this.attendanceAccess(actor,id);return this.db.prepare('SELECT data FROM attendance WHERE eventId=?').all(id).map(record=>JSON.parse(record.data));
  }
  previewAttendance(actor,id,body) {
    const event=this.attendanceAccess(actor,id);this.editable(actor,event,body.revision);
    const parsed=parseAttendance(body.csv),errors=[...parsed.errors];
    parsed.rows.forEach((row,index)=>{if(row.userId&&!event.assignedUserIds.includes(row.userId))errors.push({line:index+2,message:'名单 userId 未分配到活动'});});
    const existing=this.attendanceList(actor,id);
    return {...parsed,errors,matches:parsed.rows.filter(row=>existing.some(item=>item.externalId===row.externalId)).map(row=>row.externalId)};
  }
  importAttendance(actor,id,body) {
    return this.transaction(()=>{
      const preview=this.previewAttendance(actor,id,body);assert(preview.errors.length===0,JSON.stringify(preview.errors));
      assert(['merge','replace'].includes(body.mode),'必须选择合并或替换');
      const event=this.event(id),before=this.attendanceSummary(id);
      if(body.mode==='replace')this.db.prepare('DELETE FROM attendance WHERE eventId=?').run(id);
      const statement=this.db.prepare('INSERT INTO attendance(eventId,externalId,data) VALUES(?,?,?) ON CONFLICT(eventId,externalId) DO UPDATE SET data=excluded.data');
      for(const row of preview.rows)statement.run(id,row.externalId,JSON.stringify({...row,updatedBy:actor,updatedAt:new Date().toISOString()}));
      this.writeEvent(event,event.revision);
      // Do not leak customer details through team-visible audit metadata or report snapshots.
      this.audit(actor,'attendance.import',id,{before,after:this.attendanceSummary(id),mode:body.mode});
      this.db.prepare('INSERT INTO importJobs(actor,eventId,rowCount,outcome,createdAt) VALUES(?,?,?,?,?)').run(actor,id,preview.rows.length,'attendance.'+body.mode,new Date().toISOString());
      return this.report(actor,id);
    });
  }
  inbox(actor) {
    this.user(actor);return this.db.prepare("SELECT r.id,r.eventId,r.type,r.sentAt,e.data FROM reminderLogs r JOIN events e ON r.eventId=e.id WHERE recipient=? AND deliveryStatus='delivered_in_app' ORDER BY r.id DESC LIMIT 100").all(actor)
      .filter(row=>{const event=JSON.parse(row.data);return !event.archived&&(event.picUserId===actor||this.user(actor).role==='admin'||!this.rows(row.eventId).some(item=>item.userId===actor));})
      .map(row=>({id:row.id,eventId:row.eventId,type:row.type,sentAt:row.sentAt,eventName:canonicalEvent(JSON.parse(row.data)).name,status:JSON.parse(row.data).status}));
  }
}
