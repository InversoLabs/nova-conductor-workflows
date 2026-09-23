import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url));
export const cast={
  vera:{name:'Vera Volt',file:'vera-volt.png',voice:'af_sarah',shot:'desk'},
  vera_left:{name:'Vera Volt',file:'vera-volt-left.png',voice:'af_sarah',shot:'desk'},
  vera_right:{name:'Vera Volt',file:'vera-volt-right.png',voice:'af_sarah',shot:'desk'},
  miles:{name:'Miles Byte',file:'miles-byte.png',voice:'am_adam',shot:'close'},
  iris:{name:'Iris Field',file:'iris-field.png',voice:'af_nicole',shot:'full'}
};
export function castAsset(id){if(!cast[id])throw Error('Unknown cast member');return path.join(here,'assets',cast[id].file);}
export function castHashes(){return Object.fromEntries(Object.keys(cast).map(id=>[id,crypto.createHash('sha256').update(fs.readFileSync(castAsset(id))).digest('hex')]));}
export function verifyCast(b){const current=castHashes();for(const id of Object.keys(cast))if(b.castHashes?.[id]!==current[id])throw Error('Cast image changed after bulletin approval');}
export function buildShow(selected,headlines,now=new Date()){
  if(selected.length!==5||new Set(selected.map(s=>s.id)).size!==5)throw Error('A full show requires five distinct approved stories');
  const editionDate=new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',month:'long',day:'numeric',year:'numeric'}).format(now);
  const segments=[];
  const add=(speaker,title,text,storyId)=>segments.push({speaker,shot:cast[speaker].shot,presenter:cast[speaker].name,title,text,...(storyId?{storyId}:{})});
  add('vera','Humanity, under observation | '+editionDate,"Good evening. I'm Vera Volt, and this is The Artificial News. Five stories from the species that invented both the wheel and the mandatory team-building webinar. Let's investigate.");
  selected.forEach((s,i)=>{
    if(i===1||i===3){const speaker=i===1?'miles':'iris',name=cast[speaker].name;
      add('vera',s.title,`For our next story, ${name} has been observing the humans at dangerously close range. ${name.split(' ')[0]}, what have you found?`);
      add(speaker,s.title,s.summary,s.id);
      add('vera','Back at the desk',i===1?"Thank you, Miles. Our processors have logged that as progress, then immediately filed an appeal.":"Thank you, Iris. Please keep a safe distance from any human carrying a clipboard. Back to the headlines.");
    }else add('vera',s.title,s.summary,s.id);
  });
  add('vera','The Artificial News',"That concludes tonight's human behavior report. I'm Vera Volt. Stay curious, stay charged, and if a meeting could have been an email, delete the meeting. Good night.");
  return {id:'show-'+crypto.createHash('sha256').update(selected.map(s=>s.id).join('|')).digest('hex').slice(0,20),kind:'scheduled',format:'full-show-v1',editionDate,createdAt:now.toISOString(),presenter:{id:'vera'},castHashes:castHashes(),stories:selected,headlines,segments};
}
