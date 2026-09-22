"""Atomic newsroom story install. Invoked over authenticated SSH, never HTTP."""
import json, os, re, sys, hashlib, time, subprocess
from render_articles import render
from pathlib import Path
from datetime import datetime, timezone
from xml.sax.saxutils import escape
ROOT = Path(__file__).resolve().parent

def prepare_social(story):
    sid=story['id'];drafts=ROOT/'social-drafts';drafts.mkdir(exist_ok=True)
    source=drafts/(sid+'-source.json');source.write_text(json.dumps(story,ensure_ascii=False),encoding='utf-8')
    card=ROOT/'public'/'images'/('social-'+sid+'.jpg')
    subprocess.run(['powershell.exe','-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',str(ROOT/'card.ps1'),'-InputFile',str(source),'-OutputFile',str(card)],check=True,timeout=30)
    (drafts/(sid+'.json')).write_text(json.dumps({'id':sid,'status':'awaiting_account','caption':'SATIRE — The Artificial News. Fictional comedy inspired by real reporting.\n\n'+story['summary']+'\n\nhttps://inversolabs.us/fakenews/story/'+sid+'/','image':str(card),'source':story['sources']},ensure_ascii=False,indent=2),encoding='utf-8')

def publish(incoming):
    incoming = Path(incoming).resolve()
    if incoming.parent != ROOT.resolve() or not incoming.name.startswith('incoming-'):
        raise ValueError('Invalid incoming directory')
    story = json.loads((incoming / 'story.json').read_text(encoding='utf-8-sig'))
    sid = story['id']
    if not re.fullmatch('[a-f0-9]{20}', sid): raise ValueError('Invalid story ID')
    if not story.get('sources') or any(not x['url'].startswith('https://') for x in story['sources']): raise ValueError('Missing HTTPS sources')
    if len(story.get('paragraphs', [])) < 2: raise ValueError('Incomplete story')
    image = (incoming / 'image.svg').read_text(encoding='utf-8')
    if '<script' in image.lower() or 'href=' in image.lower(): raise ValueError('Unsafe illustration')
    lock = ROOT / 'publish.lock'
    fd = os.open(lock, os.O_CREAT | os.O_EXCL | os.O_WRONLY)
    try:
        public = ROOT / 'public'
        public.mkdir(exist_ok=True); (public / 'images').mkdir(exist_ok=True)
        dest = public / 'stories.json'
        edition = json.loads(dest.read_text(encoding='utf-8')) if dest.exists() else {'stories': []}
        existing=next((s for s in edition['stories'] if s['id']==sid),None)
        if existing and not story.pop('replaceExisting',False):
            render(public); prepare_social(existing); print('Already published: ' + sid); return
        if existing:
            story['priority']=existing.get('priority',0);story['publishedAt']=existing['publishedAt'];story['updatedAt']=datetime.now(timezone.utc).isoformat()
            edition['stories']=[s for s in edition['stories'] if s['id']!=sid]
        backup = ROOT / 'backups'; backup.mkdir(exist_ok=True)
        if dest.exists(): (backup / ('edition-' + str(time.time_ns()) + '.json')).write_bytes(dest.read_bytes())
        (public / 'images' / (sid + '.svg')).write_text(image, encoding='utf-8')
        if not edition.get('headlinePinned',False):
            for current in edition['stories']: current['priority']=0
            story['priority']=100
        edition['stories'].insert(0, story)
        edition['updatedAt'] = datetime.now(timezone.utc).isoformat()
        tmp = public / 'stories.next.json'; tmp.write_text(json.dumps(edition, ensure_ascii=False, indent=2), encoding='utf-8'); os.replace(tmp, dest)
        items = ''.join('<item><title>'+escape(s['title'])+'</title><link>https://inversolabs.us/fakenews/story/'+s['id']+'</link><guid>'+s['id']+'</guid><description>'+escape(s['summary'])+'</description></item>' for s in edition['stories'][:50])
        (public / 'feed.xml').write_text('<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>THE ARTIFICIAL NEWS</title><link>https://inversolabs.us/fakenews/</link><description>World-news satire</description>'+items+'</channel></rss>', encoding='utf-8')
        render(public)
        prepare_social(story)
        print('Published '+sid)
    finally:
        os.close(fd); lock.unlink()

def headline(sid):
    if sid!='auto' and not re.fullmatch('[a-f0-9]{20}', sid): raise ValueError('Invalid story ID')
    lock=ROOT / 'publish.lock'; fd=os.open(lock, os.O_CREAT | os.O_EXCL | os.O_WRONLY)
    try:
        dest=ROOT / 'public' / 'stories.json'; edition=json.loads(dest.read_text(encoding='utf-8'))
        edition['headlinePinned']=sid!='auto'
        if sid=='auto': sid=max(edition['stories'],key=lambda s:s['publishedAt'])['id']
        if not any(s['id']==sid for s in edition['stories']): raise ValueError('Story not found')
        for s in edition['stories']: s['priority']=100 if s['id']==sid else 0
        edition['updatedAt']=datetime.now(timezone.utc).isoformat()
        tmp=dest.with_suffix('.next.json'); tmp.write_text(json.dumps(edition,ensure_ascii=False,indent=2),encoding='utf-8');os.replace(tmp,dest)
        print('Headline updated')
    finally:
        os.close(fd);lock.unlink()

if __name__ == '__main__':
    if sys.argv[1]=='--headline': headline(sys.argv[2])
    else: publish(sys.argv[1])
