import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {withGPU,activeControllers} from '../../newsroom/anchor/gpu.mjs';
import {studioLeaseFile} from '../../src/studio-lease.mjs';
import {atomic} from '../../src/workflow.mjs';
import {config as newsroomConfig} from '../scripts/newsroom.mjs';
import {latestHeadlines} from '../../newsroom/anchor/headlines.mjs';
import {castAsset,verifyCast} from './cast.mjs';
const here=path.dirname(fileURLToPath(import.meta.url)),base=path.resolve(here,'../..');
const runtime=path.join(base,'runtime','anchor'),output=path.resolve(process.argv[2]||path.join(base,'.nova-trials','anchor-preview'));
const bulletinFile=process.argv[3]?path.resolve(process.argv[3]):null;
const production=bulletinFile?JSON.parse(fs.readFileSync(bulletinFile,'utf8').replace(/^\uFEFF/,'')):{};
const reuse=process.argv[4]?path.resolve(process.argv[4]):null;
if(reuse===output)throw Error('Use a new output directory for revisions');
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
  if(reuse)verifyCast(JSON.parse(fs.readFileSync(path.join(reuse,'bulletin.json'),'utf8')));
  await run(path.join(runtime,'voice/Scripts/python.exe'),[path.join(here,'voice.py'),'--runtime',runtime,'--script',path.join(output,'bulletin.json'),'--output',path.join(output,'voice.wav'),...(reuse?['--reuse',reuse]:[])]);
  if(production.endCard){const measured=JSON.parse(fs.readFileSync(path.join(output,'voice.json'),'utf8')).duration;const remaining=production.targetDuration-3-measured;if(remaining<1||remaining>4)throw Error('Narration timing needs review before lip sync: '+measured+' seconds');}
  const waitUntil=Date.now()+3*60*60000;
  while(fs.existsSync(studioLeaseFile())||activeControllers()){
    status.status='waiting_for_studio';save();
    if(interrupted||Date.now()>waitUntil)throw Error('Studio remained busy; render safely held');
    await new Promise(resolve=>setTimeout(resolve,30000));
  }
  status.status='animating';save();
  const result=path.join(output,'face');fs.mkdirSync(result,{recursive:true});
  const voice=JSON.parse(fs.readFileSync(path.join(output,'voice.json'),'utf8'));
  const masters={};
  await withGPU(async()=>{
    for(const speaker of [...new Set(voice.segments.map(s=>s.speaker))]){
      if(reuse&&speaker!=='iris'){const oldDir=path.join(reuse,'face',speaker);const files=fs.readdirSync(oldDir).filter(n=>n.endsWith('.mp4'));if(files.length!==1)throw Error('Missing reusable master for '+speaker);masters[speaker]=path.join(oldDir,files[0]);continue;}
      status.speaker=speaker;save();const dir=path.join(result,speaker);fs.mkdirSync(dir,{recursive:true});
      await run(path.join(runtime,'face/Scripts/python.exe'),['inference.py','--driven_audio',path.join(output,speaker+'.wav'),'--source_image',castAsset(speaker),'--result_dir',dir,'--batch_size','1','--size','256','--preprocess','full','--still'],{cwd:path.join(runtime,'SadTalker'),env:{...process.env,CUDA_VISIBLE_DEVICES:'0',PYTHONUNBUFFERED:'1',PATH:path.join(runtime,'bin')+path.delimiter+process.env.PATH}});
      const files=fs.readdirSync(dir).filter(n=>n.endsWith('.mp4'));if(files.length!==1)throw Error('Expected one lip-sync master for '+speaker);masters[speaker]=path.join(dir,files[0]);
    }
  });
  const clips=[];
  for(const [i,segment] of voice.segments.entries()){
    const clip=path.join(output,'shot-'+i+'.mp4');
    segment.frameStart=Math.round(segment.start*25);segment.frameEnd=Math.round(segment.end*25);
    const frames=segment.frameEnd-segment.frameStart;
    await run(path.join(runtime,'bin/ffmpeg.exe'),['-y','-ss',String(segment.speakerStart),'-i',masters[segment.speaker],'-frames:v',String(frames),'-vf','scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=25,tpad=stop_mode=clone:stop_duration=1','-r','25','-c:v','libx264','-preset','fast','-crf','20','-an',clip]);clips.push(clip);
  }
  atomic(path.join(output,'voice.json'),voice);
  const concat=path.join(output,'shots.txt');fs.writeFileSync(concat,clips.map(p=>"file '"+p.replaceAll('\\','/')+"'").join('\n'));
  const master=path.join(output,'show-master.mp4');
  await run(path.join(runtime,'bin/ffmpeg.exe'),['-y','-f','concat','-safe','0','-i',concat,'-i',path.join(output,'voice.wav'),'-map','0:v:0','-map','1:a:0','-c:v','copy','-c:a','aac','-shortest',master]);
  status.status='composing';save();
  if(bulletinFile&&production.kind!=='special'){
    const response=await fetch(newsroomConfig().siteUrl.replace(/\/$/,'')+'/stories.json',{signal:AbortSignal.timeout(20000)});
    if(!response.ok)throw Error('Cannot refresh ticker headlines');
    const news=await response.json();
    const latest=latestHeadlines(news.stories);
    atomic(path.join(output,'headlines.json'),latest.map(story=>story.title));
    atomic(path.join(output,'ticker-sources.json'),{fetchedAt:new Date().toISOString(),stories:latest});
  }
  await run(path.join(runtime,'face/Scripts/python.exe'),[path.join(here,'full-show-compose.py'),'--ffmpeg',path.join(runtime,'bin/ffmpeg.exe'),'--input',master,'--output',output,'--label',production.titleLabel||'HUMAN WATCH','--timeline-json',path.join(output,'voice.json'),'--headlines-json',path.join(output,'headlines.json')]);
  fs.copyFileSync(path.join(here,'preview.html'),path.join(output,'index.html'));
  status.status='PREVIEW_READY';status.finishedAt=new Date().toISOString();save();
  console.log(JSON.stringify(status));
}catch(error){status.status='FAILED';status.error=error.message;save();console.error(error.message);process.exitCode=1;}
