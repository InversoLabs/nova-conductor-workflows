// Explicit crash recovery. Never clears a live renderer's reservation.
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {studioLeaseFile} from '../../src/studio-lease.mjs';
import {atomic} from '../../src/workflow.mjs';
import {ollama} from './gpu.mjs';
const file=studioLeaseFile();
if(!fs.existsSync(file)){console.log('No studio reservation needs recovery.');process.exit(0);}
const lease=JSON.parse(fs.readFileSync(file,'utf8'));
if(!Number.isInteger(lease.pid)||lease.pid<1)throw Error('Unrecognized reservation; inspect it before recovery');
try{process.kill(lease.pid,0);throw Error('The studio owner is still running; stop it normally first.');}catch(error){if(error.code!=='ESRCH')throw error;}
if(process.platform==='win32'){
  const script='$ProgressPreference="SilentlyContinue"; @(Get-CimInstance Win32_Process | Where-Object {$_.Name -eq "python.exe" -and $_.CommandLine -like "*inference.py*"} | Select-Object -ExpandProperty ProcessId) | ConvertTo-Json -Compress';
  const result=execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(script,'utf16le').toString('base64')],{encoding:'utf8',windowsHide:true,timeout:30000}).trim();
  if(result&&JSON.parse(result)?.length!==0)throw Error('An inference process is still present. Inspect it before restoring models.');
}
lease.pid=process.pid;lease.status='restoring';atomic(file,lease);
try{
  for(const model of lease.models||[])await ollama('generate',{model:model.name,stream:false,keep_alive:-1,options:{num_ctx:model.context_length||16384}});
  const loaded=(await ollama('ps')).models||[];
  if((lease.models||[]).some(model=>!loaded.some(item=>item.name===model.name)))throw Error('A recorded model did not reload');
  fs.unlinkSync(file);console.log('Recorded models restored; Conductor can run again.');
}catch(error){lease.status='restore-failed';atomic(file,lease);throw error;}
