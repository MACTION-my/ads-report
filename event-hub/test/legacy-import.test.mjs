import {test} from 'node:test';
import assert from 'node:assert/strict';
import {sourceIdentity,inventorySources,previewLegacyConversion} from '../legacy-import.mjs';
const cell=v=>({effectiveValue:typeof v==='number'?{numberValue:v}:{stringValue:v},formattedValue:String(v)});
const record=(...values)=>({values:values.map(cell)});
const header=()=>record('Telesales Name','# New Leads','Junk','# PTA (Old + New Leads)','# Attended','# Closed Deal','Amount (RM)');
test('source date parsing and duplicate candidates never silently deduplicated',()=>{
  assert.deepEqual(sourceIdentity('[Pinyu] Telesales Performance Tracker - 09July 2026'),{brand:'Pinyu',eventDate:'2026-07-09'});
  assert.equal(sourceIdentity('[Franchise A-Z] Report - 25 SEPT 2026').brand,'Chain');
  assert.equal(sourceIdentity('[Pinyu] Report - 31 FEB 2026').eventDate,null);
  const list=inventorySources([{id:'a',title:'[Pinyu] Report - 14 OCT 2026'},{id:'b',title:'[Pinyu] Report - 14 OCT 2026'},{id:'c',title:'Commission 2026'}]);
  assert.equal(list.filter(source=>source.status==='duplicate_candidate').length,2);assert.equal(list[2].status,'reference_only');
});
test('multi-layout previews preserve provenance and unapproved money, ignore totals/percentages',()=>{
  const preview=previewLegacyConversion({sourceFileId:'test',title:'[Pinyu] Report - 21 OCT 2026',rowData:[record('Layout A'),header(),record('Sales A',10,1,3,2,1,1058.4,'#DIV/0!','99%',123,50),record('Total',999),record('Layout B'),header(),record('Sales A',5,0,1,1,0,0)],identityMap:{'Sales A':'user-a'}});
  assert.equal(preview.sections.length,2);assert.equal(preview.sections[0].total.newLeads,10);
  const row=preview.sections[0].rows[0];assert.equal(row.sourceCommission,123);assert.equal(row.commission,null);assert.equal(row.newLeadPta,null);assert.equal(row.rates.ptaToWon,1/3*100);
  assert.equal(preview.repeatedPeople.length,1);assert.equal(preview.canAutoCommit,false);assert.equal(preview.errors.length,0);
});
test('missing raw values and unmapped names stay visible',()=>{
  const missing=record('Sales A',10,0,1,1,0);missing.values[6]={};
  const preview=previewLegacyConversion({sourceFileId:'test',title:'[Franchise] Report - 20 July 2026',rowData:[header(),missing,record('Sales B',0,0,0,0,0,0)]});
  assert.equal(preview.errors.length,1);assert.deepEqual(preview.unmappedNames,['Sales B']);
});
