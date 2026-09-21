"""Create indexable, shareable HTML for every published story (no dependencies)."""
import json
from pathlib import Path
from html import escape
ROOT = Path(__file__).resolve().parent

def render(public):
    public=Path(public); edition=json.loads((public/'stories.json').read_text(encoding='utf-8'))
    for s in edition['stories']:
        folder=public/'story'/s['id'];folder.mkdir(parents=True,exist_ok=True)
        url='https://inversolabs.us/newsroom/story/'+s['id']+'/'
        sources=''.join('<li><a href="'+escape(x['url'],quote=True)+'" rel="noopener noreferrer">'+escape(x['name'])+' ↗</a></li>' for x in s['sources'])
        correction='<p class="disclosure">Correction: '+escape(s['correctionNote'])+'</p>' if s.get('correctionNote') else ''
        paragraphs=''.join('<p>'+escape(p)+'</p>' for p in s['paragraphs'])
        body=f'''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{escape(s['title'])} — IN / SIGNAL</title><meta name="description" content="{escape(s['summary'],quote=True)}"><link rel="canonical" href="{url}"><meta property="og:title" content="{escape(s['title'],quote=True)}"><meta property="og:description" content="{escape(s['summary'],quote=True)}"><meta property="og:type" content="article"><link rel="stylesheet" href="/newsroom/style.css?v=1"></head><body><div class="utility"><a href="/newsroom/">← BACK TO THE NEWSROOM</a><span>INVERSO LABS / IN SIGNAL</span></div><main style="max-width:900px;margin:auto"><article><div class="article-head"><span class="eyebrow">{escape(s['category'])} / BRIEFING</span><h1>{escape(s['title'])}</h1><p>{escape(s['summary'])}</p><div class="meta">IN / SIGNAL DESK · {escape(s['publishedAt'][:10])} · AI-ASSISTED REPORTING</div></div><img class="article-image" src="/newsroom/images/{s['id']}.svg?v={escape(s.get('updatedAt',s['publishedAt']),quote=True)}" alt="{escape(s.get('imageAlt','Editorial illustration'),quote=True)}"><div class="caption">Original procedural editorial illustration / Inverso Labs</div><div class="article-copy">{paragraphs}{correction}<h2>Go to the source</h2><ul class="sources">{sources}</ul><p class="disclosure">{escape(s.get('disclosure','AI-assisted reporting, based on linked primary sources.'))}</p><a href="/newsroom/">← More from IN / SIGNAL</a></div></article></main></body></html>'''
        temp=folder/'index.next.html';temp.write_text(body,encoding='utf-8');temp.replace(folder/'index.html')
    urls=['https://inversolabs.us/newsroom/']+['https://inversolabs.us/newsroom/story/'+s['id']+'/' for s in edition['stories']]
    (public/'sitemap.xml').write_text('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+''.join('<url><loc>'+escape(u)+'</loc></url>' for u in urls)+'</urlset>',encoding='utf-8')

if __name__=='__main__': render(ROOT/'public')
