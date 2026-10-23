import {assert,parseCsv} from './core.mjs';
export const attendanceHeaders=['externalId','name','email','attended','userId'];
export function parseAttendance(csv) {
  const seen=new Set();
  return parseCsv(csv,attendanceHeaders,raw=>{
    const externalId=raw.externalId.trim();assert(externalId&&externalId.length<=200,'需要本场唯一外部人员 ID（不是会议 ID）');
    assert(!seen.has(externalId),'文件中 externalId 重复');seen.add(externalId);
    assert(raw.name.trim()&&raw.name.length<=200,'姓名必填且最多 200 字');
    assert(!raw.email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw.email),'Email 格式无效');
    assert(['0','1'].includes(raw.attended),'attended 必须是 0（未出席）或 1（已出席）');
    return {externalId,name:raw.name.trim(),email:raw.email.trim().toLowerCase(),attended:Number(raw.attended),userId:raw.userId.trim()||null};
  });
}
