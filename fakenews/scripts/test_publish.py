import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
import publish


class PublicationTest(unittest.TestCase):
    def test_card_retry_keeps_one_article_and_uses_existing_copy(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            incoming = root / 'incoming-test'
            incoming.mkdir()
            story = dict(id='a'*20, title='Committee creates a committee',
                         summary='A fictional office schedules another meeting.',
                         factualSummary='The council held a public meeting.',
                         category='World', publishedAt='2026-09-22T12:00:00Z',
                         paragraphs=['First fictional paragraph.', 'Second fictional paragraph.'],
                         sources=[dict(name='Source', url='https://example.com/story')])
            (incoming/'story.json').write_text(json.dumps(story))
            (incoming/'image.svg').write_text('<svg xmlns="http://www.w3.org/2000/svg"/>')
            with patch.object(publish, 'ROOT', root), patch.object(publish.subprocess, 'run') as card:
                card.side_effect = RuntimeError('card unavailable')
                with self.assertRaisesRegex(RuntimeError, 'card unavailable'):
                    publish.publish(incoming)
                self.assertFalse((root/'publish.lock').exists())
                card.side_effect = None
                publish.publish(incoming)
                edition = json.loads((root/'public/stories.json').read_text())
                self.assertEqual(len(edition['stories']), 1)
                draft = json.loads((root/'social-drafts'/('a'*20+'.json')).read_text(encoding='utf-8'))
                self.assertEqual(draft['status'], 'awaiting_account')
                self.assertIn('/fakenews/story/'+'a'*20+'/', draft['caption'])
                html = (root/'public/story'/('a'*20)/'index.html').read_text(encoding='utf-8')
                self.assertIn('What actually happened', html)
                self.assertIn('SATIRE', html)


if __name__ == '__main__':
    unittest.main()
