import {sheetSchema} from './sheet-schema.mjs';
export function decodeSheetState(tables){
  const data=JSON.parse(JSON.stringify(tables));
  data.Events=data.Events.map(row=>row.metadataJson?JSON.parse(row.metadataJson):({...row,id:row.eventId,assignedUserIds:JSON.parse(row.assignedUserIdsJson||'[]')}));
  data.Stats=data.Stats.map(row=>{
    const next={...row,newLeadPta:row.newLeadPta===''?null:row.newLeadPta};
    for(const key of ['salesAmount','commission','dealIncentive']){const value=row[key+'Cents'];next[key]=value===''||value===null?null:Number(value)/100;delete next[key+'Cents'];}
    return next;
  });
  data.Attendance=data.Attendance.map(row=>({...row,userId:row.userId||null}));
  return data;
}
export function encodeSheetTable(name,rows){
  return [sheetSchema[name],...rows.map(row=>{
    let data=row;
    if(name==='Events')data={...row,eventId:row.id,assignedUserIdsJson:JSON.stringify(row.assignedUserIds),metadataJson:JSON.stringify(row)};
    if(name==='Stats'){
      data={...row};for(const key of ['salesAmount','commission','dealIncentive'])data[key+'Cents']=row[key]===null?'':Math.round(row[key]*100);
    }
    return sheetSchema[name].map(key=>data[key]??'');
  })];
}
