import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import {fileURLToPath,pathToFileURL} from 'node:url';

test('native workflow runner executes writing roles and one-shot through bundled proxy', {skip:process.env.CONDUCTOR_NATIVE_TEST!=='1',timeout:120000},async t=>{
 const parent=fs.mkdtempSync(path.join(os.tmpdir(),'nova-native-workflows-'));const copy=path.join(parent,'package');fs.mkdirSync(copy);
 const base=fileURLToPath(new URL('../',import.meta.url));fs.copyFileSync(path.join(base,'package.json'),path.join(copy,'package.json'));for(const d of ['src','infrastructure'])fs.cpSync(path.join(base,d),path.join(copy,d),{recursive:true});
 const launcher=path.join(copy,'infrastructure','nova-codex-interactive.ps1');fs.writeFileSync(launcher,fs.readFileSync(launcher,'utf8').replace('Local\\NOVA.Codex.Remote.Session',`Local\\Conductor.Workflow.Test.${process.pid}`).replace("Join-Path $env:LOCALAPPDATA 'NOVA-Codex'",`'${parent.replaceAll("'","''")}/codex-home'`));
 const {initialize,run}=await import(pathToFileURL(path.join(copy,'src/conductor.mjs')));
 const {initializeWorkflow,builtins,oneShot,defaultAgent}=await import(pathToFileURL(path.join(copy,'src/templates.mjs')));
 let calls=0;const seen=[];const upstream=http.createServer(async(req,res)=>{
  try{
   let raw='';for await(const part of req)raw+=part;const body=JSON.parse(raw);calls++;
   const text=JSON.stringify(body.input);const editor=text.includes('(EDITOR)');const producer=text.includes('(PRODUCER)');const writer=text.includes('(WRITER)');
   const role=editor?'EDITOR':producer?'PRODUCER':writer?'WRITER':'GENERAL';seen.push({role,model:body.model});
   const file=producer?'BRIEF.md':writer?'DRAFT.md':'proof.txt';
   const applied=(body.input||[]).some(i=>i.type==='function_call_output');
   const tool=!editor&&!applied;
   const result=editor?'# APPROVE\nRead the brief and draft; the requested robot story has a beginning and ending.':'# DONE\nSaved the requested output using the file tool and confirmed successful execution.';
   const item=tool?{type:'function_call',id:'fc_'+calls,call_id:'call_'+calls,name:'apply_patch',arguments:JSON.stringify({input:'*** Begin Patch\n*** Add File: '+file+'\n+A robot helps its neighbor and returns safely home.\n*** End Patch'})}:{type:'message',id:'msg_'+calls,role:'assistant',status:'completed',content:[{type:'output_text',text:result,annotations:[]}]};
   res.writeHead(200,{'content-type':'text/event-stream'});const send=e=>res.write('event: '+e.type+'\ndata: '+JSON.stringify(e)+'\n\n');
   send({type:'response.created',response:{id:'resp_'+calls,status:'in_progress',output:[]}});send({type:'response.output_item.added',output_index:0,item:tool?{...item,arguments:''}:item});
   if(tool){send({type:'response.function_call_arguments.delta',item_id:item.id,output_index:0,delta:item.arguments});send({type:'response.function_call_arguments.done',item_id:item.id,output_index:0,arguments:item.arguments});}
   send({type:'response.output_item.done',output_index:0,item});send({type:'response.completed',response:{id:'resp_'+calls,status:'completed',output:[item],usage:{input_tokens:20,output_tokens:20,total_tokens:40}}});res.end();
  }catch(error){res.writeHead(500);res.end(error.message);}
 });
 await new Promise(r=>upstream.listen(0,'127.0.0.1',r));t.after(()=>{upstream.closeAllConnections();upstream.close();const exe=path.join(parent,'codex-home','.sandbox-bin','codex.exe');if(fs.existsSync(exe))fs.unlinkSync(exe);});
 for(const kind of ['writing','one-shot']){
  const root=path.join(parent,kind);const template=kind==='writing'?structuredClone(builtins.writing):oneShot(defaultAgent);if(kind==='writing')template.roles[2].model='editor-native-test';
  const s=initializeWorkflow(root,'Write a short robot story.','workflow-native-test',template,null,initialize);s.config.port=18819;s.config.provider={kind:'ollama',baseUrl:`http://127.0.0.1:${upstream.address().port}/v1`,keyEnv:''};fs.writeFileSync(path.join(root,'state.json'),JSON.stringify(s));
  const done=await run(root,{visible:false});assert.equal(done.status,'COMPLETE',done.feedback);assert.equal(done.runs.length,kind==='writing'?3:1);assert.ok(fs.existsSync(path.join(root,'work',kind==='writing'?'DRAFT.md':'proof.txt')));assert.equal(fs.existsSync(path.join(root,'conductor.lock')),false);
 }
 assert.ok(seen.some(x=>x.role==='EDITOR'&&x.model==='editor-native-test'));assert.equal(calls,7);
 console.log('Native workflow trial artifacts: '+parent);
});
