export function latestHeadlines(stories){
  if(!Array.isArray(stories)||!stories.length)throw Error('No published ticker headlines available');
  const seen=new Set();
  const valid=stories.filter(story=>{
    if(!story.id||typeof story.title!=='string'||!story.title.trim()||!Number.isFinite(Date.parse(story.publishedAt)))throw Error('Invalid published headline');
    if(seen.has(story.id))return false;seen.add(story.id);return true;
  });
  return valid.sort((a,b)=>Date.parse(b.publishedAt)-Date.parse(a.publishedAt)||a.id.localeCompare(b.id)).slice(0,6);
}
