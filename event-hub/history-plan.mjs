import {sourceIdentity,previewLegacyConversion} from './legacy-import.mjs';
import {totals,assert} from './core.mjs';

const keys=['newLeads','junk','pta','attended','closedDeals','salesAmount'];
const cellValue=cell=>{const v=cell?.effectiveValue||{};return v.numberValue??v.stringValue??null;};
const text=cell=>String(cell?.formattedValue??cellValue(cell)??'').trim();
function dateTag(label){const m=label.match(/(?:Total Pinyu|Based on tag)\s+(\d{1,2})\/(\d{1,2})/i);return m?`${Number(m[1])}/${Number(m[2])}`:null;}
function hasRecord(row){return keys.some(key=>row[key]!==0)||(row.sourceCommission||0)>0||(row.sourceDealIncentive||0)>0;}

// Plans only. No Google credentials, writes, identity guessing or formula import.
export function planHistoricalReports(sources,{filenameDateApprovedSourceIds=[],negativeAmountApprovedSourceIds=[],salesAmountCorrections=[]}={}){
  const plans=sources.map(({file,rowData})=>{
    const corrections=salesAmountCorrections.filter(c=>c.sourceFileId===file.id);
    if(corrections.length){rowData=JSON.parse(JSON.stringify(rowData));for(const correction of corrections){assert(text(rowData[correction.row-1]?.values?.[6])===correction.expectedText,'Source amount changed; review again');assert(Number.isFinite(correction.value),'Invalid approved amount');rowData[correction.row-1].values[6]={effectiveValue:{numberValue:correction.value},formattedValue:String(correction.value)};}}
    const identity=sourceIdentity(file.title),preview=previewLegacyConversion({sourceFileId:file.id,title:file.title,rowData,allowNegativeSales:negativeAmountApprovedSourceIds.includes(file.id)});
    const consolidated=preview.sections.filter(s=>/^Total Pinyu\b/i.test(s.label));
    const selected=consolidated.length===1?consolidated[0]:preview.sections.length===1?preview.sections[0]:null;
    const reasons=[];
    if(!identity.eventDate||!identity.brand)reasons.push('Unable to establish event date / brand');
    if(!selected)reasons.push('No unique consolidated performance section');
    if(selected){
      const start=selected.headerRow,end=preview.sections.find(s=>s.headerRow>start)?.headerRow||rowData.length+1;
      const errors=preview.errors.filter(error=>!error.line||error.line>start&&error.line<end);
      if(errors.length)reasons.push('Missing or invalid numeric values in the selected section');
      if(!selected.rows.length)reasons.push('No performance records');
      const expected=identity.eventDate?`${Number(identity.eventDate.slice(8))}/${Number(identity.eventDate.slice(5,7))}`:null;
      const tag=dateTag(selected.label);if(tag&&tag!==expected&&!filenameDateApprovedSourceIds.includes(file.id))reasons.push('Event date conflicts with the source section');
      // Check the source total against raw person rows, including money at full precision.
      let totalRow=null;for(let i=start;i<Math.min(end,rowData.length);i++){if(/^total$/i.test(text(rowData[i].values?.[0]))){totalRow=rowData[i].values;break;}}
      if(!totalRow)reasons.push('Missing source total');
      else for(const [column,key]of keys.entries()){const value=cellValue(totalRow[column+1]);if(typeof value!=='number'||Math.abs(value-selected.total[key])>.011){if(key==='salesAmount'&&corrections.length)continue;reasons.push('Source total does not reconcile with person rows');break;}}
    }
    const rows=(selected?.rows||[]).filter(hasRecord);
    return {sourceFileId:file.id,title:file.title,url:file.url,sourceUpdatedAt:file.modified_time,...identity,selectedSection:selected?.label,headerRow:selected?.headerRow,rows,total:totals(rows),reasons,reviewDecisions:{filenameDateApproved:filenameDateApprovedSourceIds.includes(file.id),negativeAmountApproved:negativeAmountApprovedSourceIds.includes(file.id),salesAmountCorrections:corrections}};
  });
  for(const plan of plans){
    const sameDate=plans.filter(other=>other.brand===plan.brand&&other.eventDate===plan.eventDate);
    if(sameDate.length>1)plan.reasons.push('Multiple source files for the same event date');
    const fingerprint=JSON.stringify(plan.rows.map(row=>[row.sourceName,...keys.map(key=>row[key])]));
    if(plan.rows.length&&plans.some(other=>other!==plan&&other.brand===plan.brand&&other.eventDate!==plan.eventDate&&JSON.stringify(other.rows.map(row=>[row.sourceName,...keys.map(key=>row[key])]))===fingerprint))plan.reasons.push('Identical person-level results on different event dates');
    plan.ready=plan.reasons.length===0;
  }
  return plans;
}

