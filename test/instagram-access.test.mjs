import test from 'node:test';
import assert from 'node:assert/strict';
import {Instagram} from '../newsroom/social/instagram.mjs';
test('Meta API access block is actionable without leaking provider response',async()=>{
 const client=new Instagram({token:'not-for-logs',accountId:'123',fetcher:async()=>({ok:false,status:400,json:async()=>({error:{code:200,message:'API access blocked.',extra:'not-for-logs'}})})});
 await assert.rejects(client.identity(),e=>e.code==='INSTAGRAM_ACCESS_BLOCKED'&&e.message.includes('Meta app dashboard')&&!e.message.includes('not-for-logs'));
});
test('other permission errors are not mislabeled as an app block',async()=>{
 const client=new Instagram({token:'not-for-logs',accountId:'123',fetcher:async()=>({ok:false,status:400,json:async()=>({error:{code:200,message:'Different permission error'}})})});
 await assert.rejects(client.identity(),e=>e.code!=='INSTAGRAM_ACCESS_BLOCKED'&&e.message.includes('code 200'));
});
