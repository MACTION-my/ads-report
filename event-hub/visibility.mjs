import {totals,rates} from './core.mjs';
export const visibilitySettingsId='_hub_team_visibility';
export function hiddenTeamIds(events){return new Set(events.find(event=>event.id===visibilitySettingsId)?.teamHiddenUserIds||[]);}
export function eventHasHiddenData(event,rows,hidden){return event.assignedUserIds.some(id=>hidden.has(id))||rows.some(row=>hidden.has(row.userId));}
export function projectTeamReport(report,hidden,attendance=[]){
  const sensitive=eventHasHiddenData(report.event,report.rows,hidden),event={...report.event};
  event.assignedUserIds=event.assignedUserIds.filter(id=>!hidden.has(id));
  for(const key of ['picUserId','createdBy','submittedBy','finalizedBy'])if(hidden.has(event[key]))event[key]='';
  event.rankingExcludedUserIds=(event.rankingExcludedUserIds||[]).filter(id=>!hidden.has(id));
  if(sensitive){event.notes='';event.readOnlyForTeam=true;for(const key of ['legacySourceFileId','legacySourceFileIds','legacySourceSection','legacyReviewDecisions','correctionReason'])delete event[key];}
  const rows=report.rows.filter(row=>!hidden.has(row.userId)).map(row=>({...row,notes:sensitive?'':row.notes,updatedBy:hidden.has(row.updatedBy)?'':row.updatedBy}));
  const total=totals(rows),visibleAttendance=attendance.filter(row=>!hidden.has(row.userId));
  const result={...report,event,rows,total,rates:rates(total),visibilityScope:'team_visible',submissions:(report.submissions||[]).map(version=>({...version,actor:hidden.has(version.actor)?'':version.actor}))};
  if(report.completeness)result.completeness={...report.completeness,rows:rows.length,pendingUserIds:event.assignedUserIds.filter(id=>!rows.some(row=>row.userId===id)),missingNewLeadPta:rows.filter(row=>row.newLeadPta===null).length,unapprovedCommission:rows.filter(row=>row.commission===null||row.dealIncentive===null).length};
  if(report.attendanceSummary)result.attendanceSummary={records:visibleAttendance.length,attended:visibleAttendance.filter(row=>row.attended===1).length,unattributed:visibleAttendance.filter(row=>!row.userId).length};
  return result;
}
