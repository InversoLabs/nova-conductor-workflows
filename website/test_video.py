import tempfile
import unittest
from pathlib import Path
from video import serve_video

class VideoTest(unittest.TestCase):
    def test_ranges(self):
        with tempfile.TemporaryDirectory() as folder:
            target = Path(folder)/'test.mp4'
            target.write_bytes(b'0123456789')
            for value, status, body in [('', '200', b'0123456789'), ('bytes=2-4', '206', b'234'), ('bytes=-3', '206', b'789'), ('bytes=8-', '206', b'89'), ('bytes=99-', '416', b''), ('bytes=-0', '416', b''), ('bytes=0-1,3-4', '416', b'')]:
                captured = []
                result = serve_video({'REQUEST_METHOD':'GET', 'HTTP_RANGE':value}, lambda s,h:captured.append((s,dict(h))), target)
                self.assertEqual(b''.join(result), body)
                self.assertTrue(captured[0][0].startswith(status))
                self.assertEqual(int(captured[0][1]['Content-Length']), len(body))
            captured = []
            self.assertEqual(serve_video({'REQUEST_METHOD':'HEAD'}, lambda s,h:captured.append(dict(h)), target), [])
            self.assertEqual(captured[0]['Content-Length'], '10')

if __name__ == '__main__':
    unittest.main()
