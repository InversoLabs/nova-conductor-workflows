import test from 'node:test';
import assert from 'node:assert/strict';
import {selectUnpublished,enrichSources} from '../newsroom/scripts/newsroom.mjs';
const story=(i,host='openai.com')=>({url:`https://${host}/${i}`,excerpt:'short'});
test('blocked ten newest stories cannot hide a usable other publisher',async()=>{
 const list=[...Array.from({length:12},(_,i)=>story(i)),story(20,'huggingface.co')];
 const result=await selectUnpublished(list,[],{enrich:async([s])=>{if(s.url.includes('huggingface'))s.excerpt='x'.repeat(600);else s.enrichmentError='HTTP 403';}});
 assert.equal(result.sources[0].url,'https://huggingface.co/20');assert.equal(result.diagnostics.attempts.length,3);
});
test('search continues past ten unreadable items from the same publisher',async()=>{
 const result=await selectUnpublished(Array.from({length:15},(_,i)=>story(i)),[],{enrich:async([s])=>{if(s.url.endsWith('/14'))s.excerpt='x'.repeat(600);}});
 assert.equal(result.sources[0].url,'https://openai.com/14');assert.equal(result.diagnostics.attempts.length,15);
});
test('published stories excluded and genuine exhaustion has diagnostic counts',async()=>{
 const result=await selectUnpublished([story(1)], [{sources:[{url:'https://openai.com/1'}]}],{enrich:()=>assert.fail('already published')});
 assert.equal(result.sources.length,0);assert.equal(result.diagnostics.unpublished,0);
});
test('HTTP failures remain visible and do not discard useful feed text',async()=>{
 const original=globalThis.fetch;globalThis.fetch=async()=>({ok:false,status:403});
 try{const s={...story(1),excerpt:'x'.repeat(600)};await enrichSources([s]);assert.equal(s.enrichmentError,'HTTP 403');assert.equal(s.excerpt.length,600);}finally{globalThis.fetch=original;}
});

test('collector respects its SOURCES.json-only write contract',async()=>{
 const fs=await import('node:fs');const os=await import('node:os');const path=await import('node:path');const {collect}=await import('../newsroom/scripts/newsroom.mjs');
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'nova-collector-'));const work=path.join(root,'work');fs.mkdirSync(work);
 const previous=process.env.NOVA_NEWSROOM_CONFIG;const original=globalThis.fetch;
 process.env.NOVA_NEWSROOM_CONFIG=path.join(root,'config.json');fs.writeFileSync(process.env.NOVA_NEWSROOM_CONFIG,JSON.stringify({siteUrl:'https://example.test'}));
 globalThis.fetch=async(url)=>String(url).includes('stories.json')?{ok:true,json:async()=>({stories:[]})}:String(url).includes('rss')||String(url).includes('feed.xml')?{ok:true,text:async()=>`<rss><item><link>https://huggingface.co/blog/test</link><title>Source</title><pubDate>${new Date().toUTCString()}</pubDate><description>Short</description></item></rss>`}:{ok:true,text:async()=>'<article>'+('Source facts. '.repeat(80))+'</article>'};
 try{await collect(work);assert.deepEqual(fs.readdirSync(work),['SOURCES.json']);assert.equal(JSON.parse(fs.readFileSync(path.join(work,'SOURCES.json'))).sources.length,1);}finally{globalThis.fetch=original;if(previous===undefined)delete process.env.NOVA_NEWSROOM_CONFIG;else process.env.NOVA_NEWSROOM_CONFIG=previous;fs.rmSync(root,{recursive:true,force:true});}
});
