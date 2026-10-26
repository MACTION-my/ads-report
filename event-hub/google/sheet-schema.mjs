// Separate operational entities; headers are stable API contracts, not staff input forms.
export const sheetSchema={
  Appointments:['id','customer','ownerId','ownerName','startAt','endAt','link','notes','status','revision','createdAt','createdBy','updatedAt'],
  Events:['eventId','brand','name','eventDate','picUserId','assignedUserIdsJson','submissionDeadline','status','revision','reportVersion','notes','updatedAt','metadataJson'],
  Stats:['eventId','userId','newLeads','junk','pta','newLeadPta','attended','closedDeals','salesAmountCents','commissionCents','dealIncentiveCents','notes','submittedAt','updatedBy','updatedAt'],
  Members:['userId','displayName','phone','loginStatus','role','active','updatedAt'],
  Attendance:['eventId','externalId','name','email','attended','userId','updatedBy','updatedAt'],
  Versions:['eventId','version','status','actorUserId','createdAt','eventSnapshotJson'],
  VersionStats:['eventId','version','userId','statsSnapshotJson'],
  Imports:['jobId','sourceFileId','eventId','actorUserId','createdAt','rowCount','outcome','errorsJson'],
  Reminders:['eventId','recipientUserId','type','window','deliveryStatus','sentAt','error'],
  Audit:['auditId','actorUserId','action','entityId','createdAt','detailJson'],
  Sources:['sourceFileId','title','url','mimeType','brand','reviewStatus','sourceUpdatedAt']
};
