// Browser QA with mock Google transport + real pure domain service, no live records.
import {createRequire} from 'node:module';
import {once} from 'node:events';
import {Hub} from '../service.mjs';
import {createServer} from '../server.mjs';
import {SheetHub} from '../google/sheet-service.mjs';
import {sheetSchema} from '../google/sheet-schema.mjs';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const state={...Object.fromEntries(Object.keys(sheetSchema).map(key=>[key,[]])),Members:[{userId:'owner',displayName:'Test Owner',role:'admin',active:true},{userId:'staff',displayName:'Test Staff',role:'telesales',active:true}]};
let id=0;const domain=new SheetHub(state,new Date().toISOString(),()=>String(++id)),sqlite=new Hub(),server=createServer(sqlite,undefined);
domain.execute('owner','events',{brand:'Chain',name:'Google transport test',eventDate:new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Kuala_Lumpur'}),submissionDeadline:'2030-10-24T18:00:00+08:00',picUserId:'owner',assignedUserIds:['staff']});
server.listen(0,'127.0.0.1');await once(server,'listening');let browser;
try{
  browser=await chromium.launch({channel:'msedge',headless:true});const context=await browser.newContext({viewport:{width:390,height:844}});
  await context.exposeBinding('mockGoogleRpc',async(_source,method,args)=>{try{if(method==='hubLogin')return {ok:true,data:{token:'mock-session-token-for-browser-tests'}};if(method==='hubLogout')return {ok:true,data:{ok:true}};return {ok:true,data:domain.execute('staff',args[1],args[2]===null?undefined:args[2])};}catch(error){return {ok:false,error:error.message,status:error.status};}});
  await context.addInitScript(()=>{window.google={script:{get run(){let success,failure;return {withSuccessHandler(fn){success=fn;return this;},withFailureHandler(fn){failure=fn;return this;},hubLogin(...args){window.mockGoogleRpc('hubLogin',args).then(success,failure);},hubLogout(...args){window.mockGoogleRpc('hubLogout',args).then(success,failure);},hubCall(...args){window.mockGoogleRpc('hubCall',args).then(success,failure);}};}}};});
  const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));page.on('dialog',dialog=>dialog.accept());
  await page.goto('http://127.0.0.1:'+server.address().port+'/report/');
  await page.getByRole('textbox',{name:'已登记手机号'}).fill('0123456789');await page.getByRole('button',{name:'进入活动中心',exact:true}).click();
  await page.getByRole('button',{name:'打开',exact:true}).click();await page.getByRole('button',{name:'提交我的数据',exact:true}).click();
  await page.getByRole('status').filter({hasText:'本人数据已提交'}).waitFor();
  if(domain.rows('1').length!==1)throw new Error('Submission not recorded');
  await page.getByRole('button',{name:'退出登录',exact:true}).click();await page.getByRole('button',{name:'进入活动中心',exact:true}).waitFor();
  if(errors.length)throw new Error(errors.join(';'));console.log('Google transport mobile flow passed: phone login, own submission, logout; mock transport only.');
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));sqlite.close();}
