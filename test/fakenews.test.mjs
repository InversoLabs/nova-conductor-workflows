import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {validateTemplate} from '../src/templates.mjs';
import {validateStory,comedyIllustration,configFile,draftFromHandoff,saveDraft,fitSummary} from '../fakenews/scripts/newsroom.mjs';
import {makeBulletin,anchorHome,verifyNarration} from '../fakenews/anchor/automation.mjs';
import {configFile as newsConfig} from '../newsroom/scripts/newsroom.mjs';
import {socialRoot as comedySocialRoot,connect as connectComedy} from '../fakenews/social/social.mjs';
import {socialRoot as newsSocialRoot} from '../newsroom/social/social.mjs';
const source={name:'Example reporting',url:'https://example.com/world/committee',excerpt:'A municipal council discussed its annual meeting schedule at a public session.'};
const draft={title:'Committee Announces Committee to Schedule Its Next Committee',summary:'The fictional Department of Calendar Alignment has requested a meeting to discuss why everyone keeps requesting meetings.',factualSummary:'A municipal council discussed its annual meeting schedule at a public session.',category:'World',paragraphs:['The fictional department asked all attendees to confirm their availability for an emergency discussion about optional attendance.','Its unnamed director promised to streamline the process by creating three additional calendars and a fourth calendar to supervise them.'],sources:[source]};
test('comedy workflow has separate factual context and editorial approval',()=>{
 const t=validateTemplate(JSON.parse(fs.readFileSync(new URL('../fakenews/workflow.example.json',import.meta.url),'utf8')));
 assert.equal(t.id,'FAKENEWS');assert.equal(t.roles.find(r=>r.id==='EDITOR').routes.APPROVE,'PUBLISH');
 assert.throws(()=>validateStory({...draft,factualSummary:undefined},[source]),/factualSummary/);
 const s=validateStory(draft,[source]);assert.match(s.disclosure,/SATIRE/);assert.match(comedyIllustration(s),/SATIRE/);assert.ok(!comedyIllustration(s).includes('<script'));
 assert.notEqual(configFile(),newsConfig());assert.match(anchorHome(),/fakenews-anchor/);
});
test('draft robot validates model JSON without executing it or accepting ambiguous output',()=>{
 const handoff='# DONE\n```json\n'+JSON.stringify(draft)+'\n```';
 assert.deepEqual(draftFromHandoff(handoff,[source]),draft);
 assert.throws(()=>draftFromHandoff(handoff+'\n'+handoff,[source]),/exactly one/);
 assert.throws(()=>draftFromHandoff('# DONE\n```json\n{bad}\n```',[source]));
 assert.throws(()=>draftFromHandoff(handoff.replace(source.url,'https://unlisted.example/story'),[source]));
});
test('TAN bulletin narrates one approved satire summary and identifies itself',()=>{
 const s=validateStory(draft,[source]),b=makeBulletin([s],s);
 assert.equal(b.stories.length,1);assert.match(b.segments[0].text,/The Artificial News/);
 assert.equal(b.segments[1].text,s.summary);
 assert.ok(b.segments.every(segment=>segment.text!==s.factualSummary));
 assert.doesNotMatch(b.segments[0].text+' '+b.segments.at(-1).text,/satire|real source|fictional/i);
 const voice={segments:b.segments.map((x,i)=>({...x,start:i*10,end:(i+1)*10})),duration:b.segments.length*10};
 verifyNarration(b,voice);voice.segments[1].text+=' unreviewed change';assert.throws(()=>verifyNarration(b,voice));
});
test('failed length check preserves the new draft and gives a concrete repair',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'tan-draft-')),work=path.join(root,'work');
 try{
  fs.mkdirSync(work);fs.mkdirSync(path.join(root,'runs','0001'),{recursive:true});
  fs.writeFileSync(path.join(root,'state.json'),JSON.stringify({runs:[{id:'0001',role:'WRITER',status:'FINISHED',outcome:'DONE'}]}));
  fs.writeFileSync(path.join(work,'SOURCES.json'),JSON.stringify({sources:[source]}));
  const long={...draft,summary:'x'.repeat(701)};
  fs.writeFileSync(path.join(root,'runs','0001','handoff.md'),'# DONE\n```json\n'+JSON.stringify(long)+'\n```');
  assert.throws(()=>saveDraft(work),/STORY.json only as reference.*701 characters/);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(work,'STORY.json'),'utf8')),long);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
test('comedy Instagram refuses the original account before saving a credential',async()=>{
 assert.notEqual(comedySocialRoot(),newsSocialRoot());
 const previous=globalThis.fetch;
 globalThis.fetch=async()=>({ok:true,json:async()=>({id:'123',username:'inversolabs'})});
 try{await assert.rejects(connectComedy({accountId:'123',token:'test-only'}),/@theartificialnews/);}
 finally{globalThis.fetch=previous;}
});
test('narration fitting preserves complete sentences before editorial review',()=>{
 const sentence='The fictional committee scheduled another meeting to discuss the previous meeting. ';
 const result=fitSummary(sentence.repeat(12));
 assert.ok(result.length<=700);assert.ok(result.endsWith('.'));
 assert.ok(sentence.repeat(12).startsWith(result));
 assert.equal(fitSummary(draft.summary),draft.summary);
 assert.equal(fitSummary('x'.repeat(701)),'x'.repeat(701));
 const lead='The fictional committee requested another meeting. ';
 assert.equal(fitSummary(lead+'The aim? '+'x'.repeat(701)),lead.trim());
});
