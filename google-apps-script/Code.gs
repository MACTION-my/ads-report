/**
 * Daily Ads Report — Google Sheet 后端 (Apps Script)  v2
 * 修复：日期一律存成纯文本，避免时区偏移和重复行。
 *
 * 更新方法：Extensions → Apps Script → 全选替换成本代码 → 保存
 *  → Deploy → Manage deployments → 点铅笔编辑 → Version 选「New version」→ Deploy（网址不变）
 */
const TOKEN = 'maction2026';   // 与 GitHub 密钥一致

const DAILY = '每日广告数据';
const COURSES = '课程列表';
const DAILY_H  = ['日期','项目','户口','场次','花费(RM)','Lead','点击','account_id','campaign_id'];
const COURSE_H = ['课程日期','时间','地点','老师','广告从','广告到','户口/项目',
                  '花费(自动RM)','Lead(自动)','PTA','出席','成交','成交额(RM)'];

function ensure_(name, headers){
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(name);
  if(!sh) sh = ss.insertSheet(name);
  if(sh.getLastRow() === 0){
    sh.getRange(1,1,1,headers.length).setValues([headers]).setFontWeight('bold')
      .setBackground('#e60023').setFontColor('#ffffff');
    sh.setFrozenRows(1);
  }
  // 日期/ID 列强制文本，避免自动转日期/数字
  if(name === DAILY){ sh.getRange(1,1,sh.getMaxRows(),1).setNumberFormat('@');   // 日期
                      sh.getRange(1,8,sh.getMaxRows(),2).setNumberFormat('@'); } // account_id,campaign_id
  if(name === COURSES){ sh.getRange(1,1,sh.getMaxRows(),1).setNumberFormat('@');  // 课程日期
                        sh.getRange(1,5,sh.getMaxRows(),2).setNumberFormat('@'); }// 广告从,广告到
  return sh;
}
function setup(){ ensure_(DAILY, DAILY_H); ensure_(COURSES, COURSE_H); }
function json_(o){ return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function d10_(v){ return String(v).slice(0,10); }   // 归一化日期为 yyyy-mm-dd

function doGet(e){
  const tab = (e.parameter.tab === 'daily') ? DAILY : COURSES;
  const sh = ensure_(tab, (tab === DAILY) ? DAILY_H : COURSE_H);
  const out = JSON.stringify({ok:true, rows: sh.getDataRange().getValues()});
  if(e.parameter.callback)
    return ContentService.createTextOutput(e.parameter.callback + '(' + out + ')')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  return ContentService.createTextOutput(out).setMimeType(ContentService.MimeType.JSON);
}
function doPost(e){
  let body = {};
  try { body = JSON.parse(e.postData.contents || '{}'); } catch(err){ return json_({ok:false, error:'bad json'}); }
  if(body.token !== TOKEN) return json_({ok:false, error:'bad token'});
  if(body.action === 'reset_daily')  return json_(resetDaily_());
  if(body.action === 'daily')        return json_(upsertDaily_(body.rows || []));
  if(body.action === 'course_calc')  return json_(courseCalc_(body.updates || []));
  return json_({ok:false, error:'unknown action'});
}
function resetDaily_(){
  const sh = ensure_(DAILY, DAILY_H);
  if(sh.getLastRow() > 1) sh.getRange(2,1,sh.getLastRow()-1,DAILY_H.length).clearContent();
  return {ok:true, cleared:true};
}
function upsertDaily_(rows){
  const sh = ensure_(DAILY, DAILY_H);
  const data = sh.getDataRange().getValues();
  const idx = {};
  for(let r=1; r<data.length; r++)
    idx[String(data[r][7]) + '|' + String(data[r][8]) + '|' + d10_(data[r][0])] = r + 1;
  let ins = 0, upd = 0; const toAppend = [];
  rows.forEach(row => {
    row[0] = d10_(row[0]); row[7] = String(row[7]); row[8] = String(row[8]);
    const key = row[7] + '|' + row[8] + '|' + row[0];
    if(idx[key]){ sh.getRange(idx[key],1,1,DAILY_H.length).setValues([row]); upd++; }
    else { toAppend.push(row); ins++; }
  });
  if(toAppend.length) sh.getRange(sh.getLastRow()+1,1,toAppend.length,DAILY_H.length).setValues(toAppend);
  return {ok:true, inserted:ins, updated:upd};
}
function courseCalc_(updates){
  const sh = ensure_(COURSES, COURSE_H);
  updates.forEach(u => { sh.getRange(u.row,8).setValue(u.spend); sh.getRange(u.row,9).setValue(u.lead); });
  return {ok:true, updated:updates.length};
}
