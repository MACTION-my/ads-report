// Browser QA with mock Google transport + real pure domain service, no live records.
import {createRequire} from 'node:module';
import {once} from 'node:events';
import {mkdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {Hub} from '../service.mjs';
import {createServer} from '../server.mjs';
import {SheetHub} from '../google/sheet-service.mjs';
import {sheetSchema} from '../google/sheet-schema.mjs';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const state={...Object.fromEntries(Object.keys(sheetSchema).map(key=>[key,[]])),Members:[{userId:'owner',displayName:'Test Owner',role:'admin',active:true},{userId:'staff',displayName:'Test Staff',role:'telesales',active:true}]};
let id=0;const domain=new SheetHub(state,new Date().toISOString(),()=>String(++id)),sqlite=new Hub(),server=createServer(sqlite,undefined);
domain.execute('owner','events',{brand:'Chain',name:'Google transport test',eventDate:new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Kuala_Lumpur'}),submissionDeadline:'2030-10-24T18:00:00+08:00',picUserId:'owner',assignedUserIds:['staff']});
state.Members.push({userId:'historical',displayName:'Hidden Historical Member',role:'viewer',active:false});
state.Events[0].rankingExcludedUserIds=['historical'];
state.Stats.push({eventId:'1',userId:'historical',newLeads:3,junk:0,pta:2,newLeadPta:null,attended:1,closedDeals:1,salesAmount:99,commission:0,dealIncentive:0});
server.listen(0,'127.0.0.1');await once(server,'listening');let browser;
try{
  browser=await chromium.launch({channel:'msedge',headless:true});const context=await browser.newContext({viewport:{width:390,height:844}});
  let loginRequests=0,mockActor='staff';
  await context.exposeBinding('mockGoogleRpc',async(_source,method,args)=>{try{if(method==='hubStart'){loginRequests++;mockActor=args[0]==='0000000000'?'owner':'staff';return {ok:true,data:{token:'mock-session-token-for-browser-tests',initial:{...domain.execute(mockActor,'me'),reports:domain.execute(mockActor,'events'),inbox:domain.execute(mockActor,'inbox')}}};}if(method==='hubLogin')throw Error('Legacy login should not be called');if(method==='hubLogout')return {ok:true,data:{ok:true}};if(['me','events','inbox','bootstrap'].includes(args[1])&&args[2]===null&&domain.rows('1').length===0)throw Error('Redundant initialization request');return {ok:true,data:domain.execute(mockActor,args[1],args[2]===null?undefined:args[2])};}catch(error){return {ok:false,error:error.message,status:error.status};}});
  await context.addInitScript(()=>{window.google={script:{get run(){let success,failure;return {withSuccessHandler(fn){success=fn;return this;},withFailureHandler(fn){failure=fn;return this;},hubStart(...args){window.mockGoogleRpc('hubStart',args).then(success,failure);},hubLogin(...args){window.mockGoogleRpc('hubLogin',args).then(success,failure);},hubLogout(...args){window.mockGoogleRpc('hubLogout',args).then(success,failure);},hubCall(...args){window.mockGoogleRpc('hubCall',args).then(success,failure);}};}}};});
  const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));page.on('dialog',dialog=>dialog.accept());
  await page.goto('http://127.0.0.1:'+server.address().port+'/report/');
  if(await page.getByRole('link',{name:'← Back to Ads Report',exact:true}).count())throw Error('Ads link exposed before login');
  if(await page.locator('a[href="/"],a[href="https://ads.aikpi.my/"]').count())throw Error('Logo links to Ads before login');
  mkdirSync(new URL('../qa/',import.meta.url),{recursive:true});
  if(await page.locator('html').getAttribute('lang')!=='en')throw Error('Expected English document language');
  for(const width of [390,1366]){
    await page.setViewportSize({width,height:1000});
    await page.screenshot({path:fileURLToPath(new URL(`../qa/vivid-login-${width}.png`,import.meta.url)),fullPage:true});
    if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error('Login overflow at '+width);
  }
  await page.setViewportSize({width:390,height:844});
  await page.getByRole('textbox',{name:'Registered phone number'}).fill('0123456789');await page.getByRole('button',{name:'Enter workspace',exact:true}).click();
  await page.getByRole('button',{name:'Open',exact:true}).waitFor();if(loginRequests!==1)throw Error('Expected one combined login request');
  if(await page.getByRole('link',{name:'← Back to Ads Report',exact:true}).count())throw Error('Ads link exposed to a team member');
  if(/[\p{Script=Han}]/u.test(await page.locator('body').innerText()))throw Error('Unexpected Chinese interface text');
  await page.getByRole('button',{name:'Open',exact:true}).click();await page.getByRole('button',{name:'Submit my results',exact:true}).click();
  await page.getByRole('status').filter({hasText:'Your results have been submitted'}).waitFor();
  if(domain.rows('1').length!==2)throw new Error('Submission not recorded or historical record lost');
  if((await page.locator('#ranking').innerText()).includes('Hidden Historical Member'))throw Error('Excluded historical member still ranked');
  if(!(await page.locator('#summary').innerText()).includes('99.00'))throw Error('Ranking exclusion changed event revenue');
  await page.getByRole('button',{name:'Sign out',exact:true}).click();await page.getByRole('button',{name:'Enter workspace',exact:true}).waitFor();
  if(await page.getByRole('link',{name:'← Back to Ads Report',exact:true}).count())throw Error('Ads link retained after logout');
  await page.getByRole('textbox',{name:'Registered phone number'}).fill('0000000000');await page.getByRole('button',{name:'Enter workspace',exact:true}).click();
  await page.getByRole('button',{name:'Team privacy',exact:true}).click();
  const staffRow=page.locator('#teamPrivacy').getByRole('row').filter({hasText:'Test Staff'});
  await staffRow.getByRole('button',{name:'Hide data from team',exact:true}).click();
  await staffRow.getByText('Admin only',{exact:true}).waitFor();
  if(!domain.hiddenIds().has('staff'))throw Error('Privacy button did not persist the server setting');
  await page.screenshot({path:fileURLToPath(new URL('../qa/team-privacy-mobile.png',import.meta.url)),fullPage:true});
  if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error('Privacy panel overflow');
  await page.getByRole('button',{name:'Sign out',exact:true}).click();await page.getByRole('button',{name:'Enter workspace',exact:true}).waitFor();
  await page.getByRole('textbox',{name:'Registered phone number'}).fill('0123456789');await page.getByRole('button',{name:'Enter workspace',exact:true}).click();
  await page.getByRole('button',{name:'Open',exact:true}).waitFor();
  if(await page.getByRole('button',{name:'Team privacy',exact:true}).count())throw Error('Privacy management exposed to staff');
  if(errors.length)throw new Error(errors.join(';'));console.log('Google transport mobile flow passed: phone login, own submission, logout; mock transport only.');
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));sqlite.close();}
