import {test} from 'node:test';
import assert from 'node:assert/strict';
import {normalizeMalaysiaPhone} from '../phone.mjs';
test('Malaysia phone variants normalize to stable identifiers without authenticating',()=>{
  const canonical='+60123456789';
  for(const value of ['012-3456789','012 3456789','60123456789','0060123456789',canonical])assert.equal(normalizeMalaysiaPhone(value),canonical);
  for(const value of [null,123,'+44123456789','=IMPORTXML(1)','0123','0123456789abc'])assert.throws(()=>normalizeMalaysiaPhone(value));
});
