import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {makeBulletin,verifyNarration,createAnchorPump,automationStatus} from '../newsroom/anchor/automation.mjs';
import {createScheduler,writeSchedules,readSchedules} from '../src/schedules.mjs';
const stories=Array.from({length:8},(_,i)=>({id:String(i).padStart(20,'0'),title:'Published headline '+i,summary:'According to the source, this is the approved summary of the reported announcement.',publishedAt:`2026-09-${10+i}T12:00:00Z`,sources:[{name:'Source',url:'https://example.com/source'}]}));
test('autonomous bulletin preserves approved summaries and uses six latest headlines',()=>{
  const b=makeBulletin(stories,stories[7]);assert.equal(b.stories.length,2);assert.equal(b.headlines.length,6);assert.equal(b.segments[1].text,stories[7].summary);
  const voice={duration:20,segments:b.segments.map((s,i)=>({...s,start:i*5,end:(i+1)*5}))};verifyNarration(b,voice);
  voice.segments[1].text='Invented new claim';assert.throws(()=>verifyNarration(b,voice),/mismatch/);
});
test('anchor waits for workers, launches once, and retains completed delivery across restart',async t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'nova-anchor-pump-')),old=process.env.NOVA_ANCHOR_HOME,oldLease=process.env.NOVA_STUDIO_LEASE_FILE;
  process.env.NOVA_ANCHOR_HOME=root;process.env.NOVA_STUDIO_LEASE_FILE=path.join(root,'lease');t.after(()=>{if(old===undefined)delete process.env.NOVA_ANCHOR_HOME;else process.env.NOVA_ANCHOR_HOME=old;if(oldLease===undefined)delete process.env.NOVA_STUDIO_LEASE_FILE;else process.env.NOVA_STUDIO_LEASE_FILE=oldLease;fs.rmSync(root,{recursive:true,force:true});});
  fs.writeFileSync(path.join(root,'automation.json'),JSON.stringify({enabled:true,seen:stories.slice(0,7).map(s=>s.id),jobs:[]}));
  let busy=true,calls=0;const options={busy:()=>busy,fetchStories:async()=>stories,launch:j=>{calls++;fs.writeFileSync(path.join(j.folder,'job.json'),JSON.stringify({status:'complete'}));return {pid:null};}};
  let pump=createAnchorPump(options);await pump.tick();assert.equal(calls,0);busy=false;fs.writeFileSync(process.env.NOVA_STUDIO_LEASE_FILE,'reserved');await pump.tick();assert.equal(calls,0);fs.unlinkSync(process.env.NOVA_STUDIO_LEASE_FILE);
  await pump.tick();assert.equal(calls,1);pump.close();pump=createAnchorPump(options);t.after(()=>pump.close());await pump.tick();assert.equal(calls,1);assert.equal(automationStatus().jobs[0].status,'complete');
});
test('schedule remembers its due slot throughout a long GPU reservation and restart',async t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'nova-pending-')),old=process.env.NOVA_SCHEDULE_FILE;process.env.NOVA_SCHEDULE_FILE=path.join(root,'schedules.json');t.after(()=>{if(old===undefined)delete process.env.NOVA_SCHEDULE_FILE;else process.env.NOVA_SCHEDULE_FILE=old;fs.rmSync(root,{recursive:true,force:true});});
  writeSchedules([{id:'news',enabled:true,timeZone:'America/Chicago',times:['06:00','15:00']}]);let now=new Date('2026-09-22T20:00:00Z'),busy=true,calls=0;
  const options={busy:()=>busy,now:()=>now,launch:async()=>{calls++;return 'edition';}};let scheduler=createScheduler(options);await scheduler.tick();assert.equal(calls,0);assert.equal(readSchedules()[0].pendingSlot,'2026-09-22T15:00');scheduler.close();now=new Date('2026-09-22T22:30:00Z');busy=false;scheduler=createScheduler(options);t.after(()=>scheduler.close());await scheduler.tick();await scheduler.tick();assert.equal(calls,1);
});
