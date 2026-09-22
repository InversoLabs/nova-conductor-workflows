"""Stream MP4 files with byte ranges for seeking and remote video ingestion."""
import re

def serve_video(environ, start_response, target):
    size = target.stat().st_size
    begin, end, status = 0, size - 1, '200 OK'
    value = environ.get('HTTP_RANGE', '')
    headers = [('Content-Type', 'video/mp4'), ('Accept-Ranges', 'bytes'),
               ('Cache-Control', 'public, max-age=3600'), ('X-Content-Type-Options', 'nosniff')]
    if value:
        match = re.fullmatch(r'bytes=(\d*)-(\d*)', value)
        valid = bool(match and any(match.groups()) and size)
        if valid:
            first, last = match.groups()
            if first:
                begin = int(first)
                end = min(int(last), size-1) if last else size-1
            else:
                begin = max(0, size-int(last))
            valid = 0 <= begin <= end < size
        if not valid:
            start_response('416 Range Not Satisfiable', headers+[('Content-Range', f'bytes */{size}'), ('Content-Length', '0')])
            return []
        status = '206 Partial Content'
        headers.append(('Content-Range', f'bytes {begin}-{end}/{size}'))
    length = max(0, end-begin+1)
    start_response(status, headers+[('Content-Length', str(length))])
    if environ['REQUEST_METHOD'] == 'HEAD':
        return []
    def chunks():
        with target.open('rb') as stream:
            stream.seek(begin)
            remaining = length
            while remaining:
                block = stream.read(min(65536, remaining))
                if not block:
                    break
                remaining -= len(block)
                yield block
    return chunks()
