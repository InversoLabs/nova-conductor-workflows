import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import {spawn,execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {fileURLToPath} from 'node:url';
import {atomic} from '../../src/workflow.mjs';
import {studioBusy,studioLeaseFile} from '../../src/studio-lease.mjs';
import {config} from '../scripts/newsroom.mjs';
import {latestHeadlines} from './headlines.mjs';
import {selectPresenter} from './wardrobe.mjs';
import {publishBulletin,recoverPublishLock} from './publish.mjs';

const here=path.dirname(fileURLToPath(import.meta.url));
export const anchorHome=()=>process.env.NOVA_ANCHOR_HOME||path.join(process.env.LOCALAPPDATA||os.homedir(),'NovaConductor','anchor');
const read=f=>JSON.parse(fs.readFileSync(f,'utf8'));
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
export function alive(pid){if(!Number.isInteger(pid)||pid<1)return false;try{process.kill(pid,0);return true;}catch(e){if(e.code==='ESRCH')return false;throw e;}}
export function automationStatus(){const file=path.join(anchorHome(),'automation.json');return fs.existsSync(file)?read(file):{enabled:false,seen:[],jobs:[]};}
const save=s=>{fs.mkdirSync(anchorHome(),{recursive:true});atomic(path.join(anchorHome(),'automation.json'),s);};
export function anchorRunning(){return automationStatus().jobs.some(j=>alive(j.pid));}
async function stories(){const r=await fetch(config().siteUrl.replace(/\/$/,'')+'/stories.json',{signal:AbortSignal.timeout(20000)});if(!r.ok)throw Error('Published newsroom feed unavailable');const data=await r.json();latestHeadlines(data.stories);return data.stories;}

// Read the already approved published summaries verbatim; no new model claims.
export function makeBulletin(all,trigger,now=new Date(),editionIndex=0){
  const selected=[trigger,...latestHeadlines(all).filter(s=>s.id!==trigger.id)].slice(0,2);
  for(const s of selected)if(!/^[a-f0-9]{20}$/.test(s.id)||typeof s.summary!=='string'||s.summary.length<40||s.summary.length>700||!s.sources?.length||s.sources.some(x=>!x.url?.startsWith('https://')))throw Error('Published briefing lacks usable narration or sources');
  const editionDate=new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',month:'long',day:'numeric',year:'numeric'}).format(now);
  return {id:'edition-'+trigger.id,editionDate,createdAt:now.toISOString(),kind:'scheduled',presenter:selectPresenter(editionIndex),stories:selected,headlines:latestHeadlines(all).map(s=>s.title),segments:[
    {title:'Top Stories | '+editionDate,text:"Hi, I'm Mara Vale with In Signal. Here are the latest briefings from our newsroom."},
    ...selected.map(s=>({title:s.title,storyId:s.id,text:s.summary})),
    {title:'Read more at inversolabs.us/newsroom',text:'Read the full stories and their original sources at Inverso Labs dot U S slash newsroom.'}
  ]};
}
export function verifyNarration(b,voice){
  if(b.kind!=='scheduled'||voice.segments?.length!==b.segments.length)throw Error('Narration does not match approved bulletin');
  let end=0;
  for(let i=0;i<b.segments.length;i++){const s=b.segments[i],v=voice.segments[i];
    if(s.text!==v.text||s.title!==v.title||!Number.isFinite(v.start)||!Number.isFinite(v.end)||Math.abs(v.start-end)>0.01||v.end<=v.start)throw Error('Narration/timing mismatch');
    if(s.storyId&&b.stories.find(x=>x.id===s.storyId)?.summary!==s.text)throw Error('Narration changed a published summary');end=v.end;
  }
  if(Math.abs(end-voice.duration)>0.01||end<5||end>180)throw Error('Invalid bulletin duration');
}
export async function enableAutomation(){const s=automationStatus();if(!s.enabled){s.seen=(await stories()).map(x=>x.id);s.enabled=true;s.enabledAt=new Date().toISOString();save(s);}return s;}

export function createAnchorPump({busy,fetchStories=stories,launch}={}){
  let ticking=false;
  async function tick(){if(ticking)return;ticking=true;let fd;const lock=path.join(anchorHome(),'pump.lock');
    try{const s=automationStatus();if(!s.enabled)return;fs.mkdirSync(anchorHome(),{recursive:true});
      try{fd=fs.openSync(lock,'wx');fs.writeFileSync(fd,String(process.pid));}catch(e){if(e.code!=='EEXIST')throw e;if(!alive(Number(fs.readFileSync(lock,'utf8'))))fs.unlinkSync(lock);return;}
      // An active worker writes only its own status, never this queue.
      for(const j of s.jobs){if(alive(j.pid))continue;const statusFile=path.join(j.folder,'job.json');if(fs.existsSync(statusFile)){const result=read(statusFile);j.status=result.status;j.error=result.error||'';}if(j.status==='running')j.status='pending';if(['pending','retry'].includes(j.status)&&j.attempts>=3)j.status='needs_attention';j.pid=null;}
      if(studioBusy()){
        let lease;try{lease=read(studioLeaseFile());}catch{}
        if(lease&&Number.isInteger(lease.pid)&&!alive(lease.pid)&&!s.jobs.some(j=>alive(j.pid))&&(s.recoveryAttempts||0)<3&&(!s.recoveryAt||Date.parse(s.recoveryAt)<=Date.now())){
          s.recoveryAttempts=(s.recoveryAttempts||0)+1;s.recoveryAt=new Date(Date.now()+300000).toISOString();save(s);
          await promisify(execFile)(process.execPath,[path.join(here,'recover.mjs')],{windowsHide:true,timeout:600000});s.recoveryAttempts=0;s.lastError='';save(s);
        }
      }
      if(busy?.()||studioBusy()||s.jobs.some(j=>alive(j.pid))){save(s);return;}
      const all=await fetchStories();
      const fresh=all.filter(x=>!s.seen.includes(x.id)).sort((a,b)=>Date.parse(a.publishedAt)-Date.parse(b.publishedAt));
      for(const story of fresh){const bulletin=makeBulletin(all,story,new Date(),s.jobs.length+1),folder=path.join(anchorHome(),'editions',bulletin.id);fs.mkdirSync(folder,{recursive:true});if(!fs.existsSync(path.join(folder,'bulletin.json')))atomic(path.join(folder,'bulletin.json'),bulletin);s.jobs.push({id:bulletin.id,folder,presenter:bulletin.presenter.id,status:'pending',attempts:0});s.seen.push(story.id);}
      save(s);
      const job=s.jobs.find(j=>['pending','retry'].includes(j.status)&&(j.attempts||0)<3&&(!j.retryAt||Date.parse(j.retryAt)<=Date.now()));if(!job)return;
      job.status='running';job.attempts++;job.retryAt=new Date(Date.now()+300000).toISOString();save(s);
      const log=fs.openSync(path.join(job.folder,'automation.log'),'a');
      try{const child=launch?launch(job):spawn(process.execPath,[fileURLToPath(import.meta.url),'work',job.folder],{windowsHide:true,detached:true,stdio:['ignore',log,log]});job.pid=child.pid;child.on?.('error',e=>{atomic(path.join(job.folder,'job.json'),{status:'retry',error:e.message});});child.unref?.();}
      finally{fs.closeSync(log);save(s);}
    }catch(e){const s=automationStatus();s.lastError=e.message;save(s);}
    finally{if(fd!==undefined){fs.closeSync(fd);fs.unlinkSync(lock);}ticking=false;}
  }
  const timer=setInterval(()=>tick().catch(()=>{}),30000);timer.unref();return {tick,close:()=>clearInterval(timer)};
}

async function work(folder){
  const lock=path.join(folder,'worker.lock');if(fs.existsSync(lock)){if(alive(Number(fs.readFileSync(lock,'utf8'))))throw Error('Bulletin worker still active');fs.unlinkSync(lock);}fs.writeFileSync(lock,String(process.pid),{flag:'wx'});
  const statusFile=path.join(folder,'job.json');
  try{
    atomic(statusFile,{status:'running',startedAt:new Date().toISOString()});
    let output=path.join(folder,'render');
    if(!fs.existsSync(path.join(output,'status.json'))||read(path.join(output,'status.json')).status!=='PREVIEW_READY'){
      if(studioBusy())throw Error('Studio reservation still active; retain work until recovery');
      // A crashed partial render is preserved, never mistaken for a complete export.
      if(fs.existsSync(output))fs.renameSync(output,path.join(folder,'incomplete-'+Date.now()));
      await new Promise((resolve,reject)=>{const child=spawn(process.execPath,[path.join(here,'preview.mjs'),output,path.join(folder,'bulletin.json')],{windowsHide:true,stdio:'inherit'});child.once('error',reject);child.once('close',c=>c===0?resolve():reject(Error('Render failed; inspect render.log')));});
    }
    const b=read(path.join(output,'bulletin.json')),voice=read(path.join(output,'voice.json'));verifyNarration(b,voice);
    const all=await stories();for(const story of b.stories){const current=all.find(s=>s.id===story.id);if(!current||current.title!==story.title||current.summary!==story.summary||JSON.stringify(current.sources)!==JSON.stringify(story.sources))throw Error('Published story changed during rendering; editorial attention required');}
    const exports=read(path.join(output,'exports.json'));if(exports.some(x=>x.decoded!==true||Math.abs(x.duration-voice.duration)>0.5)||exports.length!==2||!exports.some(x=>x.width===1920&&x.height===1080)||!exports.some(x=>x.width===1080&&x.height===1920))throw Error('Expected both validated video formats');
    const hashes={};for(const name of ['bulletin.json','voice.json','headlines.json','website.mp4','instagram.mp4'])hashes[name]=sha(fs.readFileSync(path.join(output,name)));
    atomic(path.join(output,'review.json'),{outcome:'APPROVE',checkedBy:'Automated published-copy and media checks',checkedAt:new Date().toISOString(),hashes,evidence:['Narration exactly matches published editorial summaries','Measured title timeline matches narration','Both exports decoded successfully by compositor'],limitations:'Uses the previously approved presenter and layout. No human visual inspection of this edition.'});
    recoverPublishLock(output);const delivery=await publishBulletin(output);if(delivery.status!=='published')throw Error('Delivery not yet confirmed');
    atomic(statusFile,{status:'complete',finishedAt:new Date().toISOString(),websiteUrl:delivery.websiteUrl,permalink:delivery.permalink});
  }catch(e){atomic(statusFile,{status:'retry',error:e.message,failedAt:new Date().toISOString()});throw e;}
  finally{fs.unlinkSync(lock);}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const command=process.argv[2];try{if(command==='enable')console.log(JSON.stringify(await enableAutomation()));else if(command==='work')await work(path.resolve(process.argv[3]));else console.log(JSON.stringify(automationStatus()));}catch(e){console.error(e.message);process.exitCode=1;}
}
