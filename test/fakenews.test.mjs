import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {validateTemplate} from '../src/templates.mjs';
import {validateStory,comedyIllustration,configFile,draftFromHandoff} from '../fakenews/scripts/newsroom.mjs';
import {makeBulletin,anchorHome,verifyNarration} from '../fakenews/anchor/automation.mjs';
import {configFile as newsConfig} from '../newsroom/scripts/newsroom.mjs';
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
 assert.equal(b.stories.length,1);assert.match(b.segments[0].text,/The Artificial News/);assert.match(b.segments[0].text,/satire/);
 const voice={segments:b.segments.map((x,i)=>({...x,start:i*10,end:(i+1)*10})),duration:b.segments.length*10};
 verifyNarration(b,voice);voice.segments[1].text+=' unreviewed change';assert.throws(()=>verifyNarration(b,voice));
});
