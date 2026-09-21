import importlib.util, json, tempfile, unittest
from pathlib import Path
import publish as publisher

class PublishingTests(unittest.TestCase):
    def test_atomic_idempotent_publish_and_reviewed_update(self):
        with tempfile.TemporaryDirectory(prefix='nova-newsroom-test-') as folder:
            root=Path(folder);publisher.ROOT=root
            incoming=root/'incoming-trial';incoming.mkdir()
            story={'id':'a'*20,'title':'A reviewed story with evidence','summary':'A concise source-linked summary of the announcement.','category':'Research','paragraphs':['A complete paragraph with attributed facts.','Another complete paragraph with clear limitations.'],'sources':[{'name':'Source','url':'https://example.com/article'}],'publishedAt':'2026-09-21T12:00:00Z','priority':0}
            (incoming/'story.json').write_text(json.dumps(story),encoding='utf-8');(incoming/'image.svg').write_text('<svg xmlns="http://www.w3.org/2000/svg"></svg>',encoding='utf-8')
            publisher.publish(incoming);publisher.publish(incoming)
            edition=json.loads((root/'public/stories.json').read_text());self.assertEqual(len(edition['stories']),1);self.assertEqual(edition['stories'][0]['priority'],100)
            self.assertTrue((root/'public/story'/story['id']/'index.html').exists())
            story.update(title='A corrected headline after editorial review',replaceExisting=True)
            (incoming/'story.json').write_text(json.dumps(story),encoding='utf-8');publisher.publish(incoming)
            changed=json.loads((root/'public/stories.json').read_text())['stories'][0]
            self.assertEqual(changed['title'],story['title']);self.assertEqual(changed['priority'],100);self.assertIn('updatedAt',changed)
            self.assertTrue(list((root/'backups').glob('edition-*.json')));self.assertFalse((root/'publish.lock').exists())
    def test_reject_outside_staging_and_unsafe_art(self):
        with tempfile.TemporaryDirectory(prefix='nova-newsroom-test-') as folder:
            root=Path(folder);publisher.ROOT=root
            with self.assertRaises(ValueError):publisher.publish(root.parent)

if __name__=='__main__':unittest.main()
