import {assert} from '../core.mjs';
import {canonicalBrand} from '../brands.mjs';

// Only course schedules cross into the team workspace. Never copy descriptions,
// guests, attachments, personal travel, or private calendar entries.
export function calendarCourse(item){
  if(item.visibility==='private'||item.eventType&&item.eventType!=='default')return null;
  const title=String(item.summary||'').trim();
  let brand;
  if(/pinyu|品育|绩效|績效/i.test(title))brand='Pinyu';
  else if(/franchis[e]?|franchie|连锁|連鎖|^(?:JB|KL)\s+OFFLINE\b/i.test(title))brand='Franchise';
  else if(/\bAI\s*(?:AGENT|course|training|workshop)\b/i.test(title))brand='AI';
  else if(/课程|課程|研修班|复习班|複習班|说明会|說明會|培训|培訓|\b(?:course|workshop|seminar|training)\b/i.test(title))brand='Other Courses';
  else return null;
  const raw=item.start?.date||item.start?.dateTime;
  if(!raw)return null;
  const eventDate=item.start.date||new Date(raw).toLocaleDateString('en-CA',{timeZone:'Asia/Kuala_Lumpur'});
  if(!/^\d{4}-\d{2}-\d{2}$/.test(eventDate))return null;
  const deadlineDate=item.end?.date?new Date(Date.parse(item.end.date)-86400000).toISOString().slice(0,10):item.end?.dateTime?new Date(item.end.dateTime).toLocaleDateString('en-CA',{timeZone:'Asia/Kuala_Lumpur'}):eventDate;
  return {brand,name:title.slice(0,200),eventDate,deadlineDate,venue:String(item.location||'').slice(0,500),start:item.start.dateTime||item.start.date,end:item.end?.dateTime||item.end?.date||'',allDay:Boolean(item.start.date)};
}

export function syncCalendarSnapshot(hub,actor,calendarId,items){
  hub.admin(actor);assert(typeof calendarId==='string'&&calendarId.length<=300,'Invalid calendar');assert(Array.isArray(items)&&items.length<=2000,'Calendar window is too large');
  const results=[],seen=new Set();
  for(const item of items){
    assert(typeof item.id==='string'&&item.id.length<=1024&&!seen.has(item.id),'Duplicate / invalid calendar event ID');seen.add(item.id);
    const key=calendarId+':'+item.id;
    const linked=hub.data.Events.filter(e=>e.calendarKey===key);assert(linked.length<=1,'Calendar event has multiple system links',409);
    let event=linked[0];
    if(event?.archived||event?.deletedAt){results.push({name:event.name,action:'skipped',reason:'Archived or deleted in system'});continue;}
    const source=item.status==='cancelled'?null:calendarCourse(item);
    if(!source){if(event){const issue=item.status==='cancelled'?'Cancelled in Calendar. Review in system; data retained.':'No longer a shared course in Calendar. Review in system; data retained.';if(event.calendarIssue!==issue){event.calendarIssue=issue;hub.touch(event);hub.audit(actor,'calendar.review',event.id,{issue});}results.push({name:event.name,action:'review',reason:issue});}continue;}
    if(!event){const sameDay=hub.data.Events.filter(e=>canonicalBrand(e.brand)===source.brand&&e.eventDate===source.eventDate);
      if(sameDay.length>1||sameDay.some(e=>e.calendarKey||e.archived||e.deletedAt)){results.push({name:source.name,action:'review',reason:'Possible duplicate. Admin must match the existing event.'});continue;}
      if(sameDay.length===1){event=sameDay[0];const kind=value=>/研修|一天课|一天課|落地|复习|複習|1to1/i.test(value)?'course':/online|线上|線上/i.test(value)?'online':/offline|线下|線下/i.test(value)?'offline':'unknown';if(kind(event.name)!==kind(source.name)||kind(source.name)==='unknown'){results.push({name:source.name,action:'review',reason:'Same-day course needs an explicit Admin match; no duplicate created.'});continue;}Object.assign(event,{calendarKey:key,calendarSnapshot:source,calendarBaseline:{name:event.name,eventDate:event.eventDate,venue:event.venue||''},calendarStart:source.start,calendarEnd:source.end,calendarIssue:''});hub.touch(event);hub.audit(actor,'calendar.link',event.id,{});results.push({name:event.name,action:'linked'});continue;}
      if(source.eventDate<new Date(hub.now).toLocaleDateString('en-CA',{timeZone:'Asia/Kuala_Lumpur'})){results.push({name:source.name,action:'skipped',reason:'Past course without a system report. Historical results require a separate import.'});continue;}
      event={id:hub.uuid(),...source,picUserId:actor,assignedUserIds:[],submissionDeadline:source.deadlineDate+'T23:59:00+08:00',status:'scheduled',revision:0,reportVersion:0,archived:false,notes:'',createdBy:actor,createdAt:hub.now,calendarKey:key,calendarSnapshot:source,calendarBaseline:{name:source.name,eventDate:source.eventDate,venue:source.venue},calendarStart:source.start,calendarEnd:source.end,calendarIssue:''};
      delete event.start;delete event.end;delete event.allDay;delete event.deadlineDate;hub.data.Events.push(event);hub.touch(event);hub.audit(actor,'calendar.create',event.id,{});results.push({name:event.name,action:'created'});continue;
    }
    if(JSON.stringify(event.calendarSnapshot)===JSON.stringify(source)&&!event.calendarIssue){results.push({name:event.name,action:'unchanged'});continue;}
    const protectedReport=hub.rows(event.id).length>0||hub.data.Attendance.some(a=>a.eventId===event.id)||['submitted','finalized','cancelled'].includes(event.status);
    const conflicts=[];const next={};
    for(const field of ['name','eventDate','venue']){if(source[field]===event.calendarSnapshot?.[field])continue;
      if(protectedReport||event[field]!==event.calendarBaseline?.[field])conflicts.push(field);else next[field]=source[field];}
    if(protectedReport&&(source.start!==event.calendarStart||source.end!==event.calendarEnd))conflicts.push('time');
    const deadlineChanged=source.deadlineDate!==event.calendarSnapshot?.deadlineDate;
    if(deadlineChanged&&event.submissionDeadline!==(event.calendarSnapshot?.deadlineDate||event.eventDate)+'T23:59:00+08:00')conflicts.push('submission deadline');
    const issue=conflicts.length?'Calendar changed ('+conflicts.join(', ')+'). System entries retained; Admin review required.':'';
    if(conflicts.length){if(event.calendarIssue!==issue||JSON.stringify(event.calendarPending)!==JSON.stringify(source)){event.calendarIssue=issue;event.calendarPending=source;hub.touch(event);hub.audit(actor,'calendar.review',event.id,{fields:conflicts});}results.push({name:event.name,action:'review',reason:issue});continue;}
    if(deadlineChanged)event.submissionDeadline=source.deadlineDate+'T23:59:00+08:00';Object.assign(event,next);event.calendarSnapshot=source;event.calendarBaseline={name:event.name,eventDate:event.eventDate,venue:event.venue||''};event.calendarStart=source.start;event.calendarEnd=source.end;event.calendarIssue='';delete event.calendarPending;hub.touch(event);hub.audit(actor,'calendar.update',event.id,{fields:Object.keys(next)});results.push({name:event.name,action:'updated'});
  }
  return {results,counts:results.reduce((sum,r)=>(sum[r.action]=(sum[r.action]||0)+1,sum),{})};
}
