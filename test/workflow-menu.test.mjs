import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

test('PowerShell guided menus save a reusable agent, workflow, and coding duplicate',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'nova-menu-'));const base=fileURLToPath(new URL('../',import.meta.url));
 const script=`$ErrorActionPreference='Stop'\n$cli=Join-Path '${base.replaceAll("'","''")}' 'src/conductor.mjs'\n. (Join-Path '${base.replaceAll("'","''")}' 'Workflow-Menu.ps1')\n$script:answers=[Collections.Generic.Queue[string]]::new()\nfunction Read-Host {param($Prompt);if(-not $script:answers.Count){throw ('Unexpected prompt: '+$Prompt)};return $script:answers.Dequeue()}\n@('N','MENU_AGENT','Menu agent','Complete the user request.','workspace-write','inherit') | ForEach-Object {$script:answers.Enqueue($_)}\n$null=Edit-Agent\n@('N','MENU_WORKFLOW','Menu workflow','5','1','WORKER','Worker','Complete the user request.','workspace-write','-','proof.txt','proof.txt','inherit','N','COMPLETE','WORKER') | ForEach-Object {$script:answers.Enqueue($_)}\n$null=Edit-Template\n@('E','1','CODE_COPY','Coding copy') | ForEach-Object {$script:answers.Enqueue($_)};1..50 | ForEach-Object {$script:answers.Enqueue('')}\n$null=Edit-Template\n`;
 try{execFileSync('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-EncodedCommand',Buffer.from(script,'utf16le').toString('base64')],{env:{...process.env,NOVA_WORKFLOW_LIBRARY:dir},windowsHide:true,stdio:'pipe'});assert.equal(JSON.parse(fs.readFileSync(path.join(dir,'agents','MENU_AGENT.json'))).name,'Menu agent');assert.equal(JSON.parse(fs.readFileSync(path.join(dir,'templates','MENU_WORKFLOW.json'))).roles[0].routes.DONE,'COMPLETE');assert.equal(JSON.parse(fs.readFileSync(path.join(dir,'templates','CODE_COPY.json'))).roles.length,3);}finally{fs.rmSync(dir,{recursive:true,force:true});}
});
