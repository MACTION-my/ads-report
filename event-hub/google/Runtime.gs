/** Generated build combines this adapter with tested domain code. Deploy as a separate project. */
function doGet(){return HtmlService.createHtmlOutputFromFile('Index').setTitle('Event Performance Hub').addMetaTag('viewport','width=device-width,initial-scale=1');}
function doPost(event){
  const reply=hubEnvelope_(function(){
    const text=event&&event.postData&&event.postData.contents;assert(typeof text==='string'&&text.length<=2500000,'请求无效');
    const request=JSON.parse(text);assert(request&&Array.isArray(request.args),'请求无效');
    if(request.method==='hubLogin')return hubLogin(request.args[0]);
    if(request.method==='hubStart')return hubStart(request.args[0]);
    if(request.method==='hubLogout')return hubLogout(request.args[0]);
    if(request.method==='hubCall')return hubCall(request.args[0],request.args[1],request.args[2]);
    assert(false,'接口不存在',404);
  });
  // Existing handlers already return an envelope; parser errors use the outer one.
  return ContentService.createTextOutput(JSON.stringify(reply.ok?reply.data:reply)).setMimeType(ContentService.MimeType.JSON);
}
function hubProperties_(){return PropertiesService.getScriptProperties();}
function hubBook_(){const id=hubProperties_().getProperty('HUB_SPREADSHEET_ID');assert(id,'后台总表尚未配置',503);return SpreadsheetApp.openById(id);}
function hubLoad_(names){
  const selected=names||Object.keys(sheetSchema).filter(function(name){return name!=='Appointments';}),tables=Object.fromEntries(Object.keys(sheetSchema).map(function(name){return [name,[]];}));
  const ranges=selected.map(function(name){assert(sheetSchema[name],'未知后台页签');return "'"+name+"'!A1:"+String.fromCharCode(64+sheetSchema[name].length)+'20001';});
  const id=hubProperties_().getProperty('HUB_SPREADSHEET_ID');assert(id,'后台总表尚未配置',503);
  const result=Sheets.Spreadsheets.Values.batchGet(id,{ranges:ranges,valueRenderOption:'UNFORMATTED_VALUE',dateTimeRenderOption:'FORMATTED_STRING'});
  for(let index=0;index<selected.length;index++){
    const name=selected[index],expected=sheetSchema[name],matrix=result.valueRanges[index].values||[],header=matrix[0]||[];
    assert(JSON.stringify(header)===JSON.stringify(expected),'后台表头不匹配 '+name,503);
    assert(matrix.length<=20000,'数据量超过当前单表版本限制',503);
    tables[name]=matrix.slice(1).filter(function(row){return row.some(function(value){return value!=='';});}).map(function(row){return Object.fromEntries(expected.map(function(key,column){return [key,row[column]===undefined?'':row[column]];}));});
  }const data=decodeSheetState(tables);data._rowCounts=Object.fromEntries(selected.map(function(name,index){return [name,(result.valueRanges[index].values||[]).length];}));return data;
}
function hubCommit_(hub){
  if(!hub.changed.size)return;
  const id=hubProperties_().getProperty('HUB_SPREADSHEET_ID'),requests=[];
  const metadata=Sheets.Spreadsheets.get(id,{fields:'sheets.properties'}).sheets;
  for(const name of hub.changed){const properties=metadata.find(function(sheet){return sheet.properties.title===name;})?.properties;assert(properties,'Unknown backend sheet: '+name,503);const matrix=encodeSheetTable(name,hub.data[name]);
    assert(matrix.length<=20000,'数据量超过当前版本限制');
    for(const row of matrix)for(const value of row)assert(typeof value!=='string'||value.length<=45000,'单格内容过长，未写入');
    const requiredRows=Math.max(hub.data._rowCounts?.[name]||properties.gridProperties.rowCount,matrix.length);
    if(requiredRows>properties.gridProperties.rowCount)requests.push({appendDimension:{sheetId:properties.sheetId,dimension:'ROWS',length:requiredRows-properties.gridProperties.rowCount}});
    const rows=matrix.map(row=>({values:row.map(value=>({userEnteredValue:typeof value==='number'?{numberValue:value}:typeof value==='boolean'?{boolValue:value}:{stringValue:String(value)}}))}));
    requests.push({updateCells:{range:{sheetId:properties.sheetId,startRowIndex:0,endRowIndex:requiredRows,startColumnIndex:0,endColumnIndex:sheetSchema[name].length},rows:rows,fields:'userEnteredValue'}});
  }
  // One Sheets batch is atomic. This must not be replaced with sequential setValues calls.
  Sheets.Spreadsheets.batchUpdate({requests:requests},id);
}
function hubSession_(data){
  const cache=CacheService.getScriptCache();
  return new PhoneSessions({cache:cache,digest:function(value){return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,value,Utilities.Charset.UTF_8).map(function(byte){return ('0'+((byte+256)%256).toString(16)).slice(-2);}).join('');},randomToken:function(){return Utilities.getUuid().replace(/-/g,'')+Utilities.getUuid().replace(/-/g,'');},now:Date.now(),enabled:hubProperties_().getProperty('HUB_PHONE_ONLY_ENABLED')==='true',members:data.Members});
}
function hubEnvelope_(operation){try{return {ok:true,data:operation()};}catch(error){
  if(error instanceof HubError)return {ok:false,error:error.message,status:error.status};
  const reference=typeof Utilities!=='undefined'?Utilities.getUuid().slice(0,8):'unknown';console.error('Hub error '+reference+': '+String(error.stack||error.message||error));
  return {ok:false,error:'The server could not finish this request. Refresh to check the saved state before retrying. Error reference: '+reference,status:500};
}}
function hubWithLock_(operation){const lock=LockService.getScriptLock();assert(lock.tryLock(1000),'Another update is still saving. Please try again shortly.',503);try{return operation();}finally{lock.releaseLock();}}
function hubLogin(phone){return hubEnvelope_(function(){const data=hubLoad_(['Members']);return hubSession_(data).login(phone);});}
function hubInitial_(hub,actor){const identity=hub.execute(actor,'me');return {user:identity.user,users:identity.users,capabilities:identity.capabilities,reports:hub.execute(actor,'events'),inbox:hub.execute(actor,'inbox')};}
function hubInitialTables_(){return ['Members','Events','Stats','Attendance','Versions','Reminders'];}
function hubStart(phone){return hubEnvelope_(function(){const data=hubLoad_(hubInitialTables_()),sessions=hubSession_(data),login=sessions.login(phone),actor=sessions.actor(login.token),hub=new SheetHub(data,new Date().toISOString(),function(){return Utilities.getUuid();});return {...login,initial:hubInitial_(hub,actor)};});}
function hubLogout(token){return hubEnvelope_(function(){return hubSession_({Members:[]}).logout(token);});}
function hubCall(token,path,body){return hubEnvelope_(function(){
  assert(JSON.stringify(body||{}).length<=2500000,'数据过大');
  if(path==='appointments'){
    const identity=hubLoad_(['Members']),actor=hubSession_(identity).actor(token);new SheetHub(identity,new Date().toISOString(),function(){return Utilities.getUuid();}).user(actor);
    return hubWithLock_(function(){hubEnsureAppointments_();const data=hubLoad_(['Members','Appointments','Audit']),hub=new SheetHub(data,new Date().toISOString(),function(){return Utilities.getUuid();});const result=hub.execute(actor,path,body===null?undefined:body);hubCommit_(hub);return result;});
  }
  if(path==='calendar-status'||path==='calendar-sync'){
    const identity=hubLoad_(['Members']),actor=hubSession_(identity).actor(token);new SheetHub(identity,new Date().toISOString(),function(){return Utilities.getUuid();}).admin(actor);
    if(path==='calendar-status')return {enabled:hubProperties_().getProperty('HUB_CALENDAR_ENABLED')==='true',lastSync:hubProperties_().getProperty('HUB_CALENDAR_LAST_SYNC')||'',lastError:hubProperties_().getProperty('HUB_CALENDAR_LAST_ERROR')||''};
    assert(body&&Object.keys(body).length===0,'Calendar sync does not accept client event data');return hubCalendarSync_(actor);
  }
  const operation=function(){const data=hubLoad_(path==='bootstrap'?hubInitialTables_():undefined),actor=hubSession_(data).actor(token),hub=new SheetHub(data,new Date().toISOString(),function(){return Utilities.getUuid();});
    if(path==='bootstrap'){assert(body===null||body===undefined,'不接受写入数据');return hubInitial_(hub,actor);}
    const result=hub.execute(actor,path,body===null?undefined:body);hubCommit_(hub);return result;
  };
  // Reads use one Sheets batch and never queue behind unrelated long-running writes.
  return body===null||body===undefined?operation():hubWithLock_(operation);
});}
// Additive migration only; never rewrite an existing sheet or its headers.
function hubEnsureAppointments_(){const id=hubProperties_().getProperty('HUB_SPREADSHEET_ID'),sheets=Sheets.Spreadsheets.get(id,{fields:'sheets.properties'}).sheets;if(sheets.some(s=>s.properties.title==='Appointments'))return;const used=new Set(sheets.map(s=>s.properties.sheetId));let sheetId=1;while(used.has(sheetId))sheetId++;Sheets.Spreadsheets.batchUpdate({requests:[{addSheet:{properties:{sheetId:sheetId,title:'Appointments',gridProperties:{rowCount:1000,columnCount:sheetSchema.Appointments.length}}}},{updateCells:{start:{sheetId:sheetId,rowIndex:0,columnIndex:0},rows:[{values:sheetSchema.Appointments.map(value=>({userEnteredValue:{stringValue:value}}))}],fields:'userEnteredValue'}}]},id);}
// Private functions ending in _ cannot be invoked through google.script.run.
function runScheduledReminders_(){const lock=LockService.getScriptLock();lock.waitLock(20000);let result;try{const data=hubLoad_(),hub=new SheetHub(data,new Date().toISOString(),function(){return Utilities.getUuid();});result=hub.remind();hubCommit_(hub);}finally{lock.releaseLock();}if(hubProperties_().getProperty('HUB_CALENDAR_ENABLED')==='true')hubCalendarSync_();console.log(JSON.stringify(result));return result;}
function installHubTrigger_(){assert(hubProperties_().getProperty('HUB_PHONE_ONLY_ENABLED')==='true','先完成部署配置');const existing=ScriptApp.getProjectTriggers().filter(function(trigger){return trigger.getHandlerFunction()==='runScheduledReminders_';});if(!existing.length)ScriptApp.newTrigger('runScheduledReminders_').timeBased().everyHours(1).create();return {installed:existing.length===0};}
function hubCalendarSync_(requestedActor){
  const properties=hubProperties_();assert(properties.getProperty('HUB_CALENDAR_ENABLED')==='true','Calendar sync is not enabled. Owner authorization is required.',503);
  try{
    const calendarId=properties.getProperty('HUB_CALENDAR_ID')||'primary';
    const baseline=hubLoad_(['Members','Events']);const actor=requestedActor||baseline.Members.find(m=>m.active&&m.role==='admin')?.userId;
    new SheetHub(baseline,new Date().toISOString(),function(){return Utilities.getUuid();}).admin(actor);
    const now=Date.now(),options={timeMin:new Date(now-60*86400000).toISOString(),timeMax:new Date(now+180*86400000).toISOString(),singleEvents:true,showDeleted:true,maxResults:250,timeZone:'Asia/Kuala_Lumpur'},items=[];
    let page;do{const response=Calendar.Events.list(calendarId,Object.assign({},options,page?{pageToken:page}:{}));items.push(...(response.items||[]));assert(items.length<=2000,'Calendar window exceeds 2,000 entries',503);page=response.nextPageToken;}while(page);
    // Follow linked IDs even after rescheduling outside the rolling window.
    const ids=new Set(items.map(item=>item.id));for(const event of baseline.Events){if(!event.calendarKey?.startsWith(calendarId+':')||event.archived)continue;const id=event.calendarKey.slice(calendarId.length+1);if(!ids.has(id)){try{items.push(Calendar.Events.get(calendarId,id));}catch(error){if(!/not found|gone|deleted|404|410/i.test(String(error.message)))throw error;items.push({id:id,status:'unavailable'});}ids.add(id);}}
    const result=hubWithLock_(function(){const data=hubLoad_(),hub=new SheetHub(data,new Date().toISOString(),function(){return Utilities.getUuid();});const applied=syncCalendarSnapshot(hub,actor,calendarId,items);hubCommit_(hub);return applied;});
    properties.setProperty('HUB_CALENDAR_LAST_SYNC',new Date().toISOString());properties.deleteProperty('HUB_CALENDAR_LAST_ERROR');return result;
  }catch(error){properties.setProperty('HUB_CALENDAR_LAST_ERROR','Calendar sync failed. Existing system data was retained. Check Apps Script execution logs.');throw error;}
}
