import {assert} from '../core.mjs';

export function zoomAppointments(hub,actor,body){
  const user=hub.user(actor),rows=hub.data.Appointments;
  if(body===undefined)return rows.map(r=>({...r})).sort((a,b)=>a.startAt.localeCompare(b.startAt));
  assert(user.role!=='viewer','Only team members can book Zoom',403);
  assert(body&&typeof body==='object','Appointment details required');
  const action=body.action||'save';assert(['save','cancel'].includes(action),'Invalid appointment action');
  const old=body.id?rows.find(r=>r.id===body.id):null;
  if(body.id){assert(old,'Appointment not found',404);assert(user.role==='admin'||old.ownerId===actor,'Only the owner or Admin can change this appointment',403);assert(body.revision===old.revision,'Appointment changed. Refresh and try again.',409);assert(old.status==='booked','This appointment is cancelled');}
  if(action==='cancel'){assert(old,'Appointment required');old.status='cancelled';old.revision++;old.updatedAt=hub.now;hub.changed.add('Appointments');hub.audit(actor,'appointment.cancel',old.id,{});return {...old};}
  assert(typeof body.customer==='string'&&body.customer.trim()&&body.customer.trim().length<=150,'Customer / appointment name required (maximum 150 characters)');
  const parse=value=>{assert(typeof value==='string'&&/(?:Z|[+-]\d\d:\d\d)$/.test(value)&&Number.isFinite(Date.parse(value)),'Appointment time must include a time zone');return new Date(value).toISOString();};
  const startAt=parse(body.startAt),endAt=parse(body.endAt),start=Date.parse(startAt),end=Date.parse(endAt);
  assert(end>start&&end-start<=12*3600000,'End time must be after start, within 12 hours');
  assert(start>=Date.parse(hub.now)-300000,'Choose a current or future appointment time');
  const ownerId=user.role==='admin'?(body.ownerId||old?.ownerId||actor):actor;
  const owner=hub.user(ownerId);assert(owner.role!=='viewer','Choose an active team member');
  const conflict=rows.find(r=>r.id!==old?.id&&r.status==='booked'&&Date.parse(r.startAt)<end&&Date.parse(r.endAt)>start);
  assert(!conflict,'This Zoom time overlaps another booking. Refresh the schedule and choose another time.',409);
  const link=String(body.link||'').trim();assert(link.length<=1000,'Zoom link is too long');
  if(link)assert(/^https:\/\/(?:[a-z0-9-]+\.)*zoom\.(?:us|com)(?::443)?(?:\/[^\s\\]*)?$/i.test(link),'Use a valid HTTPS Zoom meeting link');
  const next={id:old?.id||hub.uuid(),customer:body.customer.trim(),ownerId,ownerName:old?.ownerId===ownerId?old.ownerName:owner.displayName,startAt,endAt,link,notes:String(body.notes||'').slice(0,1000),status:'booked',revision:(old?.revision||0)+1,createdAt:old?.createdAt||hub.now,createdBy:old?.createdBy||actor,updatedAt:hub.now};
  if(old)Object.assign(old,next);else rows.push(next);hub.changed.add('Appointments');hub.audit(actor,'appointment.save',next.id,{startAt,endAt,ownerId});return {...next};
}
