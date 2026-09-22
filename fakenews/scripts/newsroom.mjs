import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
export const configFile=()=>process.env.NOVA_FAKENEWS_CONFIG||path.join(process.env.LOCALAPPDATA||os.homedir(),'NovaConductor','fakenews.json');
export const config=()=>JSON.parse(fs.readFileSync(configFile(),'utf8'));
export const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
export const idFor=url=>crypto.createHash('sha256').update(url).digest('hex').slice(0,20);
const decode=s=>s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,'$1').replace(/<[^>]*>/g,' ').replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(+n)).replace(/&#x([a-f0-9]+);/gi,(_,n)=>String.fromCodePoint(parseInt(n,16))).replace(/&quot;/g,'"').replace(/&apos;|&#39;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&').replace(/\s+/g,' ').trim();
const field=(xml,name)=>decode(xml.match(new RegExp('<'+name+'(?:\\s[^>]*)?>([\\s\\S]*?)</'+name+'>','i'))?.[1]||'');
export async function fetchSources(){
  const feeds=[['BBC World','https://feeds.bbci.co.uk/news/world/rss.xml','World'],['The Guardian World','https://www.theguardian.com/world/rss','World']];
  const all=[],errors=[];
  for(const [name,url,category]of feeds)try{
    const response=await fetch(url,{signal:AbortSignal.timeout(20000)});if(!response.ok)throw Error('HTTP '+response.status);const xml=await response.text();if(xml.length>6000000)throw Error('Feed too large');
    for(const match of xml.matchAll(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/g)){
      const item=match[1],link=field(item,'link'),title=field(item,'title'),publishedAt=new Date(field(item,'pubDate'));
      if(!link.startsWith('https://')||!title||!Number.isFinite(+publishedAt)||Date.now()-publishedAt>14*86400000||publishedAt>Date.now()+86400000)continue;
      const host=new URL(link).hostname;if(!['www.bbc.com','www.bbc.co.uk','bbc.com','www.theguardian.com'].includes(host))continue;
      all.push({id:idFor(link),name:host==='huggingface.co'&&new URL(link).pathname.split('/').length>3?'Hugging Face community / '+new URL(link).pathname.split('/')[2]:name,url:link,title,category,publishedAt:publishedAt.toISOString(),excerpt:(field(item,'description')||field(item,'content:encoded')).slice(0,5000)});
    }
  }catch(e){errors.push(name+': '+e.message);}
  if(!all.length)throw Error('No fresh primary-source material. '+errors.join('; '));
  return {fetchedAt:new Date().toISOString(),sources:all.sort((a,b)=>b.publishedAt.localeCompare(a.publishedAt)),errors};
}
export function validateStory(s,sources){
  if(!s||typeof s.title!=='string'||s.title.length<15||s.title.length>180||typeof s.summary!=='string'||s.summary.length<40||s.summary.length>700)throw Error('Story requires a specific title and summary');
  if(!['World','Politics','Society','Science'].includes(s.category))throw Error('Invalid story category');
  if(!Array.isArray(s.paragraphs)||s.paragraphs.length<2||s.paragraphs.length>12||s.paragraphs.some(p=>typeof p!=='string'||p.length<30||p.length>2500))throw Error('Provide 2–12 complete paragraphs');
  if(!Array.isArray(s.sources)||!s.sources.length||s.sources.some(x=>!sources.some(a=>a.url===x.url)))throw Error('Story must cite the collected primary sources');
  if(typeof s.factualSummary!=='string'||s.factualSummary.length<40||s.factualSummary.length>500)throw Error('Provide factualSummary: a short factual account separate from fictional satire');
  const text=[s.title,s.summary,...s.paragraphs].join(' ');if(/\b(TODO|lorem ipsum|insert (?:title|text)|as an AI language model)\b/i.test(text))throw Error('Placeholder story rejected');
  const bodyWords=s.paragraphs.join(' ').trim().split(/\s+/).length;if(bodyWords>180)throw Error('Briefing body is '+bodyWords+' words; shorten it to at most 180 without removing citations or attribution');
  const normalize=v=>v.toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();for(const match of text.matchAll(/(?:paper|study|report)\s+(?:titled|called)\s*["“]([^"”]+)["”]/gi)){if(sources.some(source=>normalize(source.title||'')===normalize(match[1])))throw Error('Do not present a blog headline as a paper title. Use the actual paper title in the source or describe the blog announcement without naming a paper');}
  const words=text.toLowerCase().match(/[a-z0-9]+/g)||[];for(const source of sources){const original=(source.excerpt||'').toLowerCase().replace(/[^a-z0-9]+/g,' ');for(let i=0;i+18<=words.length;i++)if(original.includes(words.slice(i,i+18).join(' ')))throw Error('Story copies a long source passage; rewrite it in original language');}
  return {...s,id:idFor(s.sources[0].url),sources:s.sources.map(x=>({name:sources.find(a=>a.url===x.url).name,url:x.url})),format:'BRIEFING',priority:0,publishedAt:new Date().toISOString(),imageAlt:'Fictional satirical illustration of an absurd newsroom',disclosure:'SATIRE: Fictional comedy inspired by the linked real source. Invented scenes and dialogue are jokes, not reported events.'};
}
export function illustration(s, fallback = null){
  const seed=parseInt(s.id.slice(0,6),16),h=seed%100+140;let shapes='';
  for(let i=0;i<14;i++){const x=100+(i*127+seed)%850,y=80+(i*73+seed)%410;shapes+=`<circle cx="${x}" cy="${y}" r="${20+(i*17)%70}" fill="none" stroke="hsl(${h+i*3},70%,65%)" stroke-opacity=".3"/><path d="M600 320L${x} ${y}" stroke="#a8eaa3" stroke-opacity=".12"/>`;}
  const title=s.title.toLowerCase();let motif='';
  if(/math|physic|prun|research/.test(title)){for(let j=0;j<17;j++){let d='';for(let x=-380;x<=380;x+=8){const y=Math.sin(x/100+j*.17)*75+Math.cos(x/160)*j*5+j*4-70;d+=(x===-380?'M':'L')+(600+x)+' '+(320+y);}motif+=`<path d="${d}" fill="none" stroke="hsl(${h+j*3},80%,${50+j}%)" stroke-width="2"/>`;}motif+='<text x="490" y="185" fill="#edf8d4" font-size="52" font-family="Georgia,serif">∑  ∂  ∞</text>';}
  else if(/fashion|design/.test(title)){for(let j=0;j<13;j++){const x=470+j*18;motif+=`<path d="M${x} 130 Q${600+(j-6)*25} 270 ${450+j*24} 500 Q600 560 ${750-j*24} 500 Q${600-(j-6)*25} 270 ${730-j*18} 130" fill="none" stroke="hsl(${280+j*5},65%,70%)" stroke-width="2"/>`;}motif+='<circle cx="600" cy="105" r="34" fill="none" stroke="#dfcafa" stroke-width="2"/>';}
  else if(/econom|data|global/.test(title)){motif='<circle cx="610" cy="315" r="190" fill="#aee77e" fill-opacity=".03" stroke="#b2ef96" stroke-width="2"/>';for(let i=-3;i<=3;i++){motif+=`<ellipse cx="610" cy="315" rx="${50+Math.abs(i)*45}" ry="190" fill="none" stroke="#8ae0b0" stroke-opacity=".45"/><ellipse cx="610" cy="${315+i*43}" rx="${Math.sqrt(190*190-i*i*43*43)}" ry="28" fill="none" stroke="#8ae0b0" stroke-opacity=".3"/>`;}motif+='<path d="M260 420L390 350L470 385L590 230L700 270L850 145" fill="none" stroke="#d8ff36" stroke-width="6"/>';}
  else if(/standard|safety|review/.test(title)){for(let i=0;i<9;i++){const x=390+i%3*145,y=120+Math.floor(i/3)*145;motif+=`<rect x="${x}" y="${y}" width="115" height="115" rx="15" fill="#a3e2cb" fill-opacity=".07" stroke="#95d6bd"/><path d="M${x+25} ${y+58}l20 20 45-45" fill="none" stroke="#d8ff36" stroke-width="5"/>`;}}
  else if((fallback ?? seed%3)===1){
    // Layered token tiles: a distinct visual for the general AI fallback pool.
    for(let row=0;row<3;row++)for(let col=0;col<5;col++){
      const x=235+col*150+row*22,y=165+row*115;
      motif+=`<rect x="${x}" y="${y}" width="125" height="82" rx="14" fill="hsl(${h+row*25},45%,25%)" stroke="#a6dfef" stroke-width="2"/><path d="M${x+22} ${y+30}h65 M${x+22} ${y+48}h40" stroke="#d8ff36" stroke-width="5"/>`;
    }
    motif='<g data-fallback="tokens">'+motif+'</g>';
  }
  else if((fallback ?? seed%3)===2){
    // Neural constellation: three connected layers, rather than another chip.
    const nodes=[];for(let layer=0;layer<3;layer++)for(let row=0;row<4;row++)nodes.push([330+layer*270,155+row*105,layer]);
    for(const [x,y,l] of nodes)for(const [nx,ny,nl] of nodes)if(nl===l+1)motif+=`<path d="M${x} ${y}L${nx} ${ny}" stroke="#76c9da" stroke-opacity=".5" stroke-width="2"/>`;
    for(const [x,y,l] of nodes)motif+=`<circle cx="${x}" cy="${y}" r="27" fill="hsl(${h+l*30},50%,28%)" stroke="#d8ff36" stroke-width="3"/><circle cx="${x}" cy="${y}" r="7" fill="#e3f9c7"/>`;
    motif='<g data-fallback="network">'+motif+'</g>';
  }
  else {motif='<rect x="440" y="155" width="320" height="320" rx="24" fill="#adc9ff" fill-opacity=".06" stroke="#a1c9f4" stroke-width="3"/><rect x="485" y="200" width="230" height="230" rx="10" fill="#759eff" fill-opacity=".12" stroke="#b3d5fc"/>';for(let i=0;i<8;i++){const a=465+i*38;motif+=`<path d="M${a} 90V150 M${a} 480V555 M375 ${180+i*38}H435 M765 ${180+i*38}H835" stroke="#a1c9f4" stroke-width="4"/>`;}motif+='<text x="533" y="340" font-family="monospace" font-size="85" fill="#d8ff36">AI</text>';}
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="750" viewBox="0 0 1200 750"><defs><radialGradient id="g"><stop stop-color="hsl(${h},35%,27%)"/><stop offset="1" stop-color="#0d1b1b"/></radialGradient><pattern id="p" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M40 0H0V40" fill="none" stroke="#b5dfac" stroke-opacity=".07"/></pattern></defs><rect width="1200" height="750" fill="url(#g)"/><rect width="1200" height="750" fill="url(#p)"/>${shapes}${motif}<text x="60" y="65" fill="#d8ff36" font-family="monospace" font-size="18" letter-spacing="4">THE ARTIFICIAL NEWS / SATIRE — ${esc(s.category.toUpperCase())}</text><text x="60" y="665" fill="#dce6d9" font-family="Arial,sans-serif" font-size="30">${esc(s.title.slice(0,65))}</text><text x="60" y="706" fill="#879d91" font-family="monospace" font-size="13" letter-spacing="3">FICTIONAL ILLUSTRATION / SATIRE</text></svg>`;
}
export async function enrichSources(sources){for(const source of sources){try{const r=await fetch(source.url,{signal:AbortSignal.timeout(15000)});if(r.ok){const html=await r.text();const article=html.includes('class="blog-content')?html.slice(html.indexOf('class="blog-content')).slice(0,65000):html.match(/<article[\s>][\s\S]*?<\/article>/i)?.[0]||html.match(/<main[\s>][\s\S]*?<\/main>/i)?.[0]||'';if(article){const clean=article.replace(/<(script|style)[\s>][\s\S]*?<\/\1>/gi,'');source.excerpt=decode(clean).slice(0,6500);}}}catch{}}return sources;}
export async function collect(work){
 const c=config(),response=await fetch(c.siteUrl+'/stories.json');if(!response.ok)throw Error('Publication feed unavailable');const edition=await response.json(),feed=await fetchSources();
 feed.sources=feed.sources.filter(s=>!edition.stories.some(a=>a.sources.some(x=>x.url===s.url))&&!/\b(kill|killed|dead|death|murder|rape|abuse|war|missile|bomb|shooting|earthquake|flood|victim|casualties)\b/i.test(s.title)).slice(0,8);
 await enrichSources(feed.sources);feed.sources=feed.sources.filter(s=>s.excerpt.length>500).slice(0,3).map(s=>({...s,excerpt:s.excerpt.slice(0,4500)}));if(!feed.sources.length)throw Error('No suitable sourced comedy topic. Edition held.');
 fs.writeFileSync(path.join(work,'SOURCES.json'),JSON.stringify(feed,null,2));console.log('Collected '+feed.sources.length+' real-news sources for satire.');
}
export function invokePublisher(c,args){
  if(c.transport==='local')return execFileSync(c.remotePython,[path.join(c.remoteRoot,'publish.py'),...args],{timeout:120000,encoding:'utf8',windowsHide:true});
  const q=s=>"'"+s.replaceAll("'","''")+"'";
  const script="$ErrorActionPreference='Stop';$ProgressPreference='SilentlyContinue';& "+[c.remotePython,c.remoteRoot+'/publish.py',...args].map(q).join(' ')+';exit $LASTEXITCODE';
  return execFileSync('ssh',['-o','BatchMode=yes','-o','ConnectTimeout=15',c.sshHost,'powershell.exe -NoProfile -NonInteractive -EncodedCommand '+Buffer.from(script,'utf16le').toString('base64')],{timeout:120000,encoding:'utf8',windowsHide:true});
}
export async function publish(work,{manual=false}={}){
  const c=config(),sources=JSON.parse(fs.readFileSync(path.join(work,'SOURCES.json'),'utf8')).sources,s=validateStory(JSON.parse(fs.readFileSync(path.join(work,'STORY.json'),'utf8')),sources);
  if(!manual){const state=JSON.parse(fs.readFileSync(path.join(work,'..','state.json'),'utf8'));const reviewer=state.runs.filter(r=>r.status==='FINISHED').at(-1);if(reviewer?.outcome!=='APPROVE')throw Error('Publishing requires the immediately preceding editorial approval');}
  const stage=fs.mkdtempSync(path.join(os.tmpdir(),'nova-news-publish-'));fs.writeFileSync(path.join(stage,'story.json'),JSON.stringify(s,null,2));fs.writeFileSync(path.join(stage,'image.svg'),comedyIllustration(s));
  const projectState=fs.existsSync(path.join(work,'..','state.json'))?JSON.parse(fs.readFileSync(path.join(work,'..','state.json'),'utf8')):{};if(projectState.newsroomUpdate===true){s.replaceExisting=true;fs.writeFileSync(path.join(stage,'story.json'),JSON.stringify(s,null,2));}
  const remote=c.remoteRoot.replaceAll('\\','/'),incoming=remote+'/incoming-'+crypto.randomUUID();
  const ps=script=>execFileSync('ssh',['-o','BatchMode=yes','-o','ConnectTimeout=15',c.sshHost,'powershell.exe -NoProfile -NonInteractive -EncodedCommand '+Buffer.from("$ProgressPreference='SilentlyContinue';"+script+'; exit $LASTEXITCODE','utf16le').toString('base64')],{timeout:120000,encoding:'utf8',windowsHide:true});
  const q=s=>"'"+s.replaceAll("'","''")+"'";
  if(c.transport==='local'){fs.mkdirSync(incoming);for(const name of ['story.json','image.svg'])fs.copyFileSync(path.join(stage,name),path.join(incoming,name));}else{
  ps(`New-Item -ItemType Directory -Path ${q(incoming)} -Force | Out-Null`);
  execFileSync('scp',['-o','BatchMode=yes',path.join(stage,'story.json'),path.join(stage,'image.svg'),c.sshHost+':'+incoming+'/'],{timeout:120000,windowsHide:true,stdio:'pipe'});
  }
  const result=invokePublisher(c,[incoming]);console.log(result.trim());
  const live=await fetch(c.siteUrl+'/stories.json?verify='+Date.now(),{signal:AbortSignal.timeout(15000)}).then(r=>r.json());if(!live.stories.some(a=>a.id===s.id))throw Error('Upload completed but public verification failed; inspect before retrying');
  for(const suffix of ['/story/'+s.id+'/','/images/'+s.id+'.svg']){const response=await fetch(c.siteUrl+suffix+'?verify='+Date.now(),{signal:AbortSignal.timeout(15000)});if(!response.ok)throw Error('Published article or illustration is not publicly reachable');}
  fs.writeFileSync(path.join(work,'PUBLISHED.json'),JSON.stringify({id:s.id,url:c.siteUrl+'/story/'+s.id+'/',verifiedAt:new Date().toISOString()},null,2));console.log('Public story verified: '+c.siteUrl+'/story/'+s.id+'/');
}
export function draftFromHandoff(text,sources){
  const blocks=[...text.matchAll(/```json\s*\n([\s\S]*?)\n```/g)];
  if(blocks.length!==1)throw Error('Return exactly one complete JSON code block after # DONE.');
  const draft=JSON.parse(blocks[0][1]);
  validateStory(draft,sources);
  return draft;
}
export function saveDraft(work){
  const root=path.resolve(work,'..'),state=JSON.parse(fs.readFileSync(path.join(root,'state.json'),'utf8'));
  const writer=state.runs.filter(r=>r.status==='FINISHED').at(-1);
  if(writer?.role!=='WRITER'||writer.outcome!=='DONE')throw Error('Draft must immediately follow the comedy writer.');
  const text=fs.readFileSync(path.join(root,'runs',writer.id,'handoff.md'),'utf8');
  const sources=JSON.parse(fs.readFileSync(path.join(work,'SOURCES.json'),'utf8')).sources;
  const draft=draftFromHandoff(text,sources);
  const target=path.join(work,'STORY.json');
  fs.writeFileSync(target,JSON.stringify(draft,null,2),'utf8');
  console.log('Story JSON saved and validated; editorial approval is still required.');
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const [command,workspace]=process.argv.slice(2);try{if(command==='save-draft')saveDraft(workspace||process.cwd());else if(command==='collect')await collect(workspace||process.cwd());else if(command==='publish')await publish(workspace||process.cwd());else if(command==='validate'){const work=workspace||process.cwd();validateStory(JSON.parse(fs.readFileSync(path.join(work,'STORY.json'),'utf8')),JSON.parse(fs.readFileSync(path.join(work,'SOURCES.json'),'utf8')).sources);console.log('Story schema, primary-source citations, and originality checks passed.');}else throw Error('Use collect or publish');}catch(e){console.error(e.message);process.exitCode=1;}
}

export function comedyIllustration(s){return '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="750" viewBox="0 0 1200 750"><rect width="1200" height="750" fill="#221826"/><circle cx="600" cy="340" r="215" fill="#51394c" stroke="#ffd23f" stroke-width="8"/><ellipse cx="600" cy="340" rx="100" ry="215" fill="none" stroke="#ad798f" stroke-width="4"/><path d="M385 340h430M410 240h380M410 440h380" stroke="#ad798f" stroke-width="4"/><g transform="rotate(-12 600 340)"><rect x="290" y="280" width="620" height="130" rx="10" fill="#ffd23f"/><text x="600" y="365" text-anchor="middle" font-family="Arial" font-weight="bold" font-size="54" fill="#221826">'+(['PENDING APPROVAL','MEETING ABOUT IT','PLEASE HOLD'][parseInt(s.id.slice(0,6),16)%3])+'</text></g><text x="50" y="65" font-family="monospace" font-size="24" fill="#ffd23f">THE ARTIFICIAL NEWS / SATIRE</text><text x="50" y="665" font-family="Arial" font-size="27" fill="white">'+esc(s.title.slice(0,70))+'</text></svg>'; }

