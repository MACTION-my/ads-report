import {Hub} from './service.mjs';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';

// Run from a server-side scheduler. In-app delivery only; never claims email/WhatsApp delivery.
export function runReminders(hub,now=new Date()) {
  return hub.transaction(()=>{
    let delivered=0,skipped=0;const timestamp=now.toISOString();
    const records=hub.db.prepare('SELECT data FROM events').all();
    for(const record of records){
      const event=JSON.parse(record.data);
      if(event.archived||['submitted','finalized','cancelled'].includes(event.status))continue;
      const deadline=Date.parse(event.submissionDeadline),day=86400_000,eventDay=Date.parse(event.eventDate+'T00:00:00+08:00');
      let type=null,window=null;
      if(now.getTime()>=deadline+2*day){type='escalation';window=new Date(deadline+2*day).toISOString();}
      else if(now.getTime()>=deadline){type='overdue';window=event.submissionDeadline;}
      else if(now.getTime()>=deadline-day){type='deadline';window=new Date(deadline-day).toISOString();}
      else if(now.getTime()>=eventDay+day){type='after_event';window=new Date(eventDay+day).toISOString();}
      if(!type)continue;
      const reported=new Set(hub.rows(event.id).map(row=>row.userId));
      const recipients=new Set([event.picUserId,...event.assignedUserIds.filter(id=>!reported.has(id))]);
      if(type==='escalation')for(const user of hub.db.prepare("SELECT id FROM users WHERE role='admin' AND active=1").all())recipients.add(user.id);
      for(const recipient of recipients){
        if(!hub.db.prepare('SELECT id FROM users WHERE id=? AND active=1').get(recipient)){skipped++;continue;}
        const change=hub.db.prepare('INSERT OR IGNORE INTO reminderLogs(eventId,recipient,type,window,deliveryStatus,sentAt) VALUES(?,?,?,?,?,?)').run(event.id,recipient,type,window,'delivered_in_app',timestamp);
        if(change.changes)delivered++;else skipped++;
      }
    }
    return {deliveredInApp:delivered,skipped,email:'not_configured',whatsapp:'not_configured'};
  });
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  if(!process.env.EVENT_HUB_DB)throw new Error('EVENT_HUB_DB must point to the existing production database; no implicit database creation.');
  const hub=new Hub(process.env.EVENT_HUB_DB);try{console.log(JSON.stringify(runReminders(hub)));}finally{hub.close();}
}
