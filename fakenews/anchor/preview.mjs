import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {withGPU} from '../../newsroom/anchor/gpu.mjs';
import {atomic} from '../../src/workflow.mjs';
import {config as newsroomConfig} from '../scripts/newsroom.mjs';
import {latestHeadlines} from '../../newsroom/anchor/headlines.mjs';
import {presenterAsset} from '../../newsroom/anchor/wardrobe.mjs';
const here=path.dirname(fileURLToPath(import.meta.url)),base=path.resolve(here,'../..');
const runtime=path.join(base,'runtime','anchor'),output=path.resolve(process.argv[2]||path.join(base,'.nova-trials','anchor-preview'));
const bulletinFile=process.argv[3]?path.resolve(process.argv[3]):null;
fs.mkdirSync(output,{recursive:true});
const status={startedAt:new Date().toISOString(),status:'voice',preview:!bulletinFile};
const save=()=>atomic(path.join(output,'status.json'),status);
let interrupted=false,activeChild;
function stopChild(){if(activeChild?.pid){const killer=spawn('taskkill',['/PID',String(activeChild.pid),'/T','/F'],{windowsHide:true,stdio:'ignore'});killer.on('error',()=>activeChild?.kill());}}
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{interrupted=true;stopChild();});
function run(exe,args,{cwd=here,timeout=90*60000,env=process.env}={}){
  return new Promise((resolve,reject)=>{
    if(interrupted){reject(Error('Preview interrupted'));return;}
    const log=fs.openSync(path.join(output,'render.log'),'a');
    const child=spawn(exe,args,{cwd,env,windowsHide:true,stdio:['ignore',log,log]});fs.closeSync(log);
    activeChild=child;
    const timer=setTimeout(()=>{const killer=spawn('taskkill',['/PID',String(child.pid),'/T','/F'],{windowsHide:true,stdio:'ignore'});killer.on('error',()=>child.kill());},timeout);
    child.once('error',error=>{clearTimeout(timer);reject(error);});
    child.once('close',code=>{activeChild=null;clearTimeout(timer);code===0&&!interrupted?resolve():reject(Error(path.basename(exe)+' exited '+code+'; see render.log'));});
  });
}
try{
  if(fs.readFileSync(path.join(runtime,'setup-status.txt'),'utf8').trim()!=='READY')throw Error('Finish Setup-Anchor.ps1 first');
  save();
  let presenter=presenterAsset();
  if(bulletinFile){
    const bulletin=JSON.parse(fs.readFileSync(bulletinFile,'utf8').replace(/^\uFEFF/,''));
    atomic(path.join(output,'bulletin.json'),bulletin);
    atomic(path.join(output,'headlines.json'),bulletin.headlines);
    presenter=presenterAsset(bulletin.presenter);
    status.presenter=bulletin.presenter?.id||'charcoal';save();
  }
  await run(path.join(runtime,'voice/Scripts/python.exe'),[path.join(here,'../../newsroom/anchor/voice.py'),'--runtime',runtime,'--script',bulletinFile?path.join(output,'bulletin.json'):path.join(here,'preview.txt'),'--output',path.join(output,'voice.wav')]);
  status.status='animating';save();
  const result=path.join(output,'face');fs.mkdirSync(result,{recursive:true});
  await withGPU(async()=>{
    await run(path.join(runtime,'face/Scripts/python.exe'),['inference.py','--driven_audio',path.join(output,'voice.wav'),'--source_image',presenter,'--result_dir',result,'--batch_size','1','--size','256','--preprocess','full','--still'],{cwd:path.join(runtime,'SadTalker'),env:{...process.env,CUDA_VISIBLE_DEVICES:'0',PYTHONUNBUFFERED:'1',PATH:path.join(runtime,'bin')+path.delimiter+process.env.PATH}});
  });
  const masters=fs.readdirSync(result).filter(name=>name.endsWith('.mp4'));
  if(masters.length!==1)throw Error('Expected exactly one lip-sync master; use a fresh output folder');
  status.status='composing';save();
  if(bulletinFile){
    const response=await fetch(newsroomConfig().siteUrl.replace(/\/$/,'')+'/stories.json',{signal:AbortSignal.timeout(20000)});
    if(!response.ok)throw Error('Cannot refresh ticker headlines');
    const news=await response.json();
    const latest=latestHeadlines(news.stories);
    atomic(path.join(output,'headlines.json'),latest.map(story=>story.title));
    atomic(path.join(output,'ticker-sources.json'),{fetchedAt:new Date().toISOString(),stories:latest});
  }
  await run(path.join(runtime,'face/Scripts/python.exe'),[path.join(here,'compose.py'),'--ffmpeg',path.join(runtime,'bin/ffmpeg.exe'),'--input',path.join(result,masters[0]),'--output',output,'--label','THE DAILY NONSENSE',...(bulletinFile?['--timeline-json',path.join(output,'voice.json'),'--headlines-json',path.join(output,'headlines.json')]:[])]);
  fs.copyFileSync(path.join(here,'preview.html'),path.join(output,'index.html'));
  status.status='PREVIEW_READY';status.finishedAt=new Date().toISOString();save();
  console.log(JSON.stringify(status));
}catch(error){status.status='FAILED';status.error=error.message;save();console.error(error.message);process.exitCode=1;}
