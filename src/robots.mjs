import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {killTree} from './runtime.mjs';

export function validateRobot(robot){
  if(!robot||typeof robot.command!=='string'||!robot.command.trim()||robot.command.length>1000)throw Error('Robot needs a program or executable path');
  if(!Array.isArray(robot.args)||robot.args.length>100||robot.args.some(a=>typeof a!=='string'||a.length>8000))throw Error('Robot arguments must be a JSON array of strings');
  if(!Number.isInteger(robot.timeoutMs)||robot.timeoutMs<1000||robot.timeoutMs>3600000)throw Error('Robot timeout must be 1–3600 seconds');
  return robot;
}
// No shell interpolation. Scripts/programs are explicitly configured by the user,
// outside model-generated instructions. Stop terminates the owned process tree.
export async function runRobot(spec,root,signal){
  const r=validateRobot(spec.robot),work=path.join(root,'work');
  const substitute=s=>s.replaceAll('{project}',root).replaceAll('{workspace}',work);
  return await new Promise((resolve,reject)=>{
    if(signal?.aborted)return reject(Error('Stopped before robot execution'));
    const child=spawn(substitute(r.command),r.args.map(substitute),{cwd:work,env:{...process.env,NOVA_PROJECT_ROOT:root,NOVA_WORKSPACE:work},shell:false,windowsHide:true,stdio:['ignore','pipe','pipe']});
    let output='',failure;const collect=data=>{output=(output+data).slice(-32000);};
    child.stdout.on('data',collect);child.stderr.on('data',collect);
    const stop=()=>{failure=Error('Stopped; robot process terminated');killTree(child);};
    const timer=setTimeout(()=>{failure=Error('Robot deadline exceeded');killTree(child);},r.timeoutMs);
    signal?.addEventListener('abort',stop,{once:true});
    const cleanup=()=>{clearTimeout(timer);signal?.removeEventListener('abort',stop);};
    child.once('error',e=>{cleanup();reject(e);});
    child.once('close',code=>{cleanup();if(failure)return reject(failure);resolve({code,output});});
  });
}
