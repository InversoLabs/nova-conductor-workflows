import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {atomic} from '../../src/workflow.mjs';
import {storedKey,storeKey} from '../../src/credentials.mjs';
import {config as newsroomConfig} from '../scripts/newsroom.mjs';
import {Instagram,deliver,verifyIdentity} from './instagram.mjs';

export const socialRoot=()=>process.env.NOVA_SOCIAL_HOME||path.join(process.env.LOCALAPPDATA||os.homedir(),'NovaConductor','social');
const read=file=>JSON.parse(fs.readFileSync(file,'utf8'));
const cfgFile=()=>path.join(socialRoot(),'settings.json');
export function settings(){return fs.existsSync(cfgFile())?read(cfgFile()):{enabled:false,accountId:'',username:'',version:'v22.0'};}
const idCheck=id=>{if(!/^[a-f0-9]{20}$/.test(id||''))throw Error('Invalid social story ID');return id;};
const dir=id=>path.join(socialRoot(),'outbox',idCheck(id));
const hash=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
export function listPosts(){const root=path.join(socialRoot(),'outbox');return fs.existsSync(root)?fs.readdirSync(root).filter(id=>/^[a-f0-9]{20}$/.test(id)).flatMap(id=>{try{return [read(path.join(dir(id),'post.json'))];}catch{return [];}}).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)):[];}
export function cardFile(id){return path.join(dir(id),'card.jpg');}
export async function connect({accountId,token,version='v22.0'}){
  accountId=String(accountId??'').trim();token=typeof token==='string'?token.trim():token;
  const client=new Instagram({accountId,token,version}),who=await client.identity();
  verifyIdentity(who,accountId);
  await storeKey('NOVA_INSTAGRAM_TOKEN',token);
  const c={enabled:false,accountId,username:who.username,version,connectedAt:new Date().toISOString()};
  fs.mkdirSync(socialRoot(),{recursive:true});atomic(cfgFile(),c);return c;
}
export async function setEnabled(enabled){const c=settings();if(enabled){const client=new Instagram({...c,token:await storedKey('NOVA_INSTAGRAM_TOKEN')});await client.identity();}c.enabled=enabled===true;fs.mkdirSync(socialRoot(),{recursive:true});atomic(cfgFile(),c);return c;}
export async function publishedStory(work){
  const p=read(path.join(work,'PUBLISHED.json')),c=newsroomConfig();idCheck(p.id);
  if(p.url!==c.siteUrl.replace(/\/$/,'')+'/story/'+p.id+'/')throw Error('Published URL does not match newsroom');
  const response=await fetch(c.siteUrl+'/stories.json',{signal:AbortSignal.timeout(20000)});if(!response.ok)throw Error('Cannot verify published story');
  const story=(await response.json()).stories.find(s=>s.id===p.id);if(!story)throw Error('Story is not publicly published');
  return {...story,url:p.url};
}
export function validateCaption(draft,story){
  if(typeof draft?.caption!=='string'||draft.caption.trim().length<40||[...draft.caption].length>1800)throw Error('Caption must be 40–1800 characters');
  if(/\b(TODO|lorem ipsum|insert caption)\b/i.test(draft.caption))throw Error('Placeholder caption rejected');
  if(!draft.caption.includes(story.url))throw Error('Caption must include the exact article URL');
  const urls=draft.caption.match(/https?:\/\/[^\s]+/g)||[];if(urls.some(u=>u!==story.url))throw Error('Caption contains an unapproved URL');
  return draft.caption.trim();
}
export function completeCaption(draft,story){
  if(typeof draft?.caption!=='string')return validateCaption(draft,story);
  const caption=draft.caption.trim();
  // Only fill a missing link. Never replace or approve an unexpected destination.
  const urls=caption.match(/https?:\/\/[^\s]+/g)||[];
  if(urls.length)return validateCaption(draft,story);
  validateCaption({...draft,caption:caption+'\n\n'+story.url},story);
  return caption+'\n\n'+story.url;
}
export async function prepare(work){const story=await publishedStory(work);atomic(path.join(work,'SOCIAL_SOURCE.json'),story);}
export async function render(work){
  const story=await publishedStory(work),saved=read(path.join(work,'SOCIAL_SOURCE.json'));
  if(hash(story)!==hash(saved))throw Error('Published story changed. Restart social preparation.');
  const draft=read(path.join(work,'SOCIAL.json'));
  const caption=completeCaption(draft,story);
  atomic(path.join(work,'SOCIAL_READY.json'),{...draft,caption});
  execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',fileURLToPath(new URL('./card.ps1',import.meta.url)),'-InputFile',path.join(work,'SOCIAL_SOURCE.json'),'-OutputFile',path.join(work,'SOCIAL_CARD.jpg')],{timeout:30000,windowsHide:true,stdio:'pipe'});
}
export async function queue(work){
  const state=read(path.join(work,'..','state.json')),last=state.runs.filter(r=>r.status==='FINISHED').at(-1);
  if(last?.role!=='SOCIAL_EDITOR'||last.outcome!=='APPROVE')throw Error('Social publication requires the immediately preceding social editor approval');
  const story=await publishedStory(work);if(hash(story)!==hash(read(path.join(work,'SOCIAL_SOURCE.json'))))throw Error('Story changed after preparation');
  const caption=validateCaption(read(path.join(work,fs.existsSync(path.join(work,'SOCIAL_READY.json'))?'SOCIAL_READY.json':'SOCIAL.json')),story),bytes=fs.readFileSync(path.join(work,'SOCIAL_CARD.jpg'));
  if(bytes[0]!==255||bytes[1]!==216||bytes.length>8*1024*1024)throw Error('Expected a JPEG card under 8 MB');
  const folder=dir(story.id);fs.mkdirSync(folder,{recursive:true});const postPath=path.join(folder,'post.json');
  if(!fs.existsSync(postPath)){
    fs.writeFileSync(path.join(folder,'card.jpg'),bytes);
    atomic(postPath,{id:story.id,title:story.title,caption,url:story.url,createdAt:new Date().toISOString(),approvedAt:new Date().toISOString(),cardHash:crypto.createHash('sha256').update(bytes).digest('hex'),status:'preview'});
  }
  else if(read(postPath).caption!==caption)throw Error('This story already has a different approved social post. Existing delivery preserved; inspect it in Social team.');
  if(settings().enabled)await publishPost(story.id);
  atomic(path.join(work,'SOCIAL_RESULT.json'),read(postPath));
}
export async function publishPost(id,{automatic=false}={}){
  const c=settings();if(!c.enabled)throw Error('Instagram publishing is disabled; previews are retained');
  const folder=dir(id),lock=path.join(folder,'delivery.lock');let fd;
  try{fd=fs.openSync(lock,'wx');fs.writeFileSync(fd,String(process.pid));}catch{throw Error('This social delivery is locked. Check the owning process before recovery.');}
  try{
    const postPath=path.join(folder,'post.json'),post=read(postPath);
    if(post.accountId&&post.accountId!==c.accountId)throw Error('This delivery belongs to another Instagram account');
    if(post.status==='published')return post;
    if(!post.approvedAt)throw Error('Missing social editorial approval');
    post.accountId=c.accountId;
    if(automatic&&(post.attempts||0)>=3)throw Error('Automatic delivery attempts exhausted; inspect in Social team');
    post.attempts=automatic?(post.attempts||0)+1:1;
    post.autoRetry=true;post.lastError='';post.nextAttemptAt=new Date(Date.now()+60000*2**post.attempts).toISOString();
    atomic(postPath,post);
    const bytes=fs.readFileSync(cardFile(id));if(crypto.createHash('sha256').update(bytes).digest('hex')!==post.cardHash)throw Error('Reviewed image has changed');
    const news=newsroomConfig();if(news.transport!=='local')throw Error('Instagram publisher must run on the website server with local newsroom transport');
    // Stage only the approved immutable raster. Meta must be able to fetch it publicly.
    const images=path.join(news.remoteRoot,'public','images');fs.mkdirSync(images,{recursive:true});
    const name=`social-${id}-${post.cardHash.slice(0,12)}.jpg`;fs.copyFileSync(cardFile(id),path.join(images,name));
    const imageUrl=news.siteUrl.replace(/\/$/,'')+'/images/'+name;
    const response=await fetch(imageUrl,{signal:AbortSignal.timeout(20000)});
    if(!response.ok||!response.headers.get('content-type')?.startsWith('image/jpeg'))throw Error('Public JPEG verification failed');
    if(crypto.createHash('sha256').update(Buffer.from(await response.arrayBuffer())).digest('hex')!==post.cardHash)throw Error('Public JPEG does not match reviewed image');
    post.accountId=c.accountId;atomic(postPath,post);
    const client=new Instagram({...c,token:await storedKey('NOVA_INSTAGRAM_TOKEN')});
    return await deliver({client,record:post,caption:post.caption,imageUrl,save:p=>atomic(postPath,p)});
  }catch(e){try{const p=path.join(folder,'post.json'),record=read(p);record.lastError=e.message;atomic(p,record);}catch{}throw e;}
  finally{fs.closeSync(fd);fs.unlinkSync(lock);}
}
export function createSocialPump(){
  let busy=false;
  async function tick(){if(busy||!settings().enabled)return;busy=true;try{
    const post=listPosts().find(p=>p.autoRetry&&p.status!=='published'&&(p.attempts||0)<3&&Date.parse(p.nextAttemptAt)<=Date.now());
    if(post)try{await publishPost(post.id,{automatic:true});}catch{/* Durable attempts remain visible; ambiguous publication is only reconciled. */}
  }finally{busy=false;}}
  const timer=setInterval(()=>tick().catch(()=>{}),30000);timer.unref();return {tick,close:()=>clearInterval(timer)};
}
export function recoverLock(id){const lock=path.join(dir(id),'delivery.lock');if(!fs.existsSync(lock))return {recovered:false};const pid=Number(fs.readFileSync(lock,'utf8'));if(!Number.isInteger(pid)||pid<=0)throw Error('Invalid lock; inspect it manually');try{process.kill(pid,0);throw Error('Delivery process is still running');}catch(e){if(e.code!=='ESRCH')throw e;}fs.unlinkSync(lock);return {recovered:true};}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const [command,work=process.cwd()]=process.argv.slice(2);
  try{if(command==='prepare')await prepare(work);else if(command==='render')await render(work);else if(command==='queue')await queue(work);else throw Error('Use prepare, render, or queue');console.log('Social '+command+' completed.');}catch(e){console.error(e.message);process.exitCode=1;}
}
