import {assert,validateRow,totals} from '../core.mjs';
import {canonicalBrand} from '../brands.mjs';

// Explicit Admin import of a reviewed source snapshot. No Drive credentials or polling.
export function refreshSourceReport(hub,actor,input){
  hub.admin(actor);assert(input&&typeof input==='object','Source snapshot required');
  const {sourceFileId,sourceDigest,eventDate}=input,brand=canonicalBrand(input.brand);
  assert(typeof sourceFileId==='string'&&/^[A-Za-z0-9_-]{10,200}$/.test(sourceFileId),'Invalid source ID');
  assert(typeof sourceDigest==='string'&&/^[a-f0-9]{64}$/.test(sourceDigest),'Invalid source digest');
  assert(['Pinyu','Franchise'].includes(brand)&&/^\d{4}-\d{2}-\d{2}$/.test(eventDate)&&Number.isFinite(Date.parse(eventDate))&&new Date(eventDate).toISOString().slice(0,10)===eventDate,'Invalid source event date / brand');
  assert(typeof input.name==='string'&&input.name.trim()&&input.name.length<=200,'Source event name required');
  let event=input.eventId?hub.event(input.eventId):null;
  const linked=hub.data.Events.filter(e=>e.legacySourceFileId===sourceFileId||e.legacySourceFileIds?.includes(sourceFileId));
  assert(!event||!event.archived&&!event.deletedAt,'Restore the archived event before importing');
  assert(!linked.length||linked.length===1&&linked[0].id===event?.id,'Source is already linked to another event',409);
  if(event){assert(event.eventDate===eventDate&&canonicalBrand(event.brand)===brand,'Source does not match this event');assert(linked.length===1,'Only an explicitly linked source can update an existing event');
    if(event.sourceDigest===sourceDigest)return {report:hub.report(event.id),unchanged:true};
    assert(event.revision===input.revision,'数据版本已变，请刷新后重试',409);
  }else assert(!hub.data.Events.some(e=>canonicalBrand(e.brand)===brand&&e.eventDate===eventDate),'An event already exists on this date. Link it explicitly before importing.',409);
  assert(Array.isArray(input.rows)&&input.rows.length>0&&input.rows.length<=100,'Source rows required');
  const seen=new Set(),rows=input.rows.map(source=>{
    const sourceName=String(source.sourceName||'').replace(/\s*\(Manager\)\s*$/i,'').trim();
    const matches=hub.data.Members.filter(m=>m.displayName.trim().toLowerCase()===sourceName.toLowerCase());
    assert(matches.length===1,'Source person requires an exact member mapping: '+sourceName);
    const userId=matches[0].userId;assert(!seen.has(userId),'Duplicate person in source');seen.add(userId);
    const row=validateRow({...source,userId,notes:'Source Conversion row '+String(source.sourceRow||'')+'; original name: '+String(source.sourceName),newLeadPta:source.newLeadPta??null});
    return {...row,submittedAt:hub.now,updatedAt:hub.now,updatedBy:actor};
  });
  const total=totals(rows);for(const key of ['newLeads','junk','pta','attended','closedDeals','salesAmount'])assert(typeof input.total?.[key]==='number'&&Math.abs(input.total[key]-total[key])<=.011,'Source total mismatch: '+key);
  if(!event){event={id:hub.uuid(),brand,name:input.name.trim(),eventDate,picUserId:actor,assignedUserIds:[],submissionDeadline:eventDate+'T23:59:00+08:00',status:'draft',revision:0,reportVersion:0,archived:false,venue:'',notes:'',createdAt:hub.now,createdBy:actor};hub.data.Events.push(event);}
  const snapshot=status=>{event.reportVersion++;hub.data.Versions.push({eventId:event.id,version:event.reportVersion,status,actorUserId:actor,createdAt:hub.now,eventSnapshotJson:JSON.stringify(event)});for(const row of hub.rows(event.id))hub.data.VersionStats.push({eventId:event.id,version:event.reportVersion,userId:row.userId,statsSnapshotJson:JSON.stringify(row)});hub.changed.add('Versions');hub.changed.add('VersionStats');};
  if(hub.rows(event.id).length)snapshot(event.status); // Preserve any unsnapshotted system edits.
  hub.replaceStats(event.id,rows.map(row=>({...row,eventId:event.id})));
  Object.assign(event,{brand,name:input.name.trim(),assignedUserIds:rows.map(r=>r.userId),status:'finalized',sourceDigest,sourceSyncedAt:hub.now,legacySourceFileId:sourceFileId,legacySourceSection:String(input.section||'Conversion'),submissionDeadline:eventDate+'T23:59:00+08:00',notes:'Reviewed source refresh. Source figures preserved; blank template rows skipped. Source: https://docs.google.com/spreadsheets/d/'+sourceFileId+'/edit',submittedBy:actor,submittedAt:hub.now,finalizedBy:actor,finalizedAt:hub.now});
  delete event.legacyPlaceholderDeadline;hub.touch(event);snapshot('finalized');
  hub.data.Imports.push({jobId:hub.uuid(),sourceFileId,eventId:event.id,actorUserId:actor,createdAt:hub.now,rowCount:rows.length,outcome:'reviewed_source_refresh',errorsJson:'[]'});hub.changed.add('Imports');
  hub.audit(actor,'source.refresh',event.id,{sourceFileId,sourceDigest,rowCount:rows.length});
  return {report:hub.report(event.id),unchanged:false};
}
