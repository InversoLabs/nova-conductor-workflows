"""Dependency-free public homepage with the previous public routes preserved."""
import argparse
import mimetypes
from pathlib import Path
from socketserver import ThreadingMixIn
from wsgiref.simple_server import WSGIServer, make_server
from legacy.foundry.registry_auth_runtime import RegistryAuthApp, load_public_registry_identity, LANDING_HTML

ROOT = Path(__file__).resolve().parent
legacy = RegistryAuthApp(load_public_registry_identity(ROOT / 'legacy/config/mcp_registry_identity.json'))
FILES = {'/': ('index.html', 'text/html; charset=utf-8'), '/style.css': ('style.css', 'text/css; charset=utf-8'), '/main.js': ('main.js', 'text/javascript; charset=utf-8'), '/favicon.svg': ('favicon.svg', 'image/svg+xml')}
FILES['/conductor'] = FILES['/conductor/'] = ('conductor.html', 'text/html; charset=utf-8')
FILES['/products.css'] = ('products.css', 'text/css; charset=utf-8')
FILES['/favicon.ico'] = FILES['/favicon.svg']
ARCHIVE = LANDING_HTML.replace(b'<body>', b'<body><aside style="padding:16px 6%;background:#e4edce;color:#243018;font:14px/1.5 system-ui">Archived page &mdash; retained as an earlier chapter. Product availability and pricing shown below are historical, not a current offer. <a href="/" style="color:inherit;text-decoration:underline">Visit the new Inverso Labs homepage &rarr;</a></aside>', 1)

def respond(environ, start_response, body, content_type, status='200 OK'):
    start_response(status, [('Content-Type', content_type), ('Content-Length', str(len(body))), ('Cache-Control', 'no-cache'), ('X-Content-Type-Options', 'nosniff'), ('Referrer-Policy', 'strict-origin-when-cross-origin'), ('X-Frame-Options', 'SAMEORIGIN'), ('Content-Security-Policy', "default-src 'self'; script-src 'self' https://static.cloudflareinsights.com; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'self'")])
    return [b'' if environ['REQUEST_METHOD'] == 'HEAD' else body]

def app(environ, start_response):
    path = environ.get('PATH_INFO', '/')
    if path == '/newsroom' or path.startswith('/newsroom/'):
        if environ['REQUEST_METHOD'] not in {'GET', 'HEAD'}:
            return respond(environ, start_response, b'Method not allowed', 'text/plain', '405 Method Not Allowed')
        relative = path[len('/newsroom/'): ] if path.startswith('/newsroom/') else ''
        relative = relative or 'index.html'
        folder = (ROOT / 'newsroom' / 'public').resolve()
        target = (folder / relative).resolve()
        if target.is_dir(): target = target / 'index.html'
        if folder not in target.parents or not target.is_file() or target.suffix not in {'.html','.css','.js','.json','.svg','.xml'}:
            return respond(environ, start_response, b'Not found', 'text/plain', '404 Not Found')
        return respond(environ, start_response, target.read_bytes(), mimetypes.guess_type(target.name)[0] or 'application/octet-stream')

    if path in FILES or path in {'/archive', '/archive/', '/healthz', '/robots.txt', '/sitemap.xml'}:
        if environ['REQUEST_METHOD'] not in {'GET', 'HEAD'}:
            return respond(environ, start_response, b'Method not allowed', 'text/plain', '405 Method Not Allowed')
        if path in FILES:
            filename, mime = FILES[path]
            return respond(environ, start_response, (ROOT / 'public' / filename).read_bytes(), mime)
        if path in {'/archive', '/archive/'}:
            return respond(environ, start_response, ARCHIVE, 'text/html; charset=utf-8')
        if path == '/healthz':
            return respond(environ, start_response, b'{"status":"ok","site":"inversolabs-homepage"}', 'application/json')
        if path == '/robots.txt':
            return respond(environ, start_response, b'User-agent: *\nAllow: /\nSitemap: https://inversolabs.us/sitemap.xml\n', 'text/plain')
        return respond(environ, start_response, b'<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://inversolabs.us/</loc></url><url><loc>https://inversolabs.us/archive/</loc></url><url><loc>https://inversolabs.us/conductor/</loc></url><url><loc>https://inversolabs.us/newsroom/</loc></url></urlset>', 'application/xml')
    return legacy(environ, start_response)

class Server(ThreadingMixIn, WSGIServer):
    daemon_threads = True

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--port', type=int, default=8099)
    args = parser.parse_args()
    with make_server('127.0.0.1', args.port, app, server_class=Server) as server:
        print(f'Inverso Labs listening on 127.0.0.1:{args.port}', flush=True)
        server.serve_forever()
