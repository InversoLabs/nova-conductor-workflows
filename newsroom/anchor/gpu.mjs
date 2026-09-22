import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {studioLeaseFile} from '../../src/studio-lease.mjs';
import {atomic} from '../../src/workflow.mjs';

export async function ollama(route,body){
  const response=await fetch('http://127.0.0.1:11434/api/'+route,{method:body?'POST':'GET',headers:{'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(180000)});
  if(!response.ok)throw Error('Ollama '+route+' failed: '+response.status);
  return response.json();
}
export function activeControllers(){
  for(const name of ['Nova Conductor Workflow Projects','Nova Conductor Projects']){
    const root=path.join(os.homedir(),'Documents',name);if(!fs.existsSync(root))continue;
    for(const entry of fs.readdirSync(root,{withFileTypes:true})){
      if(!entry.isDirectory()||entry.isSymbolicLink())continue;
      const lock=path.join(root,entry.name,'conductor.lock');if(!fs.existsSync(lock))continue;
      const pid=Number(fs.readFileSync(lock,'utf8'));if(!Number.isInteger(pid)||pid<1)throw Error('Unrecognized project lock: '+entry.name);
      try{process.kill(pid,0);return true;}catch(error){if(error.code!=='ESRCH')throw error;}
    }
  }
  return false;
}
export async function withGPU(work,{api=ollama,busy=activeControllers,file=studioLeaseFile()}={}){
  fs.mkdirSync(path.dirname(file),{recursive:true});
  const lease={pid:process.pid,startedAt:new Date().toISOString(),status:'reserving',models:[]};
  fs.writeFileSync(file,JSON.stringify(lease),{flag:'wx'});
  let unloaded=false;
  try{
    if(busy())throw Error('An active Conductor worker still needs the model; retry after it finishes.');
    lease.models=(await api('ps')).models||[];
    lease.status='unloading';atomic(file,lease);unloaded=true;
    for(const model of lease.models)await api('generate',{model:model.name,keep_alive:0,stream:false});
    if((await api('ps')).models?.length)throw Error('Ollama still has a loaded model; rendering held.');
    lease.status='rendering';atomic(file,lease);
    return await work();
  }finally{
    let restored=!unloaded;
    try{
      if(unloaded){lease.status='restoring';atomic(file,lease);for(const model of lease.models)await api('generate',{model:model.name,stream:false,keep_alive:-1,options:{num_ctx:model.context_length||16384}});restored=true;}
    }finally{
      if(restored)fs.unlinkSync(file);
      else {lease.status='restore-failed';atomic(file,lease);}
    }
  }
}
