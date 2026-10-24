import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalBrand,canonicalEvent} from '../brands.mjs';
import {SheetHub} from '../google/sheet-service.mjs';
import {sheetSchema} from '../google/sheet-schema.mjs';
test('brand rename preserves old records and IDs while displaying Franchise',()=>{
  const old={id:'legacy-Chain-id',brand:'Chain',name:'Chain · Historical',notes:'Original source notes'};
  assert.deepEqual(canonicalEvent(old),{...old,brand:'Franchise',name:'Franchise · Historical'});assert.equal(old.brand,'Chain');assert.equal(canonicalBrand('Pinyu'),'Pinyu');
  const data=Object.fromEntries(Object.keys(sheetSchema).map(k=>[k,[]]));data.Members=[{userId:'admin',role:'admin',active:true,displayName:'Admin'}];let id=0;const hub=new SheetHub(data,'2026-10-24T00:00:00Z',()=>String(++id));
  const created=hub.execute('admin','events',{name:'Franchise event',brand:'Franchise',eventDate:'2026-10-21',submissionDeadline:'2030-10-24T00:00:00Z',picUserId:'admin',assignedUserIds:['admin']});assert.equal(created.event.brand,'Franchise');
  const event=hub.event(created.event.id);event.brand='Chain';event.name='Chain · Historical';data.Versions.push({eventId:event.id,version:1,eventSnapshotJson:JSON.stringify(event)});
  assert.equal(hub.execute('admin','events')[0].event.brand,'Franchise');assert.equal(hub.execute('admin',`events/${event.id}/history?version=1`).event.name,'Franchise · Historical');assert.equal(JSON.parse(data.Versions[0].eventSnapshotJson).brand,'Chain');
});
