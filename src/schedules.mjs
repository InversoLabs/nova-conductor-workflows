import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import {atomic} from './workflow.mjs';
import {validateTemplate} from './templates.mjs';
export const scheduleFile=()=>process.env.NOVA_SCHEDULE_FILE||path.join(process.env.LOCALAPPDATA||os.homedir(),'NovaConductor','schedules.json');
export function readSchedules(){return fs.existsSync(scheduleFile())?JSON.parse(fs.readFileSync(scheduleFile(),'utf8')):[];}
export function writeSchedules(list){fs.mkdirSync(path.dirname(scheduleFile()),{recursive:true});atomic(scheduleFile(),list);}
export function saveSchedule(data){
  if(typeof data.name!=='string'||!data.name.trim()||data.name.length>60)throw Error('Schedule needs a name');
  if(typeof data.prompt!=='string'||!data.prompt.trim()||data.prompt.length>12000)throw Error('Schedule needs project instructions');
  if(!/^[a-zA-Z0-9][\w.:/-]{0,199}$/.test(data.model||''))throw Error('Schedule needs a model');
  new Intl.DateTimeFormat('en-US',{timeZone:data.timeZone}).format();
  if(!Array.isArray(data.times)||!data.times.length||data.times.length>24||data.times.some(t=>!/^([01]\d|2[0-3]):[0-5]\d$/.test(t)))throw Error('Use daily times in HH:MM format');
  const list=readSchedules(),prior=list.find(x=>x.id===data.id);
  const s={id:prior?.id||crypto.randomUUID(),name:data.name.trim(),prompt:data.prompt,model:data.model,template:validateTemplate(data.template),timeZone:data.timeZone,times:[...new Set(data.times)].sort(),enabled:data.enabled===true,createdAt:prior?.createdAt||new Date().toISOString(),lastSlot:prior?.lastSlot||null,lastProject:prior?.lastProject||null,lastError:prior?.lastError||'',updatedAt:new Date().toISOString()};
  writeSchedules([...list.filter(x=>x.id!==s.id),s]);return s;
}
export function dueSlot(s,now=new Date()){
  const parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:s.timeZone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(now).map(x=>[x.type,x.value]));
  const current=parts.hour+':'+parts.minute,time=s.times.filter(t=>t<=current).at(-1);if(!time)return null;
  const minutes=t=>+t.slice(0,2)*60+(+t.slice(3));if(minutes(current)-minutes(time)>60)return null;
  const slot=parts.year+'-'+parts.month+'-'+parts.day+'T'+time;return s.lastSlot===slot?null:slot;
}
export function createScheduler({launch,busy,now=()=>new Date()}){
  let ticking=false;
  async function tick(){if(ticking||busy())return;const lock=scheduleFile()+'.lock';fs.mkdirSync(path.dirname(lock),{recursive:true});let fd;
  try{fd=fs.openSync(lock,'wx');fs.writeFileSync(fd,String(process.pid));}catch(e){if(e.code!=='EEXIST')throw e;try{const pid=Number(fs.readFileSync(lock,'utf8'));if(!Number.isInteger(pid)||pid<=0){if(Date.now()-fs.statSync(lock).mtimeMs>60000)fs.unlinkSync(lock);return;}process.kill(pid,0);}catch(error){if(error.code==='ESRCH')fs.unlinkSync(lock);}return;}
  ticking=true;try{for(const s of readSchedules()){const slot=s.enabled?dueSlot(s,now()):null;if(!slot)continue;
    // Persist claim before launch. A restart never duplicates an uncertain run.
    s.lastSlot=slot;s.lastError='';writeSchedules(readSchedules().map(x=>x.id===s.id?s:x));
    try{s.lastProject=await launch(s);}catch(e){s.lastError=e.message;}
    writeSchedules(readSchedules().map(x=>x.id===s.id?{...x,lastSlot:s.lastSlot,lastProject:s.lastProject,lastError:s.lastError}:x));break;
  }}finally{ticking=false;fs.closeSync(fd);fs.unlinkSync(lock);}}
  const timer=setInterval(()=>tick().catch(()=>{}),15000);timer.unref();return {tick,close:()=>clearInterval(timer)};
}
