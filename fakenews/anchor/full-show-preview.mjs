import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {withGPU} from '../../newsroom/anchor/gpu.mjs';
import {atomic} from '../../src/workflow.mjs';
import {config as newsroomConfig} from '../scripts/newsroom.mjs';
import {latestHeadlines} from '../../newsroom/anchor/headlines.mjs';
import {castAsset,verifyCast} from './cast.mjs';
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
  if(!bulletinFile)throw Error('A reviewed full-show bulletin is required');
  if(bulletinFile){
    const bulletin=JSON.parse(fs.readFileSync(bulletinFile,'utf8').replace(/^\uFEFF/,''));
    atomic(path.join(output,'bulletin.json'),bulletin);
    atomic(path.join(output,'headlines.json'),bulletin.headlines);
    verifyCast(bulletin);
    status.presenter=bulletin.presenter?.id||'charcoal';save();
  }
  await run(path.join(runtime,'voice/Scripts/python.exe'),[path.join(here,'voice.py'),'--runtime',runtime,'--script',path.join(output,'bulletin.json'),'--output',path.join(output,'voice.wav')]);
  status.status='animating';save();
  const result=path.join(output,'face');fs.mkdirSync(result,{recursive:true});
  const voice=JSON.parse(fs.readFileSync(path.join(output,'voice.json'),'utf8'));
  const masters={};
  await withGPU(async()=>{
    for(const speaker of [...new Set(voice.segments.map(s=>s.speaker))]){
      status.speaker=speaker;save();const dir=path.join(result,speaker);fs.mkdirSync(dir,{recursive:true});
      await run(path.join(runtime,'face/Scripts/python.exe'),['inference.py','--driven_audio',path.join(output,speaker+'.wav'),'--source_image',castAsset(speaker),'--result_dir',dir,'--batch_size','1','--size','256','--preprocess','full','--still'],{cwd:path.join(runtime,'SadTalker'),env:{...process.env,CUDA_VISIBLE_DEVICES:'0',PYTHONUNBUFFERED:'1',PATH:path.join(runtime,'bin')+path.delimiter+process.env.PATH}});
      const files=fs.readdirSync(dir).filter(n=>n.endsWith('.mp4'));if(files.length!==1)throw Error('Expected one lip-sync master for '+speaker);masters[speaker]=path.join(dir,files[0]);
    }
  });
  const clips=[];
  for(const [i,segment] of voice.segments.entries()){
    const clip=path.join(output,'shot-'+i+'.mp4');
    await run(path.join(runtime,'bin/ffmpeg.exe'),['-y','-ss',String(segment.speakerStart),'-i',masters[segment.speaker],'-t',String(segment.end-segment.start),'-vf','scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,setsar=1','-r','25','-c:v','libx264','-preset','fast','-crf','20','-c:a','aac','-ar','48000',clip]);clips.push(clip);
  }
  const concat=path.join(output,'shots.txt');fs.writeFileSync(concat,clips.map(p=>"file '"+p.replaceAll('\\','/')+"'").join('\n'));
  const master=path.join(output,'show-master.mp4');
  await run(path.join(runtime,'bin/ffmpeg.exe'),['-y','-f','concat','-safe','0','-i',concat,'-i',path.join(output,'voice.wav'),'-map','0:v:0','-map','1:a:0','-c:v','copy','-c:a','aac','-shortest',master]);
  status.status='composing';save();
  if(bulletinFile){
    const response=await fetch(newsroomConfig().siteUrl.replace(/\/$/,'')+'/stories.json',{signal:AbortSignal.timeout(20000)});
    if(!response.ok)throw Error('Cannot refresh ticker headlines');
    const news=await response.json();
    const latest=latestHeadlines(news.stories);
    atomic(path.join(output,'headlines.json'),latest.map(story=>story.title));
    atomic(path.join(output,'ticker-sources.json'),{fetchedAt:new Date().toISOString(),stories:latest});
  }
  await run(path.join(runtime,'face/Scripts/python.exe'),[path.join(here,'full-show-compose.py'),'--ffmpeg',path.join(runtime,'bin/ffmpeg.exe'),'--input',master,'--output',output,'--label','HUMAN WATCH','--timeline-json',path.join(output,'voice.json'),'--headlines-json',path.join(output,'headlines.json')]);
  fs.copyFileSync(path.join(here,'preview.html'),path.join(output,'index.html'));
  status.status='PREVIEW_READY';status.finishedAt=new Date().toISOString();save();
  console.log(JSON.stringify(status));
}catch(error){status.status='FAILED';status.error=error.message;save();console.error(error.message);process.exitCode=1;}
