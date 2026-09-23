import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import os from 'node:os';import {once,EventEmitter} from 'node:events';import {PassThrough} from 'node:stream';
import {createUIServer} from '../ui/server.mjs';import {publicActivity} from '../src/public-activity.mjs';

test('local UI validates flows, protects API writes, saves agents, imports projects, and controls an owned run',async t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'nova-ui-test-')),oldLibrary=process.env.NOVA_WORKFLOW_LIBRARY,oldProvider=process.env.NOVA_CONDUCTOR_PROVIDER_FILE;
 process.env.NOVA_WORKFLOW_LIBRARY=path.join(dir,'library');process.env.NOVA_CONDUCTOR_PROVIDER_FILE=path.join(dir,'provider.json');
 let launched,child;const server=createUIServer({projectRoots:[path.join(dir,'projects')],launch:(root,env)=>{launched={root,env};child=new EventEmitter();child.exitCode=null;child.stdout=new PassThrough();child.stderr=new PassThrough();return child;}});
 server.listen(0,'127.0.0.1');await once(server,'listening');const origin='http://127.0.0.1:'+server.address().port;
 const call=async(route,body,customOrigin=origin)=>{const res=await fetch(origin+'/api/'+route,body===undefined?{}:{method:'POST',headers:{'Content-Type':'application/json',Origin:customOrigin},body:JSON.stringify(body)});return {status:res.status,body:await res.json()};};
 t.after(async()=>{if(child)child.exitCode=0;server.closeAllConnections();await new Promise(r=>server.close(r));if(oldLibrary===undefined)delete process.env.NOVA_WORKFLOW_LIBRARY;else process.env.NOVA_WORKFLOW_LIBRARY=oldLibrary;if(oldProvider===undefined)delete process.env.NOVA_CONDUCTOR_PROVIDER_FILE;else process.env.NOVA_CONDUCTOR_PROVIDER_FILE=oldProvider;fs.rmSync(dir,{recursive:true,force:true});});
 const bootstrap=(await call('bootstrap')).body;assert.ok(bootstrap.templates.length>=3);assert.ok(bootstrap.agents.some(a=>a.key==='nova-builder-20b'));
 assert.equal((await call('provider',{kind:'ollama'},'https://unrelated.example')).status,403);
 assert.match(await (await fetch(origin+'/artificial-social')).text(),/@theartificialnews/);
 assert.equal((await call('artificial-social/connect',{accountId:'123',token:'test'},'https://unrelated.example')).status,403);
 assert.equal((await call('templates/validate',{...bootstrap.templates[1].value,start:'MISSING'})).status,400);
 const agent={schemaVersion:1,id:'UI_TEST',name:'UI test agent',prompt:'Complete the requested change and verify the result.',access:'workspace-write'};
 assert.equal((await call('agents',agent)).status,200);assert.ok((await call('bootstrap')).body.agents.some(a=>a.value.id==='UI_TEST'));
 const source=path.join(dir,'source');fs.mkdirSync(source);fs.writeFileSync(path.join(source,'index.html'),'original');
 const p=(await call('projects',{name:'UI project',prompt:'Update the page.',model:'test-model',agent,source})).body;assert.ok(p.id);
 assert.equal((await call('projects/'+p.id+'/file?name=../state.json')).status,400);
 assert.equal((await call('projects/'+p.id+'/file?name=index.html')).body.text,'original');
 await call('provider',{kind:'custom',baseUrl:'http://127.0.0.1:12345/v1',keyEnv:'UI_TEST_SECRET'});
 assert.equal((await call('projects/'+p.id+'/run',{apiKey:'test-secret-never-store'})).status,200);assert.equal(launched.env.UI_TEST_SECRET,'test-secret-never-store');
 child.stderr.write('request failed test-secret-never-store');
 const detail=(await call('projects/'+p.id)).body;assert.ok(!JSON.stringify(detail).includes('test-secret-never-store'));assert.match(detail.log,/REDACTED/);
 assert.equal((await call('projects/'+p.id+'/run',{apiKey:'x'})).status,400);
 assert.equal((await call('shutdown',{})).status,400);
 assert.equal((await call('projects/'+p.id+'/stop',{})).status,200);assert.ok(fs.existsSync(path.join(launched.root,'stop.request')));
 assert.equal(fs.readFileSync(path.join(source,'index.html'),'utf8'),'original');
 assert.ok(!fs.readFileSync(path.join(launched.root,'state.json'),'utf8').includes('test-secret-never-store'));
});

test('UI activity exports visible tool results without raw reasoning or protocol data',()=>{
 assert.equal(publicActivity({method:'item/reasoning/textDelta',params:{delta:'private'}}),null);
 assert.equal(publicActivity({method:'item/completed',params:{item:{type:'reasoning',content:'private'}}}),null);
 assert.deepEqual(publicActivity({method:'item/completed',params:{item:{type:'commandExecution',command:'node --check game.js',aggregatedOutput:'ok',status:'completed',exitCode:0}}}).output,'ok');
 assert.equal(publicActivity({method:'item/completed',params:{item:{type:'agentMessage',phase:'commentary',text:'Checking the game.'}}}).text,'Checking the game.');
});
