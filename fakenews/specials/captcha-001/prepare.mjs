import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {cast,castHashes} from '../../anchor/cast.mjs';
const here=path.dirname(fileURLToPath(import.meta.url));
const dialogue=[
 ['vera','Human verification','Good evening. I’m Vera Volt. This is a Special Report.'],
 ['vera','Humans work for robots','Humans prove they aren’t robots by identifying traffic lights—for a robot. Miles Byte is outside the Human Verification Center. Has anyone made it through?'],
 ['miles','Does the wheel count?','Not yet, Vera. One man has spent forty minutes deciding whether a bicycle wheel counts as a bicycle. His wife says he was certain about everything until today.'],
 ['vera','The reward','What happens if he passes?'],
 ['miles','Password still forgotten','He gets permission to reset the password he forgot.'],
 ['vera','Try again','And if he fails?'],
 ['miles','Suspicious efficiency','More traffic lights. We asked why the system suspected him. It said he completed the task efficiently and without complaining.'],
 ['vera','Suspicious','Suspicious.'],
 ['miles','Human detected','He’s now shouting at his laptop.'],
 ['vera','Verified human','There we are. Verified human.']
];
const segments=dialogue.map(([speaker,title,text],i)=>({speaker,shot:cast[speaker].shot,presenter:cast[speaker].name,title,text,pip:i===0?null:'captcha',captchaStage:i<3?'bicycle':i<7?'traffic':'verified'}));
const beats=[
 [['Good evening. I’m Vera Volt.',0.2],['This is a Special Report.',0.35]],
 [['Humans prove they aren’t robots by identifying traffic lights.',0.35],['For a robot.',0.9],['Miles Byte is outside the Human Verification Center. Has anyone made it through?',0.25]],
 [['Not yet, Vera.',0.25],['One man has spent forty minutes deciding whether a bicycle wheel counts as a bicycle.',0.35],['His wife says he was certain about everything until today.',0.95]],
 [['What happens if he passes?',0.2]],
 [['He gets permission to reset the password he forgot.',0.85]],
 [['And if he fails?',0.2]],
 [['More traffic lights.',0.4],['We asked why the system suspected him.',0.2],['It said he completed the task efficiently, and without complaining.',1.0]],
 [['Suspicious.',0.85]],
 [['He’s now shouting at his laptop.',0.9]],
 [['There we are.',0.8],['Verified human.',1.0]]
];
segments.forEach((s,i)=>{s.delivery=beats[i].map(([text,pauseAfter])=>({text,pauseAfter}));s.text=s.delivery.map(x=>x.text).join(' ');s.captchaStage=i===9?'verified':i>=7?'pending':i<3?'bicycle':'traffic';});
const script='# Human Verification — 60-second Special Report\n\n'+segments.map(s=>`**${s.presenter}:** ${s.text}`).join('\n\n')+'\n\nProduction: Vera opens on camera; SPECIAL REPORT globe ident after greeting; alternating Vera desk and Miles exterior. Procedural CAPTCHA inset progresses from bicycle selection to traffic lights to VERIFIED HUMAN. Deadpan delivery. Original voices. Both 16:9 and 9:16. Target 60 seconds including 3-second ident. Preview before publication.\n';
fs.writeFileSync(path.join(here,'SCRIPT.md'),script);
fs.writeFileSync(path.join(here,'bulletin.json'),JSON.stringify({id:'captcha-001',kind:'special',format:'full-show-v1',editionDate:'Human Verification · Special Report',createdAt:new Date().toISOString(),presenter:{id:'vera'},castHashes:castHashes(),scriptHash:crypto.createHash('sha256').update(script).digest('hex'),approval:{by:'User',scope:'Approved CAPTCHA concept and production request',record:'SCRIPT.md'},titleLabel:'SPECIAL REPORT',introSubtitle:'SPECIAL REPORT',targetDuration:60,deliverySpeed:0.9,endCard:true,stories:[],headlines:['Human verification remains inconclusive','Bicycle wheel investigation enters second hour','Efficient behavior triggers robot alert','Password still forgotten','More traffic lights requested','Shouting accepted as proof of humanity'],segments},null,2));
console.log('Prepared CAPTCHA special');
