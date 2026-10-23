import {test} from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {Hub} from '../service.mjs';
import {createServer} from '../server.mjs';
test('HTTP fails closed, enforces gateway and CSRF, static files allowlisted',async()=>{
  const hub=new Hub(),secret='a'.repeat(40);hub.db.prepare('INSERT INTO users(id,displayName,role) VALUES(?,?,?)').run('viewer','Viewer','viewer');
  const server=createServer(hub,secret);server.listen(0,'127.0.0.1');await once(server,'listening');const base='http://127.0.0.1:'+server.address().port;
  const headers={'X-Hub-User':'viewer','X-Hub-Secret':secret};
  try{
    assert.equal((await fetch(base+'/events/api/me')).status,401);
    assert.equal((await fetch(base+'/events/api/me',{headers})).status,200);
    assert.equal((await fetch(base+'/events/api/events',{method:'POST',headers,body:'{}'})).status,403);
    assert.equal((await fetch(base+'/events/api/events',{method:'POST',headers:{...headers,'Content-Type':'application/json','X-Event-Hub-Request':'1'},body:'{}'})).status,403);
    assert.equal((await fetch(base+'/events/api/events',{method:'POST',headers:{...headers,'Content-Type':'application/json','X-Event-Hub-Request':'1','Sec-Fetch-Site':'cross-site'},body:'{}'})).status,403);
    assert.equal((await fetch(base+'/events/data/hub.sqlite')).status,404);
    assert.equal((await fetch(base+'/events/')).status,200);
  }finally{await new Promise(resolve=>server.close(resolve));hub.close();}
  const closedHub=new Hub(),closed=createServer(closedHub,undefined);closed.listen(0,'127.0.0.1');await once(closed,'listening');
  try{assert.equal((await fetch('http://127.0.0.1:'+closed.address().port+'/events/api/me')).status,503);}finally{await new Promise(resolve=>closed.close(resolve));closedHub.close();}
});
