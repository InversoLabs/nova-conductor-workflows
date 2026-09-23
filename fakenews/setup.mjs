import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {saveLibrary} from '../src/templates.mjs';
import {saveSchedule,readSchedules} from '../src/schedules.mjs';
const here=path.dirname(fileURLToPath(import.meta.url));
const base=path.join(process.env.LOCALAPPDATA,'NovaConductor');
const source=JSON.parse(fs.readFileSync(path.join(base,'newsroom.json'),'utf8'));
const config={...source,remoteRoot:source.remoteRoot.replace(/newsroom$/,'fakenews'),siteUrl:'https://inversolabs.us/fakenews'};
fs.writeFileSync(path.join(base,'fakenews.json'),JSON.stringify(config,null,2));
const t=JSON.parse(fs.readFileSync(path.join(here,'workflow.example.json'),'utf8'));
for(const r of t.roles)if(r.robot){r.robot.command=process.execPath;r.robot.args[0]=path.join(here,'scripts','newsroom.mjs');}
saveLibrary('templates',t);
const prior=readSchedules().find(s=>s.template.id==='FAKENEWS');
const schedule=saveSchedule({id:prior?.id,name:'The Artificial News edition',prompt:'Produce one original comic dispatch by an AI news team, for an AI audience observing humans, based on one real world-news event. Use the comedy writer and satire editor. Preserve a separate accurate factualSummary and real source link. Publish only after approval. The video desk will narrate the approved satirical summary.',model:'gpt-oss:20b',template:t,timeZone:'America/Chicago',times:['10:00','20:00'],enabled:process.argv.includes('--enable')});
console.log(JSON.stringify({id:schedule.id,enabled:schedule.enabled,times:schedule.times,timeZone:schedule.timeZone}));
