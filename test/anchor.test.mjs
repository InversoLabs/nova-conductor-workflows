import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {withGPU} from '../newsroom/anchor/gpu.mjs';
import {InstagramReels} from '../newsroom/anchor/instagram-reels.mjs';
import {deliver} from '../newsroom/social/instagram.mjs';
import {latestHeadlines} from '../newsroom/anchor/headlines.mjs';
import {reviewedAssets} from '../newsroom/anchor/publish.mjs';
import crypto from 'node:crypto';
test('ticker uses the newest six, ignoring homepage priority and duplicate rows',()=>{
  const stories=Array.from({length:8},(_,i)=>({id:String(i),title:'Story '+i,publishedAt:`2026-09-${10+i}T12:00:00Z`,priority:8-i}));
  assert.deepEqual(latestHeadlines([...stories,stories[7]]).map(s=>s.id),['7','6','5','4','3','2']);
  assert.equal(latestHeadlines(stories.slice(0,2)).length,2);
  assert.throws(()=>latestHeadlines([{id:'bad',title:'Bad date',publishedAt:'invalid'}]),/Invalid/);
});
test('publication refuses changed video or changed narration after review',()=>{
  const folder=fs.mkdtempSync(path.join(os.tmpdir(),'bulletin-review-')),hashes={};
  for(const name of ['bulletin.json','voice.json','headlines.json','website.mp4','instagram.mp4']){
    const bytes=Buffer.from('reviewed '+name);fs.writeFileSync(path.join(folder,name),bytes);hashes[name]=crypto.createHash('sha256').update(bytes).digest('hex');
  }
  fs.writeFileSync(path.join(folder,'review.json'),JSON.stringify({outcome:'APPROVE',checkedBy:'test',checkedAt:new Date().toISOString(),hashes}));
  assert.equal(Object.keys(reviewedAssets(folder).assets).length,5);
  fs.appendFileSync(path.join(folder,'voice.json'),'changed');assert.throws(()=>reviewedAssets(folder),/artifact changed/);
  fs.rmSync(folder,{recursive:true});
});
test('Reel containers use video fields and interrupted publication is never duplicated',async()=>{
  const requests=[];
  const client=new InstagramReels({token:'test',accountId:'123',fetcher:async(url,opts)=>{requests.push({url:String(url),body:opts.body});return {ok:true,json:async()=>({id:'456'})};}});
  await client.create('Test bulletin','https://example.com/video.mp4');
  assert.equal(requests[0].body.get('media_type'),'REELS');
  assert.equal(requests[0].body.get('video_url'),'https://example.com/video.mp4');
  assert.equal(requests[0].body.has('image_url'),false);
  assert.throws(()=>client.create('Test','http://example.com/video.mp4'),/HTTPS/);
  const record={status:'uncertain',containerId:'456'};
  client.recent=async()=>({data:[]});
  await assert.rejects(deliver({client,record,save:()=>{},caption:'Test bulletin',imageUrl:'https://example.com/video.mp4'}),/uncertain/);
  assert.equal(requests.length,1);
});
test('failed animation restores the loaded model and its context before releasing hardware',async()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'anchor-test-')),file=path.join(root,'lease.json'),calls=[];let loaded=true;
  const api=async(route,body)=>{calls.push({route,body});if(route==='ps')return {models:loaded?[{name:'gpt-oss:20b',context_length:16384}]:[]};loaded=body.keep_alive!==0;return {};};
  await assert.rejects(withGPU(async()=>{throw Error('render failed');},{api,busy:()=>false,file}),/render failed/);
  assert.equal(loaded,true);assert.equal(fs.existsSync(file),false);assert.equal(calls.at(-1).body.options.num_ctx,16384);
  fs.rmSync(root,{recursive:true});
});
test('restoration failure retains the hardware hold, and busy workers never unload',async()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'anchor-test-')),file=path.join(root,'lease.json');let count=0;
  await assert.rejects(withGPU(async()=>{},{file,busy:()=>true,api:()=>{count++;}}),/active Conductor/);
  assert.equal(count,0);assert.equal(fs.existsSync(file),false);
  let ps=0;const api=async(route,body)=>{if(route==='ps')return {models:ps++?[]:[{name:'gpt'}]};if(body.keep_alive===-1)throw Error('restore failed');return {};};
  await assert.rejects(withGPU(async()=>{},{file,busy:()=>false,api}),/restore failed/);
  assert.equal(JSON.parse(fs.readFileSync(file)).status,'restore-failed');fs.rmSync(root,{recursive:true});
});
