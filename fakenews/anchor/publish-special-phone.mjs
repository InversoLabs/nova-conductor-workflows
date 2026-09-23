import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {atomic} from '../../src/workflow.mjs';
import {storedKey} from '../../src/credentials.mjs';
import {config} from '../scripts/newsroom.mjs';
import {settings} from '../social/social.mjs';
import {Instagram,deliver} from '../../newsroom/social/instagram.mjs';
const folder=path.resolve(process.argv[2]);
const file=path.join(folder,'special-phone-delivery.json');
const lock=path.join(folder,'special-phone-publish.lock');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
fs.writeFileSync(lock,String(process.pid),{flag:'wx'});
try {
 const b=JSON.parse(fs.readFileSync(path.join(folder,'bulletin.json')));
 const exports=JSON.parse(fs.readFileSync(path.join(folder,'exports.json')));
 if(b.id!=='human-watch-001'||b.kind!=='special'||!exports.some(x=>x.width===1080&&x.height===1920&&x.decoded))throw Error('Expected reviewed Human Watch phone export');
 const social=settings(),news=config();
 if(!social.enabled||social.username.toLowerCase()!=='theartificialnews'||news.transport!=='local')throw Error('Artificial News publishing is not configured');
 const bytes=fs.readFileSync(path.join(folder,'instagram.mp4'));
 const caption='THE ARTIFICIAL NEWS — Human Watch\n\nVera Volt, Miles Byte and Iris Field investigate humanity: charts that only go up, a dishwasher dispute, and the Moon’s latest advertising opportunity.\n\nAn AI comedy special. Humans remain under observation.\n\n#TheArtificialNews #HumanWatch #AIComedy';
 const videoHash=hash(bytes);
 const record=fs.existsSync(file)?JSON.parse(fs.readFileSync(file)):{status:'preview',accountId:social.accountId,videoHash,caption,thumbOffset:5000,createdAt:new Date().toISOString(),approval:'User requested publication of the existing phone special with Vera cover'};
 if(record.videoHash!==videoHash||record.accountId!==social.accountId||record.caption!==caption)throw Error('Delivery version mismatch');
 atomic(file,record);
 const dest=path.join(news.remoteRoot,'public','specials',b.id);fs.mkdirSync(dest,{recursive:true});
 const target=path.join(dest,'instagram.mp4');
 if(fs.existsSync(target)&&hash(fs.readFileSync(target))!==videoHash)throw Error('Public asset differs');
 if(!fs.existsSync(target)){fs.writeFileSync(target+'.tmp',bytes);fs.renameSync(target+'.tmp',target);}
 const url=news.siteUrl.replace(/\/$/,'')+'/specials/'+b.id+'/instagram.mp4';
 const response=await fetch(url,{signal:AbortSignal.timeout(60000)});
 if(!response.ok||hash(Buffer.from(await response.arrayBuffer()))!==videoHash)throw Error('Public video verification failed');
 class SpecialReel extends Instagram {create(caption,videoUrl){return this.request(this.accountId+'/media',{media_type:'REELS',video_url:videoUrl,caption,share_to_feed:'true',thumb_offset:'5000'},'POST');}}
 const client=new SpecialReel({...social,token:await storedKey('NOVA_ARTIFICIAL_INSTAGRAM_TOKEN')});
 const who=await client.identity();if(who.username.toLowerCase()!=='theartificialnews')throw Error('Wrong account');
 try {await deliver({client,record,save:r=>atomic(file,r),caption,imageUrl:url});}
 catch(e){record.lastError=e.message;atomic(file,record);throw e;}
 if(record.status==='published'){const media=await client.request(record.mediaId,{fields:'id,permalink,media_type,thumbnail_url'});record.permalink=media.permalink;record.thumbnailUrl=media.thumbnail_url;record.lastError='';atomic(file,record);}
 console.log(JSON.stringify({status:record.status,permalink:record.permalink,thumbOffset:record.thumbOffset}));
} finally {fs.unlinkSync(lock);}
