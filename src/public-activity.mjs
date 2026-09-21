// Only visible messages and completed tool results belong in the UI transcript.
// Raw reasoning tokens and internal protocol payloads are deliberately excluded.
export function publicActivity(event){
  if(event.method!=='item/completed')return null;
  const item=event.params?.item;if(!item)return null;
  const at=new Date().toISOString();
  if(item.type==='agentMessage')return {at,type:'message',phase:item.phase||'final',text:String(item.text||'').slice(-16000)};
  if(item.type==='commandExecution')return {at,type:'command',text:String(item.command||'Command').slice(0,2000),output:String(item.aggregatedOutput||'').slice(-12000),status:item.status,exitCode:item.exitCode};
  if(item.type==='fileChange')return {at,type:'files',text:(item.changes||[]).map(c=>(c.kind?.type||'updated')+' '+c.path).join('\n').slice(0,8000),status:item.status};
  return null;
}
