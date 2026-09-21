import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';
import {saveLibrary} from '../src/templates.mjs';import {saveSchedule,readSchedules} from '../src/schedules.mjs';import {configFile} from './scripts/newsroom.mjs';
// Local-only configuration. SSH uses the user's existing identity/agent.
const input=process.argv[2];if(!input)throw Error('Usage: node newsroom/setup.mjs LOCAL_CONFIG.json');
const c=JSON.parse(fs.readFileSync(input,'utf8'));for(const key of ['siteUrl','sshHost','remoteRoot','remotePython'])if(typeof c[key]!=='string'||!c[key])throw Error('Missing '+key);
const template=JSON.parse(fs.readFileSync(new URL('./workflow.example.json',import.meta.url),'utf8'));
for(const r of template.roles)if(r.kind==='robot'){r.robot.command=process.execPath;r.robot.args[0]=fileURLToPath(new URL('./scripts/newsroom.mjs',import.meta.url));}
fs.mkdirSync(path.dirname(configFile()),{recursive:true});fs.writeFileSync(configFile(),JSON.stringify(c,null,2));console.log('Workflow saved:',saveLibrary('templates',template));
const previous=readSchedules().find(s=>s.template.id==='NEWSROOM');
const schedule=saveSchedule({id:previous?.id,name:'Newsroom edition',prompt:'Publish one accurate, useful AI technology news briefing from fresh primary sources. Attribute company claims and hold publication if evidence or editorial review is insufficient.',model:c.model||'gpt-oss:20b',template,timeZone:'America/Los_Angeles',times:['08:00','17:00'],enabled:c.enableSchedule===true});console.log('Twice-daily schedule:',schedule.enabled?'enabled':'paused');
