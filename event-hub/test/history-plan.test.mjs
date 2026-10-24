import test from 'node:test';
import assert from 'node:assert/strict';
import {planHistoricalReports,buildHistoricalRows,buildHistoricalPlaceholders} from '../history-plan.mjs';
const cell=value=>({effectiveValue:typeof value==='number'?{numberValue:value}:{stringValue:value},formattedValue:String(value)});
const row=values=>({values:values.map(cell)});
function source(id='source-a',date='21 OCT',tag='21/10',amount=1058.4){return {file:{id,title:`[Pinyu] Telesales Performance Tracker - ${date} 2026`,url:'https://docs.google.com/spreadsheets/d/'+id+'/edit'},rowData:[row(['Total Pinyu '+tag]),row(['Telesales Name','# New Leads','Junk','# PTA (Old + New Leads)','# Attended','# Closed Deal','Amount (RM)']),row(['Kenny',10,1,4,3,1,amount,'','',50,20]),row(['Blank template',0,0,0,0,0,0]),row(['Total',10,1,4,3,1,amount])]};}
test('historical plan reconciles raw money and skips all-zero template rows',()=>{const [p]=planHistoricalReports([source()]);assert.equal(p.ready,true);assert.equal(p.rows.length,1);assert.equal(p.total.salesAmount,1058.4);assert.equal(p.rows[0].sourceCommission,50);});
test('historical plan holds duplicate dates, identical reports, conflicting tags and invalid money',()=>{
  assert.ok(planHistoricalReports([source(),source('source-b')]).every(p=>!p.ready));
  assert.ok(planHistoricalReports([source(),source('source-b','22 OCT','22/10')]).every(p=>!p.ready));
  assert.equal(planHistoricalReports([source('source-a','21 OCT','20/10')])[0].ready,false);
  assert.equal(planHistoricalReports([source('source-a','21 OCT','21/10',-1)])[0].ready,false);
});
test('historical import keeps provenance, inactive names, snapshots and idempotence',()=>{
  const [p]=planHistoricalReports([source()]);const options={members:[{userId:'owner',displayName:'Wilson',role:'admin',active:true},{userId:'ken',displayName:'Ken',role:'telesales',active:true}],actor:'owner',now:'2026-10-24T00:00:00Z'};
  const bundle=buildHistoricalRows(p,options);assert.equal(bundle.members[0].displayName,'Kenny');assert.equal(bundle.members[0].active,false);assert.equal(bundle.members[0].phone,'');assert.equal(bundle.rows[0].userId,'history-kenny');assert.equal(bundle.event.status,'submitted');assert.equal(bundle.event.legacySourceFileId,'source-a');assert.equal(bundle.rows[0].commission,50);assert.equal(bundle.versionRows.length,1);assert.equal(JSON.parse(bundle.versionRows[0].statsSnapshotJson).salesAmount,1058.4);
  assert.throws(()=>buildHistoricalRows(p,{...options,existingSourceIds:['source-a']}),/already imported/);
  assert.throws(()=>buildHistoricalRows({...p,ready:false},options),/needs review/);
});
test('placeholders group duplicate files without inventing results or assignments',()=>{
  const plans=planHistoricalReports([source(),source('source-b')]);const events=buildHistoricalPlaceholders(plans,{actor:'owner',now:'2026-10-24T00:00:00Z'});
  assert.equal(events.length,1);assert.deepEqual(events[0].legacySourceFileIds,['source-a','source-b']);assert.deepEqual(events[0].assignedUserIds,[]);assert.equal(events[0].status,'draft');assert.equal(events[0].reportVersion,0);assert.equal(events[0].legacyPlaceholderDeadline,events[0].submissionDeadline);
});
test('explicit owner decisions permit filename dates and preserve negative historical money',()=>{
  const input=source('refund','21 OCT','20/10',-1058.4);
  const [p]=planHistoricalReports([input],{filenameDateApprovedSourceIds:['refund'],negativeAmountApprovedSourceIds:['refund']});
  assert.equal(p.ready,true);assert.equal(p.eventDate,'2026-10-21');assert.equal(p.rows[0].salesAmount,-1058.4);assert.equal(p.total.salesAmount,-1058.4);
  const bundle=buildHistoricalRows(p,{members:[{userId:'owner',displayName:'Wilson',role:'admin',active:true}],actor:'owner',now:'2026-10-24T00:00:00Z',existingEventId:'placeholder'});assert.equal(bundle.event.id,'placeholder');assert.equal(bundle.rows[0].eventId,'placeholder');assert.equal(bundle.rows[0].salesAmount,-1058.4);
});
test('approved currency text correction recalculates money but does not change the source',()=>{
  const input=source('currency','21 OCT','21/10',0);input.rowData[2].values[6]=cell('RM1382.40');
  const [p]=planHistoricalReports([input],{salesAmountCorrections:[{sourceFileId:'currency',row:3,expectedText:'RM1382.40',value:1382.4}]});assert.equal(p.ready,true);assert.equal(p.total.salesAmount,1382.4);assert.equal(input.rowData[2].values[6].effectiveValue.stringValue,'RM1382.40');
  assert.throws(()=>planHistoricalReports([input],{salesAmountCorrections:[{sourceFileId:'currency',row:3,expectedText:'changed',value:1382.4}]}),/Source amount changed/);
});
