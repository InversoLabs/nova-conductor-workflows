import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {editorialPolicy} from '../newsroom/editorial-policy.mjs';
import {workflowOutcome,validateTemplate} from '../src/templates.mjs';
const flow=()=>editorialPolicy(JSON.parse(fs.readFileSync(new URL('../newsroom/workflow.example.json',import.meta.url),'utf8')));
test('blocked editorial results get bounded repair chances, never approval',()=>{
 const s={workflow:flow(),role:'EDITOR',runs:[]};const output='# BLOCKED\nThe draft needs corrections before it can be published accurately.';
 for(let i=0;i<2;i++){assert.deepEqual(workflowOutcome(s,'.',output,{passed:true}),{outcome:'BLOCKED',next:'WRITER'});s.runs.push({role:'EDITOR',status:'FINISHED',outcome:'BLOCKED'});}
 assert.equal(workflowOutcome(s,'.',output,{passed:true}).next,'NEEDS_ATTENTION');
 s.workflow.roles.find(r=>r.id==='EDITOR').blockedRepairLimit=undefined;
 assert.equal(workflowOutcome({...s,runs:[]},'.',output,{passed:true}).next,'NEEDS_ATTENTION');
});
test('repair fallback requires an existing revision route and a small explicit bound',()=>{
 const t=flow();t.roles.find(r=>r.id==='EDITOR').blockedRepairLimit=100;assert.throws(()=>validateTemplate(t),/Blocked repair/);
 const t2=flow();delete t2.roles.find(r=>r.id==='EDITOR').routes.REVISE;assert.throws(()=>validateTemplate(t2),/Blocked repair/);
});