export function buildHistoricalRows(plan,{members,actor,now,existingSourceIds=[],existingEventId}){
  assert(plan.ready,'Historical source needs review');
  assert(!existingSourceIds.includes(plan.sourceFileId),'Source already imported');
  assert(members.some(m=>m.userId===actor&&m.active&&m.role==='admin'),'Admin actor required');
  const historyMembers=[];
  const resolve=sourceName=>{
    const normalized=sourceName.replace(/\s*\(Manager\)\s*$/i,'').trim();
    // Exact names only. Kenny is never silently mapped to Ken.
    const matches=members.filter(m=>m.displayName.toLowerCase()===normalized.toLowerCase());
    if(matches.length===1)return matches[0].userId;
    const userId='history-'+normalized.toLowerCase().replace(/[^a-z0-9]+/g,'-');
    assert(userId.length>8,'Historical identity requires review');
    if(!members.concat(historyMembers).some(m=>m.userId===userId))historyMembers.push({userId,displayName:normalized,phone:'',loginStatus:'disabled',role:'viewer',active:false,updatedAt:now});
    return userId;
  };
  const eventId=existingEventId||'legacy-'+plan.sourceFileId;
  const rows=plan.rows.map(row=>({eventId,userId:resolve(row.sourceName),...Object.fromEntries(keys.map(key=>[key,row[key]])),newLeadPta:null,commission:row.sourceCommission,dealIncentive:row.sourceDealIncentive,notes:`Historical source: Conversion row ${row.sourceRow}; name: ${row.sourceName}`+(plan.reviewDecisions?.salesAmountCorrections?.some(c=>c.row===row.sourceRow)?'; text amount converted with owner approval; source total recalculated':''),submittedAt:now,updatedBy:actor,updatedAt:now}));
  const event={id:eventId,brand:plan.brand,name:`${plan.brand} · ${plan.eventDate} · Historical`,eventDate:plan.eventDate,picUserId:actor,assignedUserIds:rows.map(row=>row.userId),submissionDeadline:plan.eventDate+'T23:59:00+08:00',status:'submitted',revision:1,reportVersion:1,archived:false,venue:'',notes:'Imported historical snapshot. Source figures preserved; not newly approved. Attendance has not been imported. Source: '+plan.url,createdBy:actor,createdAt:now,updatedAt:now,submittedBy:actor,submittedAt:now,legacySourceFileId:plan.sourceFileId,legacySourceSection:plan.selectedSection};
  event.legacyReviewDecisions=plan.reviewDecisions||{};
  if(plan.reviewDecisions?.filenameDateApproved)event.notes+=' Owner confirmed the filename date; the source section label was stale.';
  if(plan.reviewDecisions?.salesAmountCorrections?.length)event.notes+=' Owner approved conversion of the text amount; revenue total was recalculated from person rows.';
  return {event,rows,members:historyMembers,version:{eventId,version:1,status:'submitted',actorUserId:actor,createdAt:now,eventSnapshotJson:JSON.stringify(event)},versionRows:rows.map(row=>({eventId,version:1,userId:row.userId,statsSnapshotJson:JSON.stringify(row)})),importRecord:{jobId:'history-'+plan.sourceFileId,sourceFileId:plan.sourceFileId,eventId,actorUserId:actor,createdAt:now,rowCount:rows.length,outcome:'historical_snapshot',errorsJson:'[]'},audit:{auditId:'history-'+plan.sourceFileId,actorUserId:actor,action:'history.import',entityId:eventId,createdAt:now,detailJson:JSON.stringify({sourceFileId:plan.sourceFileId,section:plan.selectedSection,rows:rows.length,finalApproved:false})}};
}

export function buildHistoricalPlaceholders(plans,{actor,now}){
  const groups=new Map();
  for(const plan of plans){assert(plan.brand&&plan.eventDate,'Placeholder needs a confirmed brand and date');const key=plan.brand+':'+plan.eventDate;groups.set(key,[...(groups.get(key)||[]),plan]);}
  // No person rows or invented assignments. The UI shows zero from an empty total.
  const deadline='2099-12-31T15:59:00.000Z';
  return [...groups.values()].map(group=>{const first=group[0];return {id:`legacy-placeholder-${first.brand}-${first.eventDate}`,brand:first.brand,name:`${first.brand} · ${first.eventDate} · Awaiting data`,eventDate:first.eventDate,picUserId:actor,assignedUserIds:[],submissionDeadline:deadline,status:'draft',revision:1,reportVersion:0,archived:false,venue:'',notes:'Awaiting actual data and team assignment. Template values were not imported. Sources: '+group.map(p=>p.url).join(' '),createdBy:actor,createdAt:now,updatedAt:now,legacySourceFileId:first.sourceFileId,legacySourceFileIds:group.map(p=>p.sourceFileId),legacyPlaceholderDeadline:deadline};});
}
