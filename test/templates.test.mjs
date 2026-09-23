import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {EventEmitter} from 'node:events';
import {initialize,run,reopen} from '../src/conductor.mjs';
import {atomic,snapshot} from '../src/workflow.mjs';
import {builtins,defaultAgent,oneShot,validateTemplate,validateAgent,initializeWorkflow,workflowOutcome,assertWorkflowChanges,workflowPrompt} from '../src/templates.mjs';
function project(t,template=builtins.writing,source){const parent=fs.mkdtempSync(path.join(os.tmpdir(),'nova-workflows-'));t.after(()=>fs.rmSync(parent,{recursive:true,force:true}));const root=path.join(parent,'project');initializeWorkflow(root,'Create a short story about a helpful robot.','test-model',template,source,initialize);return root;}
function worker(root,act){let count=0;const starts=[];return {starts,start:async()=>{const c=new EventEmitter();c.close=()=>{};c.request=async(method,p)=>{if(method==='thread/start'){starts.push(p);return {thread:{id:'fresh-'+ ++count}};}if(method==='turn/start'){setImmediate(async()=>{try{const result=await act({root,work:path.join(root,'work'),count,p,c});if(result==='pause')return;c.emit('notice',{method:'turn/completed',params:{threadId:p.threadId,turn:{status:result?.failed?'failed':'completed',error:result?.failed?{message:result.failed}:undefined,items:[{type:'agentMessage',text:typeof result==='string'?result:''}]}}});}catch(e){c.emit('notice',{method:'turn/completed',params:{threadId:p.threadId,turn:{status:'failed',error:{message:e.message}}}});}});return {turn:{id:'turn-'+count}};}return {};};return {connection:c,url:'mock'};}};}
const checks=async()=>({passed:true,results:[]});
test('reopened role guidance does not leak into another role',t=>{
 const root=project(t);reopen(root,'WRITER_ONLY_INSTRUCTION','WRITER');
 const s=JSON.parse(fs.readFileSync(path.join(root,'state.json'),'utf8'));
 assert.equal(s.guidanceRole,'WRITER');assert.match(workflowPrompt(s),/WRITER_ONLY_INSTRUCTION/);
 s.role='EDITOR';assert.ok(!workflowPrompt(s).includes('WRITER_ONLY_INSTRUCTION'));
});
test('validator rejects unsafe, unreachable, conflicting, and endless definitions',()=>{
 assert.doesNotThrow(()=>assertWorkflowChanges({role:'BUILDER',workflow:builtins['custom-code']},{'BUILD_PLAN.md':'old'},{'BUILD_PLAN.md':'new'}));
 assert.equal(validateTemplate(builtins.writing).start,'PRODUCER');for(const template of Object.values(builtins))validateTemplate(template);validateTemplate(oneShot(defaultAgent));
 for(const mutate of [t=>t.maxRuns=0,t=>t.roles[1].id='PRODUCER',t=>t.roles[0].outputs=['../file'],t=>t.roles[0].writes=['REQUEST.md'],t=>t.roles[1].writes=['BRIEF.md'],t=>t.roles[0].routes.DONE='MISSING',t=>t.roles[0].routes.DONE='COMPLETE',t=>t.roles[2].routes.APPROVE='WRITER',t=>t.roles[2].writes=['DRAFT.md'],t=>t.roles[0].routes.BLOCKED='COMPLETE']){const t=structuredClone(builtins.writing);mutate(t);assert.throws(()=>validateTemplate(t));}
 assert.throws(()=>validateAgent({...defaultAgent,model:'bad model'}));
});
test('writing workflow revises and approves in fresh sessions with handoff and model override',async t=>{
 const template=structuredClone(builtins.writing);template.roles[2].model='editor-model';const root=project(t,template);
 template.roles[0].prompt='mutated outside';let reviews=0;
 const w=worker(root,({work,p,count})=>{
  assert.match(p.input[0].text,/short story about a helpful robot/);assert.doesNotMatch(p.input[0].text,/mutated outside/);
  if(count===1){fs.writeFileSync(path.join(work,'BRIEF.md'),'One robot story, beginning middle end.');return '# DONE\nSaved the brief with audience and the original requested acceptance criteria.';}
  if(count===2||count===4){if(count===4)assert.match(p.input[0].text,/Give the robot an ending/);fs.writeFileSync(path.join(work,'DRAFT.md'),count===2?'A robot helped.':'A robot helped and returned home.');return '# DONE\nSaved the complete draft and checked it against the requested brief.';}
  return ++reviews===1?'# REVISE\nThe story lacks its required ending and does not complete the brief.\n- [ ] Give the robot an ending; read the final paragraph to verify resolution.':'# APPROVE\nRead the complete draft and verified the robot story has beginning middle and ending.';
 });
 const s=await run(root,{visible:false,start:w.start,check:checks});assert.equal(s.status,'COMPLETE');assert.deepEqual(s.runs.map(r=>r.role),['PRODUCER','WRITER','EDITOR','WRITER','EDITOR']);assert.equal(w.starts[2].sandbox,'read-only');assert.equal(w.starts[2].model,'editor-model');assert.equal(new Set(s.runs.map(r=>r.threadId)).size,5);
 reopen(root,'Make the ending happier.','WRITER');const updated=JSON.parse(fs.readFileSync(path.join(root,'state.json')));assert.equal(updated.role,'WRITER');assert.equal(updated.handoff,'');assert.match(updated.guidance,/happier/);
});
test('one-shot imports existing files without planner artifacts, then completes in one role',async t=>{
 const source=fs.mkdtempSync(path.join(os.tmpdir(),'nova-source-'));t.after(()=>fs.rmSync(source,{recursive:true,force:true}));fs.writeFileSync(path.join(source,'index.html'),'original');
 const root=project(t,oneShot(defaultAgent),source);
 assert.equal(fs.existsSync(path.join(root,'work','BUILD_PLAN.md')),false);
 const w=worker(root,({work})=>{fs.writeFileSync(path.join(work,'index.html'),'updated');return '# DONE\nUpdated the requested page and checked the result against the instructions.';});
 const result=await run(root,{visible:false,start:w.start,check:checks});assert.equal(result.status,'COMPLETE');assert.equal(result.runs.length,1);assert.equal(fs.readFileSync(path.join(source,'index.html'),'utf8'),'original');
});
test('one-shot disconnect retains partial files and same agent on a fresh thread',async t=>{
 const root=project(t,oneShot(defaultAgent));const s=JSON.parse(fs.readFileSync(path.join(root,'state.json')));s.config.retryDelayMs=0;atomic(path.join(root,'state.json'),s);
 const w=worker(root,({work,count})=>{if(count===1){fs.writeFileSync(path.join(work,'partial.txt'),'saved');return {failed:'stream disconnected before response.completed'};}assert.equal(fs.readFileSync(path.join(work,'partial.txt'),'utf8'),'saved');return '# DONE\nInspected the saved partial work and completed the requested remaining changes.';});
 const result=await run(root,{visible:false,start:w.start,check:checks});assert.equal(result.status,'COMPLETE');assert.deepEqual(result.runs.map(r=>r.role),['GENERAL','GENERAL']);
});
test('protected edits are restored while allowed edits survive; reopen is usable',async t=>{
 const root=project(t,oneShot(defaultAgent));const w=worker(root,({work})=>{fs.writeFileSync(path.join(work,'REQUEST.md'),'wrong');fs.writeFileSync(path.join(work,'product.txt'),'useful');return '# DONE\nMade changes and checked the result against the request as described.';});
 const s=await run(root,{visible:false,start:w.start,check:checks});assert.equal(s.status,'NEEDS_ATTENTION');assert.equal(fs.readFileSync(path.join(root,'work','REQUEST.md'),'utf8'),s.prompt);assert.equal(fs.readFileSync(path.join(root,'work','product.txt'),'utf8'),'useful');assert.equal(fs.readFileSync(path.join(root,'runs','0001','rejected-edits','REQUEST.md'),'utf8'),'wrong');assert.deepEqual(s.expected,snapshot(path.join(root,'work')));assert.doesNotThrow(()=>reopen(root,'Only change product.txt.','GENERAL'));
});
test('missing evidence or required artifact cannot complete; blocked does not transition',async t=>{
 const root=project(t);const s=JSON.parse(fs.readFileSync(path.join(root,'state.json')));
 assert.throws(()=>workflowOutcome(s,path.join(root,'work'),'# DONE\nI have completed the requested work and checked all of the results.',{passed:true}),/Missing required output/);
 const w=worker(root,()=> '# BLOCKED\nThe requested source material is unavailable and the user must provide it.');const result=await run(root,{visible:false,start:w.start,check:checks});assert.equal(result.status,'NEEDS_ATTENTION');assert.equal(result.runs.length,1);assert.equal(result.role,'PRODUCER');
 assert.throws(()=>assertWorkflowChanges({...s,role:'EDITOR'},{'DRAFT.md':'a'},{'DRAFT.md':'b'}),/protected/);
});
test('failed configured checks prevent one-shot completion',async t=>{
 const root=project(t,oneShot(defaultAgent));const w=worker(root,()=> '# DONE\nThe requested work is finished and I inspected the resulting files.');const s=await run(root,{visible:false,start:w.start,check:async()=>({passed:false,results:[{passed:false,output:'Test failed'}]})});assert.equal(s.status,'NEEDS_ATTENTION');assert.match(s.feedback,/Test failed/);
});
test('one-shot pause accepts steering in the same session then completes',async t=>{
 const root=project(t,oneShot(defaultAgent));const w=worker(root,({p,c})=>{
 c.emit('notice',{method:'turn/completed',params:{threadId:p.threadId,turn:{status:'interrupted'}}});assert.equal(JSON.parse(fs.readFileSync(path.join(root,'state.json'))).status,'PAUSED');
 setTimeout(()=>{c.emit('notice',{method:'turn/started',params:{threadId:p.threadId,turn:{id:'steered'}}});c.emit('notice',{method:'turn/completed',params:{threadId:p.threadId,turn:{status:'completed',items:[{type:'agentMessage',text:'# DONE\nFollowed the latest guidance and verified the requested result in the project.'}]}}});},20);return 'pause';});
 const s=await run(root,{visible:false,start:w.start,check:checks});assert.equal(s.status,'COMPLETE');assert.equal(w.starts.length,1);
});
test('stop file ends a running one-shot and releases its project lock',async t=>{
 const root=project(t,oneShot(defaultAgent));const w=worker(root,()=>{fs.writeFileSync(path.join(root,'stop.request'),'stop');return 'pause';});const s=await run(root,{visible:false,start:w.start,check:checks});assert.equal(s.status,'STOPPED');assert.equal(fs.existsSync(path.join(root,'conductor.lock')),false);
});

test('storage failure still closes the owned worker and releases the lock',async t=>{
 const root=project(t,oneShot(defaultAgent));let closed=false;const original=fs.writeFileSync;
 const c=new EventEmitter();c.close=()=>{closed=true;};c.request=async(method,p)=>{if(method==='thread/start')return {thread:{id:'disk-test'}};if(method==='turn/start'){fs.writeFileSync=(file,...args)=>{if(String(file).startsWith(root)){const e=Error('Disk full');e.code='ENOSPC';throw e;}return original(file,...args);};setImmediate(()=>c.emit('notice',{method:'turn/completed',params:{threadId:p.threadId,turn:{status:'completed'}}}));return {turn:{id:'disk-turn'}};}return {};};
 try{await assert.rejects(run(root,{visible:false,start:async()=>({connection:c,url:'mock'}),check:checks}),/Disk full/);}finally{fs.writeFileSync=original;}
 assert.equal(closed,true);assert.equal(fs.existsSync(path.join(root,'conductor.lock')),false);
});
