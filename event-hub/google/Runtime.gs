/** Generated build combines this adapter with tested domain code. Deploy as a separate project. */
function doGet(){return HtmlService.createHtmlOutputFromFile('Index').setTitle('Event Performance Hub').addMetaTag('viewport','width=device-width,initial-scale=1');}
function doPost(event){
  const reply=hubEnvelope_(function(){
    const text=event&&event.postData&&event.postData.contents;assert(typeof text==='string'&&text.length<=2500000,'请求无效');
    const request=JSON.parse(text);assert(request&&Array.isArray(request.args),'请求无效');
    if(request.method==='hubLogin')return hubLogin(request.args[0]);
    if(request.method==='hubLogout')return hubLogout(request.args[0]);
    if(request.method==='hubCall')return hubCall(request.args[0],request.args[1],request.args[2]);
    assert(false,'接口不存在',404);
  });
  // Existing handlers already return an envelope; parser errors use the outer one.
  return ContentService.createTextOutput(JSON.stringify(reply.ok?reply.data:reply)).setMimeType(ContentService.MimeType.JSON);
}
function hubProperties_(){return PropertiesService.getScriptProperties();}
function hubBook_(){const id=hubProperties_().getProperty('HUB_SPREADSHEET_ID');assert(id,'后台总表尚未配置',503);return SpreadsheetApp.openById(id);}
function hubLoad_(){
  const book=hubBook_(),tables={};
  for(const name of Object.keys(sheetSchema)){
    const sheet=book.getSheetByName(name);assert(sheet,'缺少后台页签 '+name,503);
    const expected=sheetSchema[name],header=sheet.getRange(1,1,1,expected.length).getValues()[0];
    assert(JSON.stringify(header)===JSON.stringify(expected),'后台表头不匹配 '+name,503);
    const count=sheet.getLastRow();assert(count<=20000,'数据量超过当前单表版本限制',503);
    const values=count>1?sheet.getRange(2,1,count-1,expected.length).getValues():[];
    tables[name]=values.filter(row=>row.some(value=>value!=='')).map(row=>Object.fromEntries(expected.map((key,index)=>[key,row[index] instanceof Date?row[index].toISOString():row[index]])));
  }return decodeSheetState(tables);
}
function hubCommit_(hub){
  if(!hub.changed.size)return;
  const book=hubBook_(),requests=[];
  for(const name of hub.changed){const sheet=book.getSheetByName(name),matrix=encodeSheetTable(name,hub.data[name]);
    assert(matrix.length<=20000,'数据量超过当前版本限制');
    for(const row of matrix)for(const value of row)assert(typeof value!=='string'||value.length<=45000,'单格内容过长，未写入');
    const requiredRows=Math.max(sheet.getLastRow(),matrix.length);
    if(requiredRows>sheet.getMaxRows())requests.push({appendDimension:{sheetId:sheet.getSheetId(),dimension:'ROWS',length:requiredRows-sheet.getMaxRows()}});
    const rows=matrix.map(row=>({values:row.map(value=>({userEnteredValue:typeof value==='number'?{numberValue:value}:typeof value==='boolean'?{boolValue:value}:{stringValue:String(value)}}))}));
    requests.push({updateCells:{range:{sheetId:sheet.getSheetId(),startRowIndex:0,endRowIndex:requiredRows,startColumnIndex:0,endColumnIndex:sheetSchema[name].length},rows:rows,fields:'userEnteredValue'}});
  }
  // One Sheets batch is atomic. This must not be replaced with sequential setValues calls.
  Sheets.Spreadsheets.batchUpdate({requests:requests},book.getId());
}
function hubSession_(data){
  const cache=CacheService.getScriptCache();
  return new PhoneSessions({cache:cache,digest:function(value){return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,value,Utilities.Charset.UTF_8).map(function(byte){return ('0'+((byte+256)%256).toString(16)).slice(-2);}).join('');},randomToken:function(){return Utilities.getUuid().replace(/-/g,'')+Utilities.getUuid().replace(/-/g,'');},now:Date.now(),enabled:hubProperties_().getProperty('HUB_PHONE_ONLY_ENABLED')==='true',members:data.Members});
}
function hubEnvelope_(operation){try{return {ok:true,data:operation()};}catch(error){if(!(error instanceof HubError))console.error(String(error.message||error));return {ok:false,error:error instanceof HubError?error.message:'服务处理失败，请管理员检查 Apps Script 执行记录',status:error instanceof HubError?error.status:500};}}
function hubLogin(phone){return hubEnvelope_(function(){const lock=LockService.getScriptLock();lock.waitLock(20000);try{const data=hubLoad_();return hubSession_(data).login(phone);}finally{lock.releaseLock();}});}
function hubLogout(token){return hubEnvelope_(function(){return hubSession_({Members:[]}).logout(token);});}
function hubCall(token,path,body){return hubEnvelope_(function(){
  assert(JSON.stringify(body||{}).length<=2500000,'数据过大');
  const lock=LockService.getScriptLock();lock.waitLock(20000);
  try{const data=hubLoad_(),actor=hubSession_(data).actor(token),hub=new SheetHub(data,new Date().toISOString(),function(){return Utilities.getUuid();});
    const result=hub.execute(actor,path,body===null?undefined:body);hubCommit_(hub);return result;
  }finally{lock.releaseLock();}
});}
// Private functions ending in _ cannot be invoked through google.script.run.
function runScheduledReminders_(){const lock=LockService.getScriptLock();lock.waitLock(20000);try{const data=hubLoad_(),hub=new SheetHub(data,new Date().toISOString(),function(){return Utilities.getUuid();}),result=hub.remind();hubCommit_(hub);console.log(JSON.stringify(result));return result;}finally{lock.releaseLock();}}
function installHubTrigger_(){assert(hubProperties_().getProperty('HUB_PHONE_ONLY_ENABLED')==='true','先完成部署配置');const existing=ScriptApp.getProjectTriggers().filter(function(trigger){return trigger.getHandlerFunction()==='runScheduledReminders_';});if(!existing.length)ScriptApp.newTrigger('runScheduledReminders_').timeBased().everyHours(1).create();return {installed:existing.length===0};}
