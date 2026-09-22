import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {Instagram,deliver,verifyIdentity} from '../newsroom/social/instagram.mjs';
import {withSocial} from '../newsroom/social/workflow.mjs';
import {validateCaption,settings,queue,publishPost,recoverLock,createSocialPump} from '../newsroom/social/social.mjs';

const template=JSON.parse(fs.readFileSync(new URL('../newsroom/workflow.example.json',import.meta.url)));
test('identity accepts either returned Instagram ID but rejects different accounts and incomplete profiles',()=>{
  assert.equal(verifyIdentity({id:'123',user_id:'456',username:'inversolabs'},'456').username,'inversolabs');
  assert.equal(verifyIdentity({id:'123',username:'inversolabs'},'123').accountId,'123');
  assert.equal(verifyIdentity({user_id:'456',username:'inversolabs'},'456').accountId,'456');
  assert.throws(()=>verifyIdentity({id:'123',username:'elsewhere'},'456'),/does not match/);
  assert.throws(()=>verifyIdentity({id:'123'},'123'),/without a username/);
  assert.throws(()=>verifyIdentity({id:9007199254740993,username:'rounded'},'9007199254740992'),/does not match/);
});
test('social roles preserve newsroom review and install idempotently',()=>{
  const t=withSocial(template);assert.equal(t.roles.find(r=>r.id==='EDITOR').routes.APPROVE,'PUBLISH');
  assert.equal(t.roles.find(r=>r.id==='SOCIAL_EDITOR').routes.REVISE,'SOCIAL_WRITER');assert.deepEqual(withSocial(t),t);
});
test('Instagram client never leaks error body or bearer token',async()=>{
  const client=new Instagram({token:'secret-token',accountId:'123',fetcher:async(url,opts)=>{assert.equal(url.hostname,'graph.instagram.com');assert.equal(opts.headers.Authorization,'Bearer secret-token');return {ok:false,status:401,json:async()=>({error:{code:190,message:'secret-token'}})};}});
  await assert.rejects(client.identity(),e=>e.message.includes('190')&&!e.message.includes('secret-token'));
});
test('normal delivery is durable and repeated delivery never posts twice',async()=>{
  let posts=0;const states=[],record={status:'preview'};
  const client={create:async()=>({id:'123'}),status:async()=>({status_code:'FINISHED'}),publish:async()=>{assert.equal(states.at(-1),'publishing');posts++;return {id:'456'};}};
  const args={client,record,caption:'caption',imageUrl:'https://example.com/card.jpg',save:p=>states.push(p.status)};
  await deliver(args);await deliver(args);assert.equal(posts,1);assert.equal(record.mediaId,'456');assert.deepEqual(states,['creating','processing','publishing','published']);
});
test('transient reads retry within a bound; writes are not retried',async()=>{
  let calls=0;const client=new Instagram({token:'token',accountId:'123',sleep:async()=>{},fetcher:async()=>{calls++;return {ok:false,status:429,json:async()=>({error:{code:4}})};}});
  await assert.rejects(client.identity(),/429/);assert.equal(calls,3);
  calls=0;await assert.rejects(client.publish('456'),/429/);assert.equal(calls,1);
});
test('lost publish response reconciles without a second mutation',async()=>{
  let posts=0;const record={status:'preview'},client={create:async()=>({id:'123'}),status:async()=>({status_code:'FINISHED'}),publish:async()=>{posts++;throw Error('lost');},recent:async()=>({data:[{id:'456',caption:'caption',permalink:'https://instagram.com/p/example'}]})};
  const args={client,record,caption:'caption',imageUrl:'https://example.com/card.jpg',save:()=>{}};
  await assert.rejects(deliver(args),/uncertain/);await deliver(args);assert.equal(posts,1);assert.equal(record.status,'published');
});
test('uncertain unmatched publication holds',async()=>{
  await assert.rejects(deliver({client:{recent:async()=>({data:[]})},record:{status:'uncertain'},save:()=>{},caption:'caption'}),/uncertain/);
});
test('interrupted creation can recreate an unpublished container',async()=>{
  const record={status:'creating'};await deliver({client:{create:async()=>({id:'123'}),status:async()=>({status_code:'FINISHED'}),publish:async()=>({id:'456'})},record,save:()=>{},caption:'caption'});assert.equal(record.status,'published');
});
test('processing retry reuses existing container',async()=>{
  const record={status:'processing',containerId:'123'};let calls=0;
  await deliver({record,save:()=>{},caption:'caption',client:{status:async()=>({status_code:'FINISHED'}),publish:async()=>{calls++;return {id:'456'};}}});assert.equal(calls,1);
});
test('caption rejects extra URLs and missing article link',()=>{
  const story={url:'https://example.com/story/1/'};
  assert.throws(()=>validateCaption({caption:'Some caption with no approved URL but enough text.'},story),/exact article/);
  assert.throws(()=>validateCaption({caption:'A news caption '+story.url+' https://evil.example/'},story),/unapproved URL/);
});
test('preview default, no publication without approval or enablement, live lock retained',async t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'social-test-')),old=process.env.NOVA_SOCIAL_HOME;process.env.NOVA_SOCIAL_HOME=root;
  t.after(()=>{if(old)process.env.NOVA_SOCIAL_HOME=old;else delete process.env.NOVA_SOCIAL_HOME;fs.rmSync(root,{recursive:true,force:true});});
  assert.equal(settings().enabled,false);await assert.rejects(publishPost('a'.repeat(20)),/disabled/);
  fs.mkdirSync(path.join(root,'work'));fs.writeFileSync(path.join(root,'state.json'),JSON.stringify({runs:[{role:'EDITOR',status:'FINISHED',outcome:'APPROVE'}]}));await assert.rejects(queue(path.join(root,'work')),/social editor approval/);
  const dir=path.join(root,'outbox','a'.repeat(20));fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'delivery.lock'),String(process.pid));assert.throws(()=>recoverLock('a'.repeat(20)),/still running/);
});
test('automatic retries stop after three attempts and never backfill ordinary previews',async t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'social-pump-')),oldHome=process.env.NOVA_SOCIAL_HOME,oldNews=process.env.NOVA_NEWSROOM_CONFIG;
  process.env.NOVA_SOCIAL_HOME=root;process.env.NOVA_NEWSROOM_CONFIG=path.join(root,'missing-newsroom.json');
  const pump=createSocialPump();t.after(()=>{pump.close();if(oldHome)process.env.NOVA_SOCIAL_HOME=oldHome;else delete process.env.NOVA_SOCIAL_HOME;if(oldNews)process.env.NOVA_NEWSROOM_CONFIG=oldNews;else delete process.env.NOVA_NEWSROOM_CONFIG;fs.rmSync(root,{recursive:true,force:true});});
  fs.writeFileSync(path.join(root,'settings.json'),JSON.stringify({enabled:true,accountId:'123'}));
  for(const [id,autoRetry] of [['a'.repeat(20),true],['b'.repeat(20),false]]){
    const dir=path.join(root,'outbox',id);fs.mkdirSync(dir,{recursive:true});const bytes=Buffer.from('fixture image');fs.writeFileSync(path.join(dir,'card.jpg'),bytes);
    fs.writeFileSync(path.join(dir,'post.json'),JSON.stringify({id,status:'preview',autoRetry,attempts:2,nextAttemptAt:'2000-01-01',createdAt:'2000-01-01',approvedAt:'2000-01-01',cardHash:crypto.createHash('sha256').update(bytes).digest('hex')}));
  }
  await pump.tick();await pump.tick();assert.equal(JSON.parse(fs.readFileSync(path.join(root,'outbox','a'.repeat(20),'post.json'))).attempts,3);assert.equal(JSON.parse(fs.readFileSync(path.join(root,'outbox','b'.repeat(20),'post.json'))).attempts,2);
});
