import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {atomic} from '../../src/workflow.mjs';
import {storedKey} from '../../src/credentials.mjs';
import {config,esc} from '../scripts/newsroom.mjs';
import {settings} from '../social/social.mjs';
import {deliver} from '../social/instagram.mjs';
import {InstagramReels} from './instagram-reels.mjs';
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
export function reviewedAssets(folder){
  const review=JSON.parse(fs.readFileSync(path.join(folder,'review.json'),'utf8'));
  if(review.outcome!=='APPROVE'||!review.checkedBy||!review.checkedAt)throw Error('Rendered bulletin needs a completed content and visual review');
  const assets={};for(const name of ['bulletin.json','voice.json','headlines.json','website.mp4','instagram.mp4']){
    const bytes=fs.readFileSync(path.join(folder,name));if(sha(bytes)!==review.hashes?.[name])throw Error('Reviewed artifact changed: '+name);assets[name]=bytes;
  }
  return {assets,review};
}
export function recoverPublishLock(folder){
  const lock=path.join(folder,'publish.lock');if(!fs.existsSync(lock))return false;
  const pid=Number(fs.readFileSync(lock,'utf8'));if(!Number.isInteger(pid)||pid<1)throw Error('Invalid publication lock; inspect it manually');
  try{process.kill(pid,0);throw Error('Publisher is still running');}catch(error){if(error.code!=='ESRCH')throw error;}
  fs.unlinkSync(lock);return true;
}
export async function publishBulletin(folder){
  const lock=path.join(folder,'publish.lock');fs.writeFileSync(lock,String(process.pid),{flag:'wx'});
  const recordFile=path.join(folder,'delivery.json');let record;
  try{
    const {assets,review}=reviewedAssets(folder),b=JSON.parse(assets['bulletin.json']),news=config(),social=settings();
    if(!/^[a-z0-9-]{1,80}$/.test(b.id)||news.transport!=='local')throw Error('Bulletin needs a valid ID and server-local publishing');
    if(!social.enabled)throw Error('Instagram publishing is disabled');
    const folderHash=sha(assets['bulletin.json']);
    const site=news.siteUrl.replace(/\/$/,''),url=site+'/bulletins/'+b.id+'/';
    const caption=`IN/SIGNAL with Mara Vale | ${b.editionDate}\n${b.kind==='scheduled'?'The latest briefings from our newsroom.':'Launch-edition studio test: two stories from our newsroom.'}\n\n${b.stories.map(s=>s.title).join('\n')}\n\nWatch and read the sources: ${url}`;
    record=fs.existsSync(recordFile)?JSON.parse(fs.readFileSync(recordFile,'utf8')):{id:b.id,status:'preview',accountId:social.accountId,caption,bulletinHash:folderHash,videoHash:sha(assets['instagram.mp4']),createdAt:new Date().toISOString()};
    if(record.accountId!==social.accountId||record.caption!==caption||record.bulletinHash!==folderHash||record.videoHash!==sha(assets['instagram.mp4']))throw Error('Existing delivery belongs to a different account or bulletin version');
    atomic(recordFile,record);
    const destination=path.join(news.remoteRoot,'public','bulletins',b.id);fs.mkdirSync(destination,{recursive:true});
    for(const name of ['website.mp4','instagram.mp4']){
      const target=path.join(destination,name);
      if(fs.existsSync(target)&&sha(fs.readFileSync(target))!==sha(assets[name]))throw Error('Published video already exists with different content; use a new bulletin ID');
      if(!fs.existsSync(target)){fs.writeFileSync(target+'.tmp',assets[name]);fs.renameSync(target+'.tmp',target);}
    }
    const links=b.stories.map(s=>`<li><a href="${site}/story/${esc(s.id)}/">${esc(s.title)}</a><ul>${s.sources.map(source=>`<li><a href="${esc(source.url)}" rel="noopener noreferrer">${esc(source.name)} — original source</a></li>`).join('')}</ul></li>`).join('');
    const html=`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Top Stories | ${esc(b.editionDate)} — IN/SIGNAL</title><link rel="stylesheet" href="/newsroom/style.css"><main style="max-width:1100px;margin:40px auto;padding:24px"><a href="/newsroom/">← IN / SIGNAL newsroom</a><h1 style="margin:24px 0">Top Stories · ${esc(b.editionDate)}</h1><p>With Mara Vale${b.kind==='scheduled'?'':' · Launch-edition studio test'}</p><video controls playsinline preload="metadata" style="width:100%;background:#0d1b1b" src="website.mp4"></video><p><a href="instagram.mp4">Watch the vertical edition ↗</a></p><h2>In this bulletin</h2><ul>${links}</ul><p>Based on our published source-linked briefings. Company statements are attributed; this is not independent testing of their claims.</p></main></html>`;
    fs.writeFileSync(path.join(destination,'index.next.html'),html);fs.renameSync(path.join(destination,'index.next.html'),path.join(destination,'index.html'));
    for(const name of ['website.mp4','instagram.mp4']){
      const response=await fetch(url+name,{signal:AbortSignal.timeout(60000)});
      if(!response.ok||!response.headers.get('content-type')?.startsWith('video/mp4')||sha(Buffer.from(await response.arrayBuffer()))!==sha(assets[name]))throw Error('Public video verification failed: '+name);
    }
    const latestFile=path.join(news.remoteRoot,'public','bulletins','latest.json');
    const latest=fs.existsSync(latestFile)?JSON.parse(fs.readFileSync(latestFile,'utf8')):null;
    if(!latest||Date.parse(latest.editionCreatedAt||latest.publishedAt)<=Date.parse(b.createdAt||record.createdAt))atomic(latestFile,{id:b.id,date:b.editionDate,url,video:url+'website.mp4',title:'Top Stories',publishedAt:new Date().toISOString(),editionCreatedAt:b.createdAt||record.createdAt});
    record.websiteUrl=url;record.websiteVerifiedAt=new Date().toISOString();record.reviewedAt=review.checkedAt;atomic(recordFile,record);
    const client=new InstagramReels({...social,token:await storedKey('NOVA_INSTAGRAM_TOKEN')});
    for(let attempt=0;attempt<10;attempt++){
      try{await deliver({client,record,save:value=>atomic(recordFile,value),caption,imageUrl:url+'instagram.mp4'});break;}
      catch(error){record.lastError=error.message;atomic(recordFile,record);if(record.status!=='processing'||attempt===9)throw error;await new Promise(resolve=>setTimeout(resolve,15000));}
    }
    if(record.status==='published'&&!record.permalink){const media=await client.request(record.mediaId,{fields:'id,permalink,media_type'});record.permalink=media.permalink;record.mediaType=media.media_type;record.lastError='';atomic(recordFile,record);}
    return record;
  }catch(error){if(record){record.lastError=error.message;atomic(recordFile,record);}throw error;}
  finally{fs.unlinkSync(lock);}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  if(process.argv[2]==='--recover-lock')console.log(JSON.stringify({recovered:recoverPublishLock(path.resolve(process.argv[3]))}));
  else publishBulletin(path.resolve(process.argv[2])).then(record=>console.log(JSON.stringify(record))).catch(error=>{console.error(error.message);process.exitCode=1;});
}
