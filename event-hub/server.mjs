import http from 'node:http';
import {readFileSync,mkdirSync} from 'node:fs';
import {timingSafeEqual} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {resolve,dirname} from 'node:path';
import {Hub} from './service.mjs';
import {HubError,assert,csvHeaders,csvExport} from './core.mjs';
import {attendanceHeaders} from './attendance.mjs';

export function createServer(hub,secret) {
  return http.createServer(async(req,res)=>{
    res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('Content-Security-Policy',"default-src 'self'; style-src 'self'; script-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
    const send=(code,data,type='application/json; charset=utf-8')=>{res.writeHead(code,{'Content-Type':type});res.end(type.startsWith('application/json')?JSON.stringify(data):data);};
    try {
      const url=new URL(req.url,'http://localhost'),path=url.pathname;
      if(path==='/report'&&['GET','HEAD'].includes(req.method)){
        res.writeHead(308,{Location:'/report/'+url.search});return res.end();
      }
      // Explicit allowlist: never expose DB, source files, configuration or directory listings.
      const files={'/report/':['index.html','text/html; charset=utf-8'],'/report/app.js':['app.js','text/javascript; charset=utf-8'],'/report/styles.css':['styles.css','text/css; charset=utf-8']};
      if(files[path] && req.method==='GET') {const [file,type]=files[path];return send(200,readFileSync(new URL('./public/'+file,import.meta.url)),type);}
      assert(path.startsWith('/report/api/'),'页面不存在',404);
      assert(typeof secret==='string'&&secret.length>=32,'身份网关尚未配置，模块未开放',503);
      const supplied=String(req.headers['x-hub-secret']||'');
      assert(Buffer.byteLength(supplied)===Buffer.byteLength(secret)&&timingSafeEqual(Buffer.from(supplied),Buffer.from(secret)),'身份网关验证失败',401);
      const actor=String(req.headers['x-hub-user']||'');hub.user(actor);
      if(!['GET','HEAD'].includes(req.method)) {
        assert(req.headers['x-event-hub-request']==='1','缺少同源请求标记',403);
        assert(!req.headers['sec-fetch-site'] || req.headers['sec-fetch-site']==='same-origin' || req.headers['sec-fetch-site']==='none','跨站请求被拒绝',403);
        assert((req.headers['content-type']||'').startsWith('application/json'),'仅接收 JSON',415);
      }
      let body={};
      if(req.method==='POST') {
        let size=0;const chunks=[];
        for await(const chunk of req) {size+=chunk.length;assert(size<=2_500_000,'文件过大',413);chunks.push(chunk);}
        try {body=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw new HubError('JSON 无效');}
        assert(body && typeof body==='object'&&!Array.isArray(body),'JSON 必须是对象');
      }
      if(path==='/report/api/me' && req.method==='GET')return send(200,{user:hub.user(actor),users:hub.users(actor),integrations:{identity:'trusted_proxy',googleSheets:false,notifications:'in_app_job_requires_scheduler',attendance:'csv_only'}});
      if(path==='/report/api/inbox' && req.method==='GET')return send(200,hub.inbox(actor));
      if(path==='/report/api/events' && req.method==='GET')return send(200,hub.list(actor));
      if(path==='/report/api/events' && req.method==='POST')return send(201,hub.saveEvent(actor,body));
      if(path==='/report/api/audit' && req.method==='GET')return send(200,hub.logs(actor));
      if(path==='/report/api/template' && req.method==='GET')return send(200,'\uFEFF'+csvHeaders.join(',')+'\r\n','text/csv; charset=utf-8');
      if(path==='/report/api/attendance-template' && req.method==='GET')return send(200,'\uFEFF'+attendanceHeaders.join(',')+'\r\n','text/csv; charset=utf-8');
      if(path==='/report/api/export' && req.method==='GET') {
        const month=url.searchParams.get('month');assert(/^\d{4}-\d{2}$/.test(month||''),'月份格式无效');
        const records=hub.list(actor).filter(report=>report.event.eventDate.startsWith(month)&&report.event.status==='finalized');
        return send(200,csvExport(records.flatMap(report=>report.rows.map(row=>({...row,eventId:report.event.id})))),'text/csv; charset=utf-8');
      }
      const match=path.match(/^\/report\/api\/events\/([^/]+)(?:\/(rows|own-row|transition|preview|import|export|history|attendance|attendance-preview|attendance-import))?$/);
      if(match) {
        const [,id,action]=match;
        if(req.method==='GET') {
          if(action==='attendance')return send(200,hub.attendanceList(actor,id));
          if(action==='export')return send(200,csvExport(hub.report(actor,id).rows.map(row=>({...row,eventId:id}))),'text/csv; charset=utf-8');
          if(action==='history') {const version=Number(url.searchParams.get('version'));assert(Number.isSafeInteger(version)&&version>0,'无效版本');return send(200,hub.history(actor,id,version));}
          if(!action)return send(200,hub.report(actor,id));
        }
        if(req.method==='POST') {
          if(!action)return send(200,hub.saveEvent(actor,body,id));
          const methods={rows:'saveRows','own-row':'submitOwnRow',transition:'transition',preview:'previewImport',import:'importRows','attendance-preview':'previewAttendance','attendance-import':'importAttendance'};
          if(methods[action])return send(200,hub[methods[action]](actor,id,body));
        }
      }
      throw new HubError('接口不存在',404);
    }catch(error){send(error instanceof HubError?error.status:500,{error:error instanceof HubError?error.message:'服务器内部错误'});if(!(error instanceof HubError))console.error(error);}
  });
}
if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const dbPath=resolve(process.env.EVENT_HUB_DB||fileURLToPath(new URL('./data/hub.sqlite',import.meta.url)));
  mkdirSync(dirname(dbPath),{recursive:true});
  const hub=new Hub(dbPath),server=createServer(hub,process.env.EVENT_HUB_PROXY_SECRET);
  server.listen(Number(process.env.PORT||8787),'127.0.0.1',()=>console.log('Event Hub listening on localhost:'+server.address().port+'/report/; identity gateway required'));
}
