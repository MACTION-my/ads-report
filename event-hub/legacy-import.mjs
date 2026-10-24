import {assert,validateRow,totals,rates,warnings} from './core.mjs';

const months={JAN:1,FEB:2,MAR:3,APR:4,MAY:5,JUN:6,JUL:7,AUG:8,SEP:9,OCT:10,NOV:11,DEC:12};
export function sourceIdentity(title){
  const brand=/^\[Pinyu\]/i.test(title)?'Pinyu':/^\[Franchise(?: A-Z)?(?: (?:JB|KL))?(?: (?:Offline|Online))?\]/i.test(title)?'Franchise':null;
  const match=title.match(/-\s*(\d{1,2})\s*([a-z]+)\s+(\d{4})\s*$/i);
  if(!brand||!match||!months[match[2].slice(0,3).toUpperCase()])return {brand,eventDate:null};
  const eventDate=`${match[3]}-${String(months[match[2].slice(0,3).toUpperCase()]).padStart(2,'0')}-${match[1].padStart(2,'0')}`;
  return {brand,eventDate:Number.isFinite(Date.parse(eventDate))&&new Date(eventDate).toISOString().slice(0,10)===eventDate?eventDate:null};
}
export function inventorySources(files){
  const byDate=new Map();
  const sources=files.map(file=>{const identity=sourceIdentity(file.title);const key=identity.brand&&identity.eventDate?`${identity.brand}:${identity.eventDate}`:null;
    if(key)byDate.set(key,[...(byDate.get(key)||[]),file.id]);
    return {sourceFileId:file.id,title:file.title,url:file.url,...identity,candidateKey:key,status:key?'pending_review':'reference_only'};});
  return sources.map(source=>({...source,status:source.candidateKey&&byDate.get(source.candidateKey).length>1?'duplicate_candidate':source.status,
    candidateSourceIds:source.candidateKey?byDate.get(source.candidateKey):[]}));
}
function value(cell){const v=cell?.effectiveValue||cell?.userEnteredValue||{};if(v.errorValue)throw new Error('原始数字含错误');return v.numberValue??v.stringValue??null;}
const text=cell=>String(cell?.formattedValue??cell?.effectiveValue?.stringValue??cell?.userEnteredValue?.stringValue??'').trim();
// Only accepts bounded CellData from the Conversion sheet. Never reads customer lists.
// Returns a preview; it deliberately cannot commit or guess identity/segment ownership.
export function previewLegacyConversion({sourceFileId,title,rowData,startRow=0,identityMap={},allowNegativeSales=false}){
  assert(sourceFileId&&Array.isArray(rowData),'缺少来源或 CellData');
  const identity=sourceIdentity(title),sections=[],errors=[],notices=[];let active=null,context='';
  for(let index=0;index<rowData.length;index++){
    const cells=rowData[index].values||[],label=text(cells[0]),line=startRow+index+1;
    if(label==='Telesales Name'){
      const expected=['# New Leads','Junk','# PTA (Old + New Leads)','# Attended','# Closed Deal','Amount (RM)'];
      if(!expected.every((header,column)=>text(cells[column+1])===header)){errors.push({line,message:'不支持的绩效表头，须确认映射'});active=null;continue;}
      active={sourceSegmentId:`${sourceFileId}:Conversion:${line}`,label:context||`Conversion row ${line}`,headerRow:line,rows:[]};sections.push(active);continue;
    }
    if(/^total$/i.test(label)){active=null;continue;}
    if(!label)continue;
    if(!active){context=label;continue;}
    if(cells.slice(1,7).every(cell=>text(cell)==='')){active=null;context=label;continue;}
    try{
      const mapped=identityMap[label]||null;
      const raw={userId:mapped||'unmapped',newLeads:value(cells[1]),junk:value(cells[2]),pta:value(cells[3]),newLeadPta:null,attended:value(cells[4]),closedDeals:value(cells[5]),salesAmount:value(cells[6]),commission:null,dealIncentive:null};
      const negativeSales=allowNegativeSales&&typeof raw.salesAmount==='number'&&raw.salesAmount<0;
      const row=validateRow(negativeSales?{...raw,salesAmount:-raw.salesAmount}:raw);if(negativeSales)row.salesAmount=raw.salesAmount;delete row.userId;
      const optional=column=>{try{const v=value(cells[column]);return typeof v==='number'&&Number.isFinite(v)&&v>=0?v:null;}catch{return null;}};
      active.rows.push({...row,userId:mapped,sourceName:label,sourceRow:line,sourceSegmentId:active.sourceSegmentId,
        sourceCommission:optional(9),sourceDealIncentive:optional(10),rates:rates(row),warnings:warnings(row)});
    }catch(error){errors.push({line,message:error.message});}
  }
  if(!sections.length)errors.push({message:'读取范围内没有可识别的绩效区块'});
  if(!identity.brand||!identity.eventDate)errors.push({message:'文件名称无法确定品牌/日期，须人工确认'});
  const rows=sections.flatMap(section=>section.rows),byName=new Map();
  for(const row of rows)byName.set(row.userId||row.sourceName,[...(byName.get(row.userId||row.sourceName)||[]),row.sourceSegmentId]);
  const repeatedPeople=[...byName].filter(([,segments])=>new Set(segments).size>1).map(([name,segments])=>({name,segments}));
  if(repeatedPeople.length)notices.push('同一人员出现在多个来源区块，未确认互斥归属前禁止自动相加');
  notices.push('newLeadPta 缺失，转换率保留 N/A；旧佣金/奖励仅保留为来源值，不自动批准');
  return {sourceFileId,...identity,sections:sections.map(section=>({...section,total:totals(section.rows)})),errors,notices,repeatedPeople,
    unmappedNames:[...new Set(rows.filter(row=>!row.userId).map(row=>row.sourceName))],canAutoCommit:false};
}
