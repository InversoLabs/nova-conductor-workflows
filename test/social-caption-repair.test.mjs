import test from 'node:test';
import assert from 'node:assert/strict';
import {completeCaption,validateCaption} from '../newsroom/social/social.mjs';
const story={url:'https://inversolabs.us/newsroom/story/e9f63aa1f7aaa02f4024/'};
test('card preparation fills omitted canonical URL before review, idempotently',()=>{
  const body='A sourced news briefing. Read the full briefing at the link in our bio.\n#AI';
  const caption=completeCaption({caption:body},story);
  assert.equal(caption,body+'\n\n'+story.url);
  assert.equal(completeCaption({caption},story),caption);
  assert.equal(validateCaption({caption},story),caption);
});
test('repair does not bypass unexpected links, placeholders or caption limit',()=>{
  assert.throws(()=>completeCaption({caption:'Read this briefing at https://example.com/wrong'},story));
  assert.throws(()=>completeCaption({caption:'A'.repeat(1790)},story),/40–1800/);
  assert.throws(()=>completeCaption({caption:'TODO replace this caption with a real story'},story),/Placeholder/);
  assert.throws(()=>completeCaption({},story));
});

test('verified source URL is replaced before review, but lookalikes are rejected',()=>{
  const source='https://huggingface.co/blog/omlx';
  const published={...story,sources:[{name:'Hugging Face',url:source}]};
  const caption='A sourced briefing about local AI development. Read more: '+source;
  const repaired=completeCaption({caption},published);
  assert.equal(repaired,caption.replace(source,story.url));
  assert.equal(completeCaption({caption:repaired},published),repaired);
  assert.throws(()=>completeCaption({caption:caption+'-unverified'},published));
  assert.throws(()=>completeCaption({caption:caption+' https://unapproved.example/'},published));
});
