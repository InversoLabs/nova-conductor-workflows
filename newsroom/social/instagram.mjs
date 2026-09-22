// Instagram Login API. Never log provider response bodies or credential-bearing URLs.
export class Instagram {
  constructor({token,accountId,version='v22.0',fetcher=fetch,sleep=ms=>new Promise(r=>setTimeout(r,ms))}) {
    if(!token||!/^\d+$/.test(accountId)||!/^v\d+\.0$/.test(version))throw Error('Connect an Instagram professional account first');
    Object.assign(this,{token,accountId,version,fetcher,sleep});
  }
  async request(endpoint,fields={},method='GET') {
    const url=new URL(`https://graph.instagram.com/${this.version}/${endpoint}`);
    const options={method,headers:{Authorization:`Bearer ${this.token}`},signal:AbortSignal.timeout(30000)};
    if(method==='GET')url.search=new URLSearchParams(fields).toString();
    else options.body=new URLSearchParams(fields);
    let response;
    for(let attempt=0;attempt<3;attempt++){
      try{response=await this.fetcher(url,{...options,signal:AbortSignal.timeout(30000)});}catch{if(method==='GET'&&attempt<2){await this.sleep(1000*2**attempt);continue;}throw Error('Instagram connection interrupted; inspect delivery status before retrying');}
      if(method==='GET'&&(response.status===429||response.status>=500)&&attempt<2){await this.sleep(1000*2**attempt);continue;}break;
    }
    let body;try{body=await response.json();}catch{throw Error('Instagram returned an unreadable response; inspect delivery status');}
    if(!response.ok||body.error)throw Error(`Instagram HTTP ${response.status} (code ${Number(body.error?.code)||0}). Check connection, permissions, or rate limits.`);
    return body;
  }
  identity(){return this.request(this.accountId,{fields:'id,user_id,username'});}
  create(caption,imageUrl){return this.request(this.accountId+'/media',{caption,image_url:imageUrl},'POST');}
  status(id){return this.request(id,{fields:'status_code'});}
  publish(id){return this.request(this.accountId+'/media_publish',{creation_id:id},'POST');}
  recent(){return this.request(this.accountId+'/media',{fields:'id,caption,permalink',limit:'25'});}
}

export function verifyIdentity(who,accountId){
  const ids=[who?.id,who?.user_id].filter(v=>typeof v==='string'||Number.isSafeInteger(v)).map(String).filter(v=>/^\d+$/.test(v));
  if(typeof who?.username!=='string'||!who.username.trim())throw Error('Instagram replied without a username. Check that this is an Instagram User token with instagram_business_basic permission.');
  if(!ids.includes(accountId))throw Error('Instagram returned an account ID that does not match the entered ID. Use the Instagram account ID shown under Generate access tokens, not the Meta app ID.');
  return {accountId,username:who.username};
}

// Persist intent BEFORE every mutation. An ambiguous publish is never submitted twice.
export async function deliver({client,record,save,caption,imageUrl,sleep=ms=>new Promise(r=>setTimeout(r,ms))}) {
  if(record.status==='published')return record;
  if(record.status==='publishing'||record.status==='uncertain') {
    const recent=await client.recent();
    const matches=(recent.data||[]).filter(p=>p.caption===caption);
    if(matches.length===1){Object.assign(record,{status:'published',mediaId:matches[0].id,permalink:matches[0].permalink});save(record);return record;}
    throw Error('Delivery uncertain. Check Instagram and reconcile the post; automatic reposting is held.');
  }
  // An orphaned container is not a published post. Recreating it is safe because
  // publication cannot start until its ID has been durably saved.
  if(!record.containerId){record.status='creating';save(record);const result=await client.create(caption,imageUrl);if(!/^\d+$/.test(result.id||''))throw Error('Instagram returned no container ID');record.containerId=result.id;record.status='processing';save(record);}
  let ready=false;
  for(let i=0;i<6;i++){
    const result=await client.status(record.containerId);
    if(result.status_code==='FINISHED'){ready=true;break;}
    if(result.status_code==='PUBLISHED'){record.status='uncertain';save(record);return deliver({client,record,save,caption,imageUrl,sleep});}
    if(['ERROR','EXPIRED'].includes(result.status_code)){delete record.containerId;record.status='preview';save(record);throw Error('Instagram container '+result.status_code+'. Retry to create a fresh image container.');}
    await sleep(2000);
  }
  if(!ready)throw Error('Image is still processing. Retry to check the same container.');
  record.status='publishing';save(record);
  try{const result=await client.publish(record.containerId);if(!/^\d+$/.test(result.id||''))throw Error('No media ID');record.status='published';record.mediaId=result.id;save(record);}
  catch{record.status='uncertain';save(record);throw Error('Instagram publish response was uncertain. Retry will reconcile, never blindly repost.');}
  return record;
}
