import {invokePublisher} from '../newsroom/scripts/newsroom.mjs';
import * as artificialSocial from '../fakenews/social/social.mjs';
import * as artificialAnchor from '../fakenews/anchor/automation.mjs';
import {studioBusy} from '../src/studio-lease.mjs';
import {anchorRunning,automationStatus,createAnchorPump} from '../newsroom/anchor/automation.mjs';
import {settings as socialSettings,listPosts,cardFile,connect as connectInstagram,setEnabled as enableInstagram,publishPost,recoverLock,createSocialPump} from '../newsroom/social/social.mjs';
import {config as newsroomConfig,fetchSources,enrichSources,validateStory} from '../newsroom/scripts/newsroom.mjs';
import {readSchedules,saveSchedule,writeSchedules,createScheduler} from '../src/schedules.mjs';
import {atomic,snapshot} from '../src/workflow.mjs';
import {storedKey,storeKey} from '../src/credentials.mjs';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import {spawn,execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {fileURLToPath} from 'node:url';
import {initialize,reopen} from '../src/conductor.mjs';
import {initializeWorkflow,validateTemplate,validateAgent,loadTemplate,loadAgent,listLibrary,saveLibrary,oneShot} from '../src/templates.mjs';
import {loadProvider,saveProvider,providerDefaults,providerKey} from '../src/providers.mjs';
import {openViewer} from '../src/runtime.mjs';
import {CodexConnection} from '../src/rpc.mjs';

const exec=promisify(execFile),base=fileURLToPath(new URL('../',import.meta.url));
const readJSON=file=>JSON.parse(fs.readFileSync(file,'utf8'));
const projectId=root=>crypto.createHash('sha256').update(root.toLowerCase()).digest('hex').slice(0,20);
function tail(file,max=40000){if(!fs.existsSync(file))return '';const fd=fs.openSync(file,'r');try{const size=fs.fstatSync(fd).size,buffer=Buffer.alloc(Math.min(size,max));fs.readSync(fd,buffer,0,buffer.length,Math.max(0,size-buffer.length));return buffer.toString('utf8');}finally{fs.closeSync(fd);}}
function safeFile(root,name){const file=path.resolve(root,name),relative=path.relative(root,file);if(!relative||relative.startsWith('..')||path.isAbsolute(relative))throw Error('Choose a file inside the project');const real=fs.realpathSync(file);if(!real.toLowerCase().startsWith(fs.realpathSync(root).toLowerCase()+path.sep))throw Error('Linked file is outside the project');return real;}
export function createUIServer({projectRoots,launch,connect=async url=>new CodexConnection(url).connect()}={}){
  const roots=projectRoots||[path.join(os.homedir(),'Documents','Nova Conductor Workflow Projects'),path.join(os.homedir(),'Documents','Nova Conductor Projects')];
  const projects=new Map(),jobs=new Map();let origin;
  const redact=value=>{let text=String(value);for(const job of jobs.values())if(job.secret)text=text.split(job.secret).join('[REDACTED]');return text;};
  function summary(root){const s=readJSON(path.join(root,'state.json'));return {id:projectId(root),name:path.basename(root),root,status:s.status,role:s.role,model:s.config.model,provider:s.config.provider,feedback:redact(s.feedback||''),runs:s.runs.length,updated:fs.statSync(path.join(root,'state.json')).mtime.toISOString()};}
  function listProjects(){for(const dir of roots)if(fs.existsSync(dir))for(const entry of fs.readdirSync(dir,{withFileTypes:true}))if(entry.isDirectory()&&!entry.isSymbolicLink()){const root=path.join(dir,entry.name);if(fs.existsSync(path.join(root,'state.json')))projects.set(projectId(root),root);}return [...projects.values()].flatMap(root=>{try{return [summary(root)];}catch{return [];}}).sort((a,b)=>b.updated.localeCompare(a.updated));}
  function anyRunning(){
    if(studioBusy()||anchorRunning()||artificialAnchor.anchorRunning())return true;
    if([...jobs.values()].some(j=>j.child?.exitCode===null))return true;
    listProjects();for(const root of projects.values()){try{const pid=Number(fs.readFileSync(path.join(root,'conductor.lock'),'utf8'));if(Number.isInteger(pid)&&pid>0){process.kill(pid,0);return true;}}catch{}}
    return false;
  }
  function rootFor(id){listProjects();const root=projects.get(id);if(!root)throw Error('Project not found');return root;}
  function stopped(root){const s=readJSON(path.join(root,'state.json'));if(!['READY','STOPPED','COMPLETE','NEEDS_ATTENTION'].includes(s.status))throw Error('Stop the project before making this change');if(fs.existsSync(path.join(root,'conductor.lock'))){const pid=Number(fs.readFileSync(path.join(root,'conductor.lock')));try{process.kill(pid,0);throw Error('Project still has a running controller');}catch(e){if(e.code!=='ESRCH')throw e;}}return s;}
  function libraries(){const warnings=[];const load=kind=>listLibrary(kind).flatMap(item=>{try{return [{...item,value:kind==='agents'?loadAgent(item.key):loadTemplate(item.key)}];}catch(e){warnings.push(item.name+': '+e.message);return [];}});return {templates:load('templates'),agents:load('agents'),warnings};}
  async function start(root,key){
    stopped(root);if(anyRunning())throw Error('Another Conductor run is active. Wait for it to finish or stop it first.');
    const provider=loadProvider(),robotOnly=readJSON(path.join(root,'state.json')).workflow?.roles.every(r=>r.kind==='robot'),secret=key||await storedKey(provider.keyEnv)||(robotOnly?'':providerKey(provider));const env={...process.env};if(provider.keyEnv)env[provider.keyEnv]=secret;
    const child=(launch||((root,env)=>spawn(process.execPath,[path.join(base,'src/conductor.mjs'),'run',root,...(process.env.NOVA_CONDUCTOR_HEADLESS==='1'?['--headless']:[])],{env,windowsHide:true,stdio:['ignore','pipe','pipe']})))(root,env);
    const job={child,secret};jobs.set(projectId(root),job);
    const output=data=>fs.appendFileSync(path.join(root,'ui-controller.log'),redact(data));child.stdout?.on('data',output);child.stderr?.on('data',output);
    child.once('error',error=>{output(error.message);job.secret='';});child.once('close',()=>{job.secret='';});return {started:true};
  }
  async function native(root,action,guidance){
    const state=readJSON(path.join(root,'state.json')),viewer=readJSON(path.join(root,'viewer.json'));
    if(viewer.done||!viewer.threadId||!/^ws:\/\/127\.0\.0\.1:\d+$/.test(viewer.url))throw Error('There is no active Codex session');
    const connection=await connect(viewer.url);
    try{if(action==='steer'){if(state.status!=='PAUSED')throw Error('Pause the worker before sending guidance');if(typeof guidance!=='string'||!guidance.trim()||guidance.length>12000)throw Error('Enter guidance up to 12000 characters');await connection.request('turn/start',{threadId:viewer.threadId,input:[{type:'text',text:guidance,text_elements:[]}],effort:'minimal'});}else{const {thread}=await connection.request('thread/read',{threadId:viewer.threadId,includeTurns:true});const turn=thread.turns?.at(-1);if(!turn?.id)throw Error('No active turn yet');await connection.request('turn/interrupt',{threadId:viewer.threadId,turnId:turn.id});}}finally{connection.close();}return {ok:true};
  }
  async function api(req,url,data){
    const route=url.pathname;
    if(req.method==='GET'&&route==='/api/anchor')return automationStatus();
    if(req.method==='GET'&&route==='/api/artificial-anchor')return artificialAnchor.automationStatus();
    if(req.method==='GET'&&route==='/api/artificial-social')return {settings:artificialSocial.settings(),posts:artificialSocial.listPosts()};
    if(req.method==='POST'&&route==='/api/artificial-social/connect')return artificialSocial.connect(data);
    if(req.method==='POST'&&route==='/api/artificial-social/enabled')return artificialSocial.setEnabled(data.enabled);
    if(req.method==='POST'&&route==='/api/artificial-social/publish')return artificialSocial.publishPost(data.id);
    if(req.method==='POST'&&route==='/api/artificial-social/unlock')return artificialSocial.recoverLock(data.id);
    if(req.method==='GET'&&route==='/api/social')return {settings:socialSettings(),posts:listPosts()};
    if(req.method==='POST'&&route==='/api/social/connect')return connectInstagram(data);
    if(req.method==='POST'&&route==='/api/social/enabled')return enableInstagram(data.enabled);
    if(req.method==='POST'&&route==='/api/social/publish')return publishPost(data.id);
    if(req.method==='POST'&&route==='/api/social/unlock')return recoverLock(data.id);
    if(req.method==='GET'&&route==='/api/newsroom'){const c=newsroomConfig();const r=await fetch(c.siteUrl+'/stories.json?v='+Date.now(),{signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error('Cannot load public newsroom');return r.json();}
    if(req.method==='POST'&&route==='/api/newsroom/draft'){
      const feed=await fetchSources(),urls=(data.story?.sources||[]).map(s=>s.url);feed.sources=feed.sources.filter(s=>urls.includes(s.url));await enrichSources(feed.sources);if(!feed.sources.length||feed.sources.some(s=>s.excerpt.length<500))throw Error('Draft needs a fresh, readable source from the approved newsroom feeds');
      validateStory(data.story,feed.sources);
      const saved=listLibrary('templates').find(t=>t.name==='NEWSROOM');if(!saved)throw Error('Install the newsroom workflow first');
      const template=loadTemplate(saved.key);template.roles=template.roles.filter(r=>r.id!=='COLLECT');template.start='EDITOR';validateTemplate(template);
      const root=path.join(roots[0],'Submitted-story-'+Date.now());const state=initializeWorkflow(root,'Review the submitted story against its sources. Revise if necessary; publish only when accurate. '+(data.update?'The user requests an update to the existing article with the same source URL.':''),data.model||'gpt-oss:20b',template,undefined,initialize);
      fs.writeFileSync(path.join(root,'work','SOURCES.json'),JSON.stringify(feed,null,2));fs.writeFileSync(path.join(root,'work','STORY.json'),JSON.stringify(data.story,null,2));state.newsroomUpdate=data.update===true;state.expected=snapshot(path.join(root,'work'));atomic(path.join(root,'state.json'),state);projects.set(projectId(root),root);return summary(root);
    }
    if(req.method==='POST'&&route==='/api/newsroom/headline'){
      if(data.id!=='auto'&&!/^[a-f0-9]{20}$/.test(data.id||''))throw Error('Invalid story');const c=newsroomConfig(),q=s=>"'"+s.replaceAll("'","''")+"'";
      invokePublisher(c,['--headline',data.id]);return {updated:true};
    }
    if(req.method==='GET'&&route==='/api/schedules'){const projects=listProjects();return readSchedules().map(s=>({...s,runStatus:projects.find(p=>p.id===s.lastProject)?.status}));}
    if(req.method==='POST'&&route==='/api/schedules')return saveSchedule(data);
    if(req.method==='POST'&&route==='/api/schedules/toggle'){const list=readSchedules(),s=list.find(x=>x.id===data.id);if(!s)throw Error('Schedule not found');s.enabled=!!data.enabled;writeSchedules(list);return s;}
    if(req.method==='POST'&&route==='/api/schedules/remove'){writeSchedules(readSchedules().filter(x=>x.id!==data.id));return {removed:true};}
    if(req.method==='POST'&&route==='/api/schedules/run'){const s=readSchedules().find(x=>x.id===data.id);if(!s)throw Error('Schedule not found');const project=await launchScheduled(s);writeSchedules(readSchedules().map(x=>x.id===s.id?{...x,lastProject:project,lastManualRunAt:new Date().toISOString(),lastError:''}:x));return {project};}
    if(req.method==='POST'&&route==='/api/credentials'){return storeKey(loadProvider().keyEnv,data.apiKey);}
    if(req.method==='POST'&&route==='/api/shutdown'){
      if([...jobs.values()].some(j=>j.child&&j.child.exitCode===null))throw Error('Stop the active UI run before closing Conductor.');
      setTimeout(()=>{server.closeAllConnections();server.close();},250);return {closed:true};
    }
    if(req.method==='GET'&&route==='/api/bootstrap')return {...libraries(),provider:loadProvider(),projects:listProjects(),projectHome:roots[0]};
    if(req.method==='GET'&&route==='/api/projects')return listProjects();
    if(req.method==='GET'&&route==='/api/provider-defaults')return providerDefaults(url.searchParams.get('kind'));
    if(req.method==='POST'&&route==='/api/provider')return saveProvider(data);
    if(req.method==='POST'&&route==='/api/models'){
      const p=loadProvider(),key=data.apiKey||providerKey(p);let response;
      try{response=await fetch(p.baseUrl+'/models',{headers:key?{Authorization:'Bearer '+key}:{},redirect:'error',signal:AbortSignal.timeout(10000)});}catch{throw Error('Cannot reach '+p.baseUrl+'. Check the server address.');}
      if(!response.ok)throw Error('Provider returned '+response.status+(response.status===401?': the API key was not accepted.':''));
      return (await response.json()).data?.map(x=>x.id).filter(x=>typeof x==='string')||[];
    }
    if(req.method==='POST'&&route==='/api/templates/validate')return {valid:true,template:validateTemplate(data)};
    if(req.method==='POST'&&route==='/api/templates')return {key:saveLibrary('templates',data)};
    if(req.method==='POST'&&route==='/api/agents')return {key:saveLibrary('agents',validateAgent(data))};
    if(req.method==='POST'&&route==='/api/pick-folder'){
      const script="Add-Type -AssemblyName System.Windows.Forms; $dialog=New-Object System.Windows.Forms.FolderBrowserDialog; $dialog.Description='Choose a project or source folder'; if($dialog.ShowDialog() -eq 'OK'){[Console]::Write($dialog.SelectedPath)}; $dialog.Dispose()";
      const {stdout}=await exec('powershell.exe',['-NoProfile','-STA','-EncodedCommand',Buffer.from(script,'utf16le').toString('base64')],{windowsHide:true,timeout:120000});return {path:stdout.trim()};
    }
    if(req.method==='POST'&&route==='/api/projects/register'){const root=fs.realpathSync(data.path);const result=summary(root);projects.set(result.id,root);return result;}
    if(req.method==='POST'&&route==='/api/projects'){
      if(typeof data.name!=='string'||!/^[A-Za-z0-9][A-Za-z0-9 _-]{0,59}$/.test(data.name))throw Error('Use a project name with letters, numbers, spaces, or dashes');
      const template=data.agent?oneShot(validateAgent(data.agent)):validateTemplate(data.template);
      const root=path.join(roots[0],data.name+'-'+new Date().toISOString().replace(/[-:.TZ]/g,'').slice(0,17));
      initializeWorkflow(root,data.prompt,data.model,template,data.source||undefined,initialize);projects.set(projectId(root),root);return summary(root);
    }
    const match=route.match(/^\/api\/projects\/([a-f0-9]+)(?:\/(\w+))?$/);
    if(match){const root=rootFor(match[1]),action=match[2],s=readJSON(path.join(root,'state.json'));
      if(req.method==='GET'&&!action){
        const files=[];function walk(dir,depth=0){if(depth>5||files.length>300)return;for(const e of fs.readdirSync(dir,{withFileTypes:true})){if(e.isSymbolicLink()||['.git','node_modules','.conductor','.venv'].includes(e.name))continue;const file=path.join(dir,e.name);if(e.isDirectory())walk(file,depth+1);else files.push({name:path.relative(path.join(root,'work'),file).replaceAll('\\','/'),bytes:fs.statSync(file).size});}}walk(path.join(root,'work'));
        const events=tail(path.join(root,'events.jsonl')).split('\n').flatMap(l=>{try{return [JSON.parse(l)];}catch{return [];}}).slice(-100);
        const activity=tail(path.join(root,'activity.jsonl'),120000).split('\n').flatMap(l=>{try{return [JSON.parse(l)];}catch{return [];}}).slice(-40);
        const handoff=s.handoff||tail(path.join(root,'work','BUILD_NOTES.md'),10000);
        return {...summary(root),workflow:s.workflow||loadTemplate('code'),prompt:s.prompt,runs:s.runs,files,events,activity,log:redact(tail(path.join(root,'ui-controller.log'),16000)),handoff:redact(handoff),guidance:s.guidance||''};
      }
      if(req.method==='GET'&&action==='file'){const file=safeFile(path.join(root,'work'),url.searchParams.get('name')||'');if(!/\.(md|txt|html|css|js|mjs|json|csv|py|ps1|svg)$/i.test(file))throw Error('Preview supports text files only');return {text:tail(file,50000)};}
      if(req.method==='POST'&&action==='run')return start(root,data.apiKey);
      if(req.method==='POST'&&action==='stop'){fs.writeFileSync(path.join(root,'stop.request'),'stop');return {requested:true};}
      if(req.method==='POST'&&action==='pause')return native(root,'pause');
      if(req.method==='POST'&&action==='steer')return native(root,'steer',data.guidance);
      if(req.method==='POST'&&action==='reopen'){stopped(root);reopen(root,data.guidance,data.role);return summary(root);}
      if(req.method==='POST'&&action==='terminal'){const v=readJSON(path.join(root,'viewer.json'));if(v.done||!v.threadId)throw Error('Start or continue the project first');openViewer(root);return {opened:true};}
      if(req.method==='POST'&&action==='folder'){spawn('explorer.exe',[path.join(root,'work')],{windowsHide:true,stdio:'ignore'});return {opened:true};}
    }
    throw Object.assign(Error('Route not found'),{status:404});
  }
  const server=http.createServer(async(req,res)=>{
    try{
      const expected='127.0.0.1:'+server.address().port;origin='http://'+expected;
      if(req.headers.host!==expected)throw Object.assign(Error('Invalid local host'),{status:403});
      if(req.headers.origin&&req.headers.origin!==origin)throw Object.assign(Error('Cross-origin request denied'),{status:403});
      const url=new URL(req.url,origin);
      res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Cache-Control','no-store');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'");
      if(url.pathname==='/favicon.ico'){res.statusCode=204;res.end();return;}
      if(req.method==='GET'&&url.pathname.startsWith('/social-card/')){res.setHeader('Content-Type','image/jpeg');res.end(fs.readFileSync(cardFile(url.pathname.slice('/social-card/'.length))));return;}
      if(req.method==='GET'&&url.pathname.startsWith('/artificial-social-card/')){res.setHeader('Content-Type','image/jpeg');res.end(fs.readFileSync(artificialSocial.cardFile(url.pathname.slice('/artificial-social-card/'.length))));return;}
      if(url.pathname==='/health'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify({app:'nova-conductor-ui',version:'0.6.0-preview.1'}));return;}
      if(url.pathname.startsWith('/api/')){
        let data={};if(req.method!=='GET'){if(req.method!=='POST'||req.headers.origin!==origin||!req.headers['content-type']?.startsWith('application/json'))throw Object.assign(Error('A same-origin JSON request is required'),{status:403});let raw='';for await(const part of req){raw+=part;if(raw.length>200000)throw Error('Request too large');}data=JSON.parse(raw||'{}');}
        const result=await api(req,url,data);res.setHeader('Content-Type','application/json');res.end(JSON.stringify(result));return;
      }
      const assets={'/artificial-anchor':'artificial-anchor.html','/artificial-anchor.js':'artificial-anchor.js','/artificial-social':'artificial-social.html','/artificial-social.js':'artificial-social.js','/anchor':'anchor.html','/anchor.js':'anchor.js','/':'index.html','/app.js':'app.js','/style.css':'style.css','/social':'social.html','/social.js':'social.js','/social.css':'social.css'};const name=assets[url.pathname];if(!name)throw Object.assign(Error('Not found'),{status:404});res.setHeader('Content-Type',name.endsWith('.js')?'text/javascript':name.endsWith('.css')?'text/css':'text/html');res.end(fs.readFileSync(path.join(base,'ui',name)));
    }catch(error){res.statusCode=error.status||400;res.setHeader('Content-Type','application/json');res.end(JSON.stringify({error:redact(error.message)}));}
  });
  const launchScheduled=async s=>{
    if(anyRunning())throw Error('Another Conductor run is active');
    const root=path.join(roots[0],s.name.replace(/[^A-Za-z0-9 _-]/g,'').slice(0,50)+'-'+Date.now());
    initializeWorkflow(root,s.prompt,s.model,s.template,undefined,initialize);projects.set(projectId(root),root);await start(root);return projectId(root);
  };
  const scheduler=projectRoots||process.env.NOVA_SCHEDULER_DISABLED==='1'?null:createScheduler({launch:launchScheduled,busy:anyRunning});
  const socialPump=projectRoots||process.env.NOVA_SCHEDULER_DISABLED==='1'?null:createSocialPump();
  const artificialSocialPump=projectRoots||process.env.NOVA_SCHEDULER_DISABLED==='1'?null:artificialSocial.createSocialPump();
  const anchorPump=projectRoots||process.env.NOVA_SCHEDULER_DISABLED==='1'?null:createAnchorPump({busy:anyRunning});
  server.on('close',()=>{scheduler?.close();socialPump?.close();artificialSocialPump?.close();anchorPump?.close();});
  server.stopJobs=()=>{for(const [id,job]of jobs)if(job.child?.exitCode===null){const root=projects.get(id);if(root)fs.writeFileSync(path.join(root,'stop.request'),'stop');}};
  return server;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const server=createUIServer(),port=Number(process.env.NOVA_UI_PORT||18181);
  server.on('error',error=>{console.error(error.code==='EADDRINUSE'?'Conductor UI is already listening on this port.':error.message);process.exitCode=1;});
  server.listen(port,'127.0.0.1',()=>console.log('Nova Conductor UI: http://127.0.0.1:'+server.address().port));
  const stop=()=>{server.stopJobs();setTimeout(()=>{server.closeAllConnections();server.close();},1500);};process.on('SIGINT',stop);process.on('SIGTERM',stop);
}
