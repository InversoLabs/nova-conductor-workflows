const $=s=>document.querySelector(s);let state;
async function api(route,data){const response=await fetch('/api/social'+route,data?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)}:{});const result=await response.json();if(!response.ok)throw Error(result.error||'Request failed');return result;}
async function action(fn){try{$('#message').textContent='Working…';await fn();$('#message').textContent='Saved.';await refresh();}catch(e){$('#message').textContent=e.message;}}
async function refresh(){state=await api('');$('#connection').textContent=state.settings.accountId?`@${state.settings.username} · ${state.settings.enabled?'Publishing enabled':'Preview mode'}`:'Not connected · Preview mode';$('#toggle').textContent=state.settings.enabled?'Pause publishing':'Enable publishing';$('#toggle').disabled=!state.settings.accountId;$('#posts').replaceChildren();$('#empty').hidden=state.posts.length>0;for(const p of state.posts){const el=document.createElement('article');el.className='post';const img=document.createElement('img');img.src='/social-card/'+p.id;img.alt=p.title;const status=document.createElement('small');status.textContent=p.status.toUpperCase()+(p.attempts?' · Attempt '+p.attempts+'/3':'')+(p.mediaId?' · Instagram ID '+p.mediaId:'');const caption=document.createElement('p');caption.textContent=p.caption;el.append(img,status,caption);if(p.lastError){const error=document.createElement("p");error.textContent=p.lastError;el.append(error);}if(p.status!=='published'){const publish=document.createElement('button');publish.textContent=p.status==='preview'?'Publish':'Retry / reconcile';publish.disabled=!state.settings.enabled;publish.onclick=()=>action(()=>api('/publish',{id:p.id}));const unlock=document.createElement('button');unlock.textContent='Recover stale lock';unlock.onclick=()=>action(()=>api('/unlock',{id:p.id}));el.append(publish,unlock);}$('#posts').append(el);}}
$('#connect').onsubmit=async e=>{
  e.preventDefault();const form=e.target,button=form.querySelector('button'),message=$('#connection-message');
  if(button.disabled)return;
  const data=Object.fromEntries(new FormData(form));data.accountId=data.accountId.trim();data.token=data.token.trim();
  if(!/^\d+$/.test(data.accountId)){message.textContent='Enter the numeric Instagram account ID, not the handle or app name.';return;}
  button.disabled=true;button.textContent='Verifying…';message.textContent='Checking your Instagram account and securely saving the connection…';
  try{
    const result=await api('/connect',data);form.elements.token.value='';
    message.textContent=`Connected to @${result.username}. Token saved securely. Publishing is still paused.`;
    await refresh();
  }catch(error){message.textContent='Connection was not verified: '+error.message+' Your token remains in the field so you can retry.';}
  finally{button.disabled=false;button.textContent='Verify & save connection';message.scrollIntoView({block:'nearest',behavior:'smooth'});}
};
$('#toggle').onclick=()=>action(()=>api('/enabled',{enabled:!state.settings.enabled}));refresh().catch(e=>$('#message').textContent=e.message);
