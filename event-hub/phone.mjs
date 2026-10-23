import {assert} from './core.mjs';
// Contact identifier only. Never treat successful normalization as authentication.
export function normalizeMalaysiaPhone(input){
  assert(typeof input==='string','手机号须为文字');
  let phone=input.trim().replace(/[\s()-]/g,'');
  if(phone.startsWith('0060'))phone='+'+phone.slice(2);
  else if(phone.startsWith('60'))phone='+'+phone;
  else if(phone.startsWith('0'))phone='+60'+phone.slice(1);
  assert(/^\+601\d{8,9}$/.test(phone),'请输入有效马来西亚手机号码');
  return phone;
}
