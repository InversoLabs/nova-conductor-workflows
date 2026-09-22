import {validateRobot} from './robots.mjs';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {atomic,snapshot} from './workflow.mjs';
import {importProject} from './import-project.mjs';

const idPattern=/^[A-Z][A-Z0-9_]{0,39}$/;
const modelPattern=/^[a-zA-Z0-9][\w.:/-]{0,199}$/;
const outcomes=['DONE','APPROVE','REVISE','BLOCKED'];
const terminals=['COMPLETE','NEEDS_ATTENTION'];
export const libraryRoot=()=>process.env.NOVA_WORKFLOW_LIBRARY || path.join(process.env.LOCALAPPDATA || os.homedir(),'Nova-Conductor','library');
export const builtins={
  code:{schemaVersion:1,id:'CODE',name:'Code project builder',engine:'coding-v1',start:'PLANNER',maxRuns:60,roles:[{id:'PLANNER',name:'Planner'},{id:'BUILDER',name:'Builder'},{id:'REVIEWER',name:'Reviewer'}]},
  writing:{schemaVersion:1,id:'WRITING',name:'Writing studio',start:'PRODUCER',maxRuns:20,roles:[
    {id:'PRODUCER',name:'Producer',prompt:'Create BRIEF.md with the requested audience, deliverable, constraints, and concrete acceptance criteria. Keep scope faithful to the request; do not write the final deliverable.',access:'workspace-write',inputs:[],outputs:['BRIEF.md'],writes:['BRIEF.md'],routes:{DONE:'WRITER',BLOCKED:'NEEDS_ATTENTION'}},
    {id:'WRITER',name:'Writer',prompt:'Write or revise the requested deliverable in DRAFT.md using the brief and latest editorial checklist. Preserve the brief. Complete the requested content and check it before handoff.',access:'workspace-write',inputs:['BRIEF.md'],outputs:['DRAFT.md'],writes:['DRAFT.md'],routes:{DONE:'EDITOR',BLOCKED:'NEEDS_ATTENTION'}},
    {id:'EDITOR',name:'Editor',prompt:'Read the brief and actual draft. Verify every original requirement. Approve only with concrete evidence. Otherwise return an ordered checklist of specific repairs and how to verify each. Do not add optional requirements.',access:'read-only',inputs:['BRIEF.md','DRAFT.md'],outputs:[],writes:[],routes:{APPROVE:'COMPLETE',REVISE:'WRITER',BLOCKED:'NEEDS_ATTENTION'}}
  ]}
};
builtins['custom-code']={schemaVersion:1,id:'CUSTOM_CODE',name:'Customizable code builder',allowBuildPlanUpdates:true,start:'PLANNER',maxRuns:40,roles:[
  {id:'PLANNER',name:'Planner',prompt:'Read the request and relevant existing files. Write only AGENTS.md with project constraints and file conventions, and BUILD_PLAN.md with concrete requested requirements, ordered implementation steps, and proportionate acceptance checks. Do not invent requirements or agent teams. Do not build yet. Read back both files before handoff.',access:'workspace-write',inputs:[],outputs:['AGENTS.md','BUILD_PLAN.md'],writes:['AGENTS.md','BUILD_PLAN.md'],routes:{DONE:'BUILDER',BLOCKED:'NEEDS_ATTENTION'}},
  {id:'BUILDER',name:'Builder',prompt:'Read the project instructions and build plan. Implement the requested product using tools. If the latest handoff requests revisions, fix that concrete checklist while preserving working behavior. You may update BUILD_PLAN.md to reflect implementation, even if existing notes call it read-only; retain original requirements. Keep AGENTS.md unchanged. Verify the result proportionately and report evidence and limitations.',access:'workspace-write',inputs:['AGENTS.md','BUILD_PLAN.md'],outputs:[],writes:['*'],routes:{DONE:'REVIEWER',BLOCKED:'NEEDS_ATTENTION'}},
  {id:'REVIEWER',name:'Reviewer',prompt:'Inspect the actual product read-only against every original requirement and build-plan acceptance check. Independently verify behavior with available tools, including the rendered result for visual work when possible. Approve only when required work is verified. Otherwise request revisions with an ordered concrete checklist and verification steps. Do not treat optional improvements as requirements.',access:'read-only',inputs:['AGENTS.md','BUILD_PLAN.md'],outputs:[],writes:[],routes:{APPROVE:'COMPLETE',REVISE:'BUILDER',BLOCKED:'NEEDS_ATTENTION'}}
]};
builtins['code-final-review']=structuredClone(builtins['custom-code']);
builtins['code-final-review'].id='CODE_FINAL_REVIEW';
builtins['code-final-review'].name='Code builder with second final review';
builtins['code-final-review'].roles[2].routes.APPROVE='FINAL_REVIEWER';
builtins['code-final-review'].roles.push({...structuredClone(builtins['custom-code'].roles[2]),id:'FINAL_REVIEWER',name:'Final reviewer',prompt:'Perform an independent final review of the actual product against the original request and build plan. Do not accept the prior review as proof. Verify required behavior and the rendered result when relevant and possible. Approve only with concrete evidence; otherwise give a concrete revision checklist. Report unverified requirements rather than assuming success.'});
export const defaultAgent={schemaVersion:1,id:'GENERAL',name:'General agent',prompt:'Inspect the existing project and its instructions. Use tools to complete the user request, preserving unrelated work. Verify the actual result with proportionate checks. Report changes, evidence, and any remaining blocker.',access:'workspace-write'};
const builderAgent=JSON.parse(fs.readFileSync(new URL('../examples/nova-builder-20b.json',import.meta.url),'utf8'));
function text(value,label,max=12000){if(typeof value!=='string'||!value.trim()||value.length>max)throw Error('Invalid '+label);}
function artifact(value){
  if(typeof value!=='string'||value.length>200||value.includes('\\')||value.split('/').some(p=>!p||p==='.'||p==='..'||/[<>:"|?*\x00-\x1f]/.test(p)||/[. ]$/.test(p)||/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(p))||value.split('/').some(p=>['.git','.conductor'].includes(p.toLowerCase()))||value.toUpperCase()==='REQUEST.MD')throw Error('Unsafe artifact path: '+value);
}
export function validateAgent(agent){
  if(agent?.schemaVersion!==1||!idPattern.test(agent.id))throw Error('Invalid agent ID or schema version');
  text(agent.name,'agent name',100);text(agent.prompt,'agent prompt');
  if(!['workspace-write','read-only'].includes(agent.access))throw Error('Invalid agent access');
  if(agent.model && !modelPattern.test(agent.model))throw Error('Invalid agent model');
  return structuredClone(agent);
}
export function oneShot(agent){
  agent=validateAgent(agent);
  return {schemaVersion:1,id:'ONE_SHOT',name:'One-shot: '+agent.name,start:agent.id,maxRuns:5,agent,roles:[{...agent,inputs:[],outputs:[],writes:agent.access==='read-only'?[]:['*'],routes:{DONE:'COMPLETE',BLOCKED:'NEEDS_ATTENTION'}}]};
}
export function validateTemplate(value){
  const t=structuredClone(value);
  if(t?.schemaVersion!==1||typeof t.id!=='string'||!idPattern.test(t.id))throw Error('Invalid template ID or schema version');
  text(t.name,'template name',150);
  if(t.engine){if(t.engine!=='coding-v1'||JSON.stringify(t)!==JSON.stringify(builtins.code))throw Error('The built-in coding engine is fixed; create a custom workflow instead');return t;}
  if(!Number.isInteger(t.maxRuns)||t.maxRuns<1||t.maxRuns>200)throw Error('Set a bounded maxRuns between 1 and 200');
  if(!Array.isArray(t.roles)||!t.roles.length||t.roles.length>20)throw Error('Provide 1–20 roles');
  const ids=new Set(),owners=new Map();
  for(const r of t.roles){
    if(typeof r.id!=='string'||!idPattern.test(r.id)||ids.has(r.id)||terminals.includes(r.id))throw Error('Duplicate or invalid role ID: '+r.id);
    ids.add(r.id);text(r.name,'role name',100);text(r.prompt,'role prompt');
    if(r.kind!==undefined&&!['agent','robot'].includes(r.kind))throw Error('Invalid role kind');
    if(r.kind==='robot'){validateRobot(r.robot);if(!r.routes?.DONE)throw Error('Robot needs a DONE route');}
    if(!['read-only','workspace-write'].includes(r.access))throw Error('Invalid access for '+r.id);
    if(r.model&&!modelPattern.test(r.model))throw Error('Invalid model for '+r.id);
    for(const field of ['inputs','outputs','writes']){
      if(!Array.isArray(r[field])||r[field].length>100)throw Error('Invalid '+field+' for '+r.id);
      for(const f of r[field])if(!(field==='writes'&&f==='*'))artifact(f);
    }
    if(r.access==='read-only'&&(r.outputs.length||r.writes.length))throw Error('Read-only roles cannot own outputs');
    for(const f of r.writes.filter(f=>f!=='*')){
      const key=f.toLowerCase();if(owners.has(key))throw Error('Competing artifact ownership: '+f);owners.set(key,r.id);
    }
    for(const f of r.outputs)if(!r.writes.includes('*')&&!r.writes.includes(f))throw Error('Output must be writable: '+f);
    if(!r.routes||!Object.keys(r.routes).length||Object.keys(r.routes).some(o=>!outcomes.includes(o)))throw Error('Invalid routes for '+r.id);
    if(r.routes.BLOCKED!=='NEEDS_ATTENTION')throw Error('Each role needs BLOCKED -> NEEDS_ATTENTION');
    if(r.blockedRepairLimit!==undefined&&(!Number.isInteger(r.blockedRepairLimit)||r.blockedRepairLimit<1||r.blockedRepairLimit>2||!r.routes.REVISE))throw Error('Blocked repair requires a REVISE route and a limit of 1–2');
    if(!Object.keys(r.routes).some(o=>o!=='BLOCKED'))throw Error('Role has no success route');
  }
  if(!ids.has(t.start))throw Error('Missing starting role');
  for(const r of t.roles)for(const [o,d] of Object.entries(r.routes)){
    if(!ids.has(d)&&!terminals.includes(d))throw Error('Missing route destination: '+d);
    if(o==='REVISE'&&terminals.includes(d))throw Error('Revision must route to a role');
  }
  const reached=new Set();function visit(id){if(reached.has(id)||!ids.has(id))return;reached.add(id);Object.values(t.roles.find(r=>r.id===id).routes).forEach(visit);}visit(t.start);
  if(reached.size!==ids.size)throw Error('Unreachable role');
  const finishing=new Set(['COMPLETE']);let changed=true;
  while(changed){changed=false;for(const r of t.roles)if(!finishing.has(r.id)&&Object.values(r.routes).some(d=>finishing.has(d))){finishing.add(r.id);changed=true;}}
  if(t.roles.some(r=>!finishing.has(r.id)))throw Error('Every role must have a route to completion');
  return t;
}
export function listLibrary(kind){
  const folder=path.join(libraryRoot(),kind);const saved=fs.existsSync(folder)?fs.readdirSync(folder).filter(f=>f.endsWith('.json')).map(f=>({key:path.join(folder,f),name:path.basename(f,'.json')})):[];
  return kind==='agents'?[{key:'general',name:defaultAgent.name},{key:'nova-builder-20b',name:builderAgent.name},...saved.filter(x=>path.basename(x.key)!=='NOVA_BUILDER_20B.json')]:[...Object.entries(builtins).map(([key,t])=>({key,name:t.name})),...saved];
}
export function loadTemplate(key){return validateTemplate(builtins[key]||JSON.parse(fs.readFileSync(key,'utf8')));}
export function loadAgent(key){return validateAgent(key==='general'?defaultAgent:key==='nova-builder-20b'?builderAgent:JSON.parse(fs.readFileSync(key,'utf8')));}
export function saveLibrary(kind,value){
  value=kind==='agents'?validateAgent(value):validateTemplate(value);
  if(kind==='templates'&&value.engine)throw Error('Built-in coding template cannot be overwritten');
  const folder=path.join(libraryRoot(),kind);fs.mkdirSync(folder,{recursive:true});const file=path.join(folder,value.id+'.json');atomic(file,value);return file;
}
export const customWorkflow=s=>!!s.workflow&&!s.workflow.engine;
export function currentRole(s){const role=s.workflow?.roles.find(r=>r.id===s.role);if(customWorkflow(s)&&!role)throw Error('Unknown workflow role: '+s.role);return role;}
export function workflowPrompt(s){
  const r=currentRole(s);
  return `Original user request (also saved in REQUEST.md):\n${s.prompt}\n\nYou are ${r.name} (${r.id}) in a fresh 16K Codex session. Work in the current project with Codex tools and Windows PowerShell. Preserve REQUEST.md. Follow existing project instructions without expanding the request.\n\nResponsibility:\n${r.prompt}\n\nRead these inputs: ${r.inputs.join(', ')||'the existing project as relevant'}.\nRequired saved outputs: ${r.outputs.join(', ')||'none'}.\nFile access: ${r.access}; writable paths: ${r.writes.join(', ')||'none'}. Other roles own their declared artifacts${s.workflow.allowBuildPlanUpdates&&r.id==='BUILDER'?', except you may update BUILD_PLAN.md':''}; preserve their requirements.\n\n${s.plannerBaseline&&r.access==='read-only'?'Read ../planner-baseline.md for original planner requirements; builder plan updates cannot remove original acceptance requirements.\n\n':''}${s.guidance?'User guidance:\n'+s.guidance+'\n\n':''}${s.handoff?'Latest project handoff:\n'+s.handoff.slice(-6000)+'\n\n':''}Finish with a Markdown heading containing exactly one of: ${Object.keys(r.routes).map(o=>'# '+o).join(', ')}. Follow it with concrete results and verification evidence. For REVISE include an ordered checklist using - [ ] with repairs and how to verify each. Use REVISE for fixable problems when a revision route exists; reserve BLOCKED for obstacles that cannot be passed to that repair role. Do not claim unverified results. Conductor owns routing; no JSON report is required.`;
}
export function canWrite(s,f){
  const r=currentRole(s),owned=new Set(s.workflow.roles.filter(x=>x.id!==r.id).flatMap(x=>x.writes).filter(x=>x!=='*').map(x=>x.toLowerCase()));
  const lower=f.toLowerCase();
  return lower!=='request.md'&&r.access!=='read-only'&&(!owned.has(lower)||(s.workflow.allowBuildPlanUpdates===true&&r.id==='BUILDER'&&lower==='build_plan.md'))&&(r.writes.includes('*')||r.writes.some(x=>x.toLowerCase()===lower));
}
export function assertWorkflowChanges(s,before,after){
  for(const f of new Set([...Object.keys(before),...Object.keys(after)]))if(before[f]!==after[f]&&!canWrite(s,f))throw Error(s.role+' changed a protected file: '+f);
}
export function checkpoint(s,work,dir,before){
  const writable=f=>customWorkflow(s)?canWrite(s,f):s.role==='PLANNER'?['AGENTS.md','BUILD_PLAN.md'].includes(f):s.role==='REVIEWER'?['REVIEW.md','BUILD_CHECKLIST.md'].includes(f):!['AGENTS.md','REVIEW.md','REQUEST.md'].includes(f);
  const backup=path.join(dir,'protected');
  for(const f of Object.keys(before).filter(f=>!writable(f))){const dest=path.join(backup,f);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(path.join(work,f),dest);}
  return after=>{
    const changed=[...new Set([...Object.keys(before),...Object.keys(after)])].filter(f=>before[f]!==after[f]&&!writable(f));
    for(const f of changed){
      const file=path.join(work,f),attempt=path.join(dir,'rejected-edits',f);
      if(after[f]){fs.mkdirSync(path.dirname(attempt),{recursive:true});fs.copyFileSync(file,attempt);}
      if(before[f]){fs.mkdirSync(path.dirname(file),{recursive:true});fs.copyFileSync(path.join(backup,f),file);}
      else if(fs.existsSync(file))fs.unlinkSync(file);
    }
    if(changed.length)atomic(path.join(dir,'rejected-edits.json'),{files:changed,action:'Restored protected originals; preserved attempted edits and allowed product changes.'});
    return changed;
  };
}
export function workflowOutcome(s,work,output,checks){
  const r=currentRole(s);const outcome=output.trim().split(/\r?\n/)[0].replace(/^#+\s*/,'').trim();
  if(!Object.hasOwn(r.routes,outcome)||output.trim().split(/\s+/).length<8)throw Error('Missing valid workflow outcome and evidence');
  if(outcome==='REVISE'&&!/^- \[ \] .+/m.test(output))throw Error('Revision requires a concrete checklist');
  if(!['BLOCKED','REVISE'].includes(outcome))for(const f of r.outputs)if(!fs.existsSync(path.join(work,f))||!fs.statSync(path.join(work,f)).isFile()||!fs.readFileSync(path.join(work,f),'utf8').trim())throw Error('Missing required output: '+f);
  let next=r.routes[outcome];
  // Opt-in editorial fallback: never approve a blocked result, only offer the
  // existing repair role a bounded chance to resolve it. Preserve the outcome.
  if(outcome==='BLOCKED'&&r.blockedRepairLimit&&s.runs.filter(run=>run.role===r.id&&run.status==='FINISHED'&&run.outcome==='BLOCKED').length<r.blockedRepairLimit)next=r.routes.REVISE;
  if(next==='COMPLETE'&&!checks?.passed)next='NEEDS_ATTENTION';
  return {outcome,next};
}
export function initializeWorkflow(root,prompt,model,template,source,initialize){
  template=validateTemplate(template);
  const state=source?importProject(root,source,prompt,model,initialize,{generic:!template.engine}):initialize(root,prompt,model);
  state.workflow=template;state.config.maxRuns=template.maxRuns;
  if(!template.engine){state.role=template.start;state.feedback='';delete state.builderMode;state.guidance='';state.handoff='';}
  state.expected=snapshot(path.join(root,'work'));atomic(path.join(root,'state.json'),state);atomic(path.join(root,'workflow.json'),template);return state;
}
