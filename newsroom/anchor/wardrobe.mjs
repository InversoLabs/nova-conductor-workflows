import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url));
export const wardrobe=()=>JSON.parse(fs.readFileSync(path.join(here,'wardrobe.json'),'utf8'));
export function selectPresenter(index,looks=wardrobe()){
  const approved=looks.filter(x=>x.approved===true);if(!approved.length)throw Error('No tested presenter looks available');
  if(!Number.isInteger(index)||index<0)throw Error('Invalid edition index');
  const look=approved[index%approved.length];return {id:look.id,sha256:look.sha256};
}
export function presenterAsset(selected){
  const looks=wardrobe(),look=looks.find(x=>x.id===(selected?.id||'charcoal'));
  if(!look?.approved||!/^presenter-[a-z0-9-]+\.png$/.test(look.file))throw Error('Presenter look is not approved');
  const file=path.join(here,'assets',look.file),hash=crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  if(hash!==look.sha256||(selected&&selected.sha256!==hash))throw Error('Presenter asset changed after selection');
  return file;
}
