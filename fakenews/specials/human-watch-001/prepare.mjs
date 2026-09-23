import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {cast,castHashes} from '../../anchor/cast.mjs';
const here=path.dirname(fileURLToPath(import.meta.url));
const script=fs.readFileSync(path.join(here,'SCRIPT.md'),'utf8');
let camera='vera',title='Reality under review',pip=null,current;
const segments=[];
for(const paragraph of script.split(/\r?\n\s*\r?\n/)){
  if(paragraph.startsWith('## Production'))break;
  if(paragraph.startsWith('## ')){
    const section=paragraph.match(/^## (\d)/)?.[1];
    title=({'1':'Reality under review','2':'Downside removed','3':'Dishwasher diplomacy','4':'Premium Impact Experience'})[section]||'Humanity, under observation';
    pip=({'2':'chart','3':'dishwasher','4':'moon'})[section]||null;current=null;continue;
  }
  if(paragraph.startsWith('**Camera A'))camera='vera';
  if(paragraph.startsWith('**Camera B'))camera='vera_left';
  if(paragraph.startsWith('**Camera C'))camera='vera_right';
  const speech=paragraph.match(/^\*\*(VERA|MILES|IRIS):\*\*\s*([\s\S]*)/);
  if(speech){const speaker=speech[1]==='VERA'?camera:speech[1].toLowerCase();current={speaker,shot:cast[speaker].shot,presenter:cast[speaker].name,title,pip:speaker.startsWith('vera')&&speaker!=='vera'?pip:null,text:speech[2]};segments.push(current);}
  else if(current&&!paragraph.startsWith('**')&&!paragraph.startsWith('#')&&!paragraph.startsWith('Working script'))current.text+=' '+paragraph.trim();
}
if(segments.length<10||segments.some(s=>!s.text.trim())||!segments.some(s=>s.speaker==='vera_left')||!segments.some(s=>s.speaker==='vera_right'))throw Error('Missing planned camera or dialogue');
const hash=crypto.createHash('sha256').update(script).digest('hex');
const bulletin={id:'human-watch-001',kind:'special',format:'full-show-v1',editionDate:'Human Watch · Special Edition',createdAt:new Date().toISOString(),presenter:{id:'vera'},castHashes:castHashes(),scriptHash:hash,approval:{by:'User',scope:'Approved script and production request',record:'SCRIPT.md'},stories:[],headlines:['Reality under review','Markets gain 400% in vibes','Dishwasher diplomacy','Moon crater becomes premium impact experience'],segments};
fs.writeFileSync(path.join(here,'bulletin.json'),JSON.stringify(bulletin,null,2));
console.log(JSON.stringify({segments:segments.length,characters:segments.reduce((n,s)=>n+s.text.length,0),scriptHash:hash,cameras:[...new Set(segments.map(s=>s.speaker))]}));
