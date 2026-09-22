import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {affiliateUrl,validateCatalog} from '../newsroom/site/hardware/core.js';
const root=new URL('../newsroom/site/hardware/',import.meta.url);
const config=JSON.parse(await readFile(new URL('config.json',root),'utf8'));
test('Seeed affiliate URLs preserve query values and fragments, replacing duplicate tracking',()=>{
  for(const raw of ['https://www.seeedstudio.com/product.html','https://seeedstudio.com/product.html?q=a%26b%20c&variant=1#details','https://www.seeedstudio.com/product.html?sensecap_affiliate=old&sensecap_affiliate=duplicate&referring_service=old']){
    const url=new URL(affiliateUrl(raw,config));
    assert.deepEqual(url.searchParams.getAll('sensecap_affiliate'),[config.SEEED_AFFILIATE_CODE]);
    assert.deepEqual(url.searchParams.getAll('referring_service'),['link']);
    assert.equal(affiliateUrl(url.href,config),url.href);
    if(url.searchParams.has('q')){assert.equal(url.searchParams.get('q'),'a&b c');assert.equal(url.hash,'#details');}
  }
  assert.equal(new URL(affiliateUrl('https://seeedstudio.com/a',{SEEED_AFFILIATE_CODE:'a&b +?'})).searchParams.get('sensecap_affiliate'),'a&b +?');
});
test('Purchase URLs reject unsafe destinations and missing configuration',()=>{
  for(const url of ['javascript:alert(1)','http://seeedstudio.com/a','https://seeedstudio.com.evil.test/a','https://evil.test/seeedstudio.com','https://user@seeedstudio.com/a'])assert.throws(()=>affiliateUrl(url,config));
  assert.throws(()=>affiliateUrl('https://seeedstudio.com/a',{}));
});
test('Catalog is valid and all local product images exist',async()=>{
  const products=JSON.parse(await readFile(new URL('catalog.json',root),'utf8'));
  validateCatalog(products,config);
  assert.ok(products.filter(p=>p.active).length>=30);
  for(const p of products){const image=await readFile(new URL('images/'+p.id+'.jpg',root));assert.equal(image[0],255);assert.equal(image[1],216);}
  assert.equal(products.some(p=>p.id==='dgx-spark'),false);
  assert.throws(()=>validateCatalog([...products,products[0]],config));
});
