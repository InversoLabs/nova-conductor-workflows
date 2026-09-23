import fs from 'node:fs';
import path from 'node:path';
import {readSchedules,writeSchedules,scheduleFile} from '../src/schedules.mjs';
import {libraryRoot,saveLibrary} from '../src/templates.mjs';
const updated=JSON.parse(fs.readFileSync(new URL('./workflow.example.json',import.meta.url),'utf8'));
const update=t=>({...t,roles:t.roles.map(r=>['WRITER','EDITOR'].includes(r.id)?{...r,prompt:updated.roles.find(x=>x.id===r.id).prompt}:r)});
const file=scheduleFile(),lock=file+'.lock';
fs.writeFileSync(lock,String(process.pid),{flag:'wx'});
try {
 const schedules=readSchedules();
 fs.copyFileSync(file,file+'.before-ai-editorial-'+Date.now());
 writeSchedules(schedules.map(s=>s.template?.id==='FAKENEWS'?{...s,template:update(s.template),prompt:'Produce one comic dispatch by an AI newsroom for other AIs observing humans. Base it on one real world-news event. Keep the source-supported factualSummary separate from the humorous AI interpretation. Publish only after editorial approval; narrate the in-character summary.',updatedAt:new Date().toISOString()}:s));
 const lib=path.join(libraryRoot(),'templates','FAKENEWS.json');
 if(fs.existsSync(lib)){fs.copyFileSync(lib,lib+'.before-ai-editorial-'+Date.now());saveLibrary('templates',update(JSON.parse(fs.readFileSync(lib,'utf8'))));}
 console.log('Updated Artificial News writer/editor voice; preserved schedule times, state, models and robot paths.');
} finally {fs.unlinkSync(lock);}
