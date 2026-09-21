import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const exec=promisify(execFile);
const file=name=>{if(!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name))throw Error('Invalid credential variable');return path.join(process.env.LOCALAPPDATA||os.homedir(),'NovaConductor','credentials',name+'.dpapi');};
export async function storedKey(name){
  if(!name)return '';if(process.env[name])return process.env[name];const location=file(name);if(!fs.existsSync(location))return '';
  const script="$ErrorActionPreference='Stop';[void][Reflection.Assembly]::LoadWithPartialName('System.Security');$bytes=[Convert]::FromBase64String([IO.File]::ReadAllText($env:NOVA_CREDENTIAL_FILE));$clear=[Security.Cryptography.ProtectedData]::Unprotect($bytes,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser);[Console]::Write([Text.Encoding]::UTF8.GetString($clear));exit 0";
  const {stdout}=await exec('powershell.exe',['-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(script,'utf16le').toString('base64')],{env:{...process.env,NOVA_CREDENTIAL_FILE:location},windowsHide:true,timeout:60000});return stdout;
}
export async function storeKey(name,key){
  if(typeof key!=='string'||!key||key.length>10000)throw Error('Enter an API key');const location=file(name);fs.mkdirSync(path.dirname(location),{recursive:true});
  const script="$ErrorActionPreference='Stop';[void][Reflection.Assembly]::LoadWithPartialName('System.Security');$bytes=[Text.Encoding]::UTF8.GetBytes($env:NOVA_CREDENTIAL_VALUE);$cipher=[Security.Cryptography.ProtectedData]::Protect($bytes,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser);[IO.File]::WriteAllText($env:NOVA_CREDENTIAL_FILE,[Convert]::ToBase64String($cipher));exit 0";
  await exec('powershell.exe',['-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(script,'utf16le').toString('base64')],{env:{...process.env,NOVA_CREDENTIAL_FILE:location,NOVA_CREDENTIAL_VALUE:key},windowsHide:true,timeout:60000});return {saved:true};
}
