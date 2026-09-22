import test from 'node:test';
import assert from 'node:assert/strict';
import {selectPresenter,presenterAsset} from '../newsroom/anchor/wardrobe.mjs';
test('rotation uses only approved looks and wraps predictably',()=>{
  const looks=[{id:'original',approved:true,sha256:'a'},{id:'untested',approved:false,sha256:'x'},{id:'navy',approved:true,sha256:'b'},{id:'dress',approved:true,sha256:'c'},{id:'gray',approved:true,sha256:'d'}];
  assert.deepEqual(Array.from({length:6},(_,i)=>selectPresenter(i,looks).id),['original','navy','dress','gray','original','navy']);
  assert.throws(()=>selectPresenter(0,[]),/No tested/);assert.throws(()=>selectPresenter(-1,looks),/Invalid/);
});
test('a saved edition preserves its outfit and rejects a changed image',()=>{
  const selected=selectPresenter(0),saved=JSON.parse(JSON.stringify(selected));assert.equal(presenterAsset(saved),presenterAsset(selected));
  assert.throws(()=>presenterAsset({...saved,sha256:'changed'}),/changed/);
  assert.throws(()=>presenterAsset({id:'unknown',sha256:'x'}),/not approved/);
  assert.match(presenterAsset(),/presenter-v1\.png$/);
});
