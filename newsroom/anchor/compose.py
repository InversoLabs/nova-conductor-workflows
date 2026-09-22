"""Compose separate website and phone layouts from one lip-synced master."""
import argparse
import json
import re
import subprocess
import unicodedata
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

p = argparse.ArgumentParser()
p.add_argument('--ffmpeg', required=True)
p.add_argument('--input', required=True, type=Path)
p.add_argument('--output', required=True, type=Path)
p.add_argument('--headline', default='The stories shaping artificial intelligence')
p.add_argument('--label', default='THE AI BRIEF')
p.add_argument('--headlines-json', type=Path, help='JSON array of approved headline strings')
p.add_argument('--timeline-json', type=Path, help='voice.json with measured segment start/end times')
a = p.parse_args()
a.output.mkdir(parents=True, exist_ok=True)
timeline = json.loads(a.timeline_json.read_text(encoding='utf-8-sig'))['segments'] if a.timeline_json else []
previous = 0
for segment in timeline:
    if not isinstance(segment.get('title'), str) or not segment['title'].strip() or not 0 <= segment['start'] < segment['end'] or segment['start'] < previous:
        raise ValueError('Timeline needs ordered non-overlapping titled segments')
    previous = segment['end']
headlines = json.loads(a.headlines_json.read_text(encoding='utf-8-sig')) if a.headlines_json else ['Artificial intelligence. Clear context.', 'Research, technology and the ideas shaping tomorrow.', 'Read the latest at inversolabs.us/newsroom']
if not isinstance(headlines, list) or not 1 <= len(headlines) <= 20 or any(not isinstance(t, str) or not t.strip() or len(t) > 240 for t in headlines):
    raise ValueError('Provide 1–20 approved headlines, each up to 240 characters')
headlines = [unicodedata.normalize('NFKC', t).replace('\u2010', '-').replace('\u2011', '-') for t in headlines]
font_path = Path('C:/Windows/Fonts/arial.ttf')
bold_path = Path('C:/Windows/Fonts/arialbd.ttf')

def font(size, bold=False):
    return ImageFont.truetype(str(bold_path if bold else font_path), size)

def wrapped(draw, text, f, max_width):
    lines = ['']
    for word in text.split():
        candidate = (lines[-1] + ' ' + word).strip()
        if draw.textlength(candidate, font=f) > max_width and lines[-1]:
            lines.append(word)
        else:
            lines[-1] = candidate
    return lines

outputs = []
for name, w, h in [('website', 1920, 1080), ('instagram', 1080, 1920)]:
    phone = name == 'instagram'
    overlay = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(overlay)
    lime = '#D8FF36'
    # Keep phone graphics inside the central safe area, clear of Reel controls.
    top = 175 if phone else 50
    d.rounded_rectangle((55, top, 280, top+84), radius=5, fill='#0D1B1B')
    d.text((75, top+8), 'IN', font=font(58, True), fill='white')
    d.text((151, top+8), '/', font=font(58, True), fill=lime)
    d.text((195, top+26), 'SIGNAL', font=font(16, True), fill='white')
    d.text((55, top+102), 'MARA VALE', font=font(26, True), fill='white', stroke_width=1, stroke_fill='#0D1B1B')
    d.text((55, top+138), 'IN/SIGNAL', font=font(18, True), fill=lime, stroke_width=1, stroke_fill='#0D1B1B')
    bottom = 1400 if phone else 840
    ticker_y, ticker_h = (1628, 66) if phone else (988, 62)
    label_w = 178 if phone else 200
    # A compact broadcast strap, bright headline panel, and independent ticker.
    d.rectangle((0, bottom, w, h), fill='#0D1B1B')
    d.rectangle((40, bottom-43, 340, bottom), fill=lime)
    d.text((59, bottom-34), a.label, font=font(24, True), fill='#0D1B1B')
    d.rectangle((0, bottom, w, ticker_y-10), fill='#F2F3EB')
    d.rectangle((0, bottom, 12, ticker_y-10), fill=lime)
    headline_font = font(48 if phone else 54, True)
    lines = wrapped(d, a.headline, headline_font, w-(170 if phone else 120))
    if len(lines) > (3 if phone else 2):
        raise ValueError('Headline is too long for the broadcast layout')
    if not timeline:
        for i, line in enumerate(lines):
            d.text((48, bottom+20+i*58), line, font=headline_font, fill='#0D1B1B')
    title_files = []
    for index, segment in enumerate(timeline):
        title_plate = Image.new('RGBA', (w, h), (0, 0, 0, 0))
        title_draw = ImageDraw.Draw(title_plate)
        title = unicodedata.normalize('NFKC', segment['title']).replace('\u2010', '-').replace('\u2011', '-')
        for size in range(48 if phone else 54, 25, -1):
            title_font = font(size, True)
            title_lines = wrapped(title_draw, title, title_font, w-(170 if phone else 120))
            if len(title_lines)*(size+8) <= ticker_y-bottom-38:
                break
        else:
            raise ValueError('Story title will not fit the lower third')
        for line_index, line in enumerate(title_lines):
            title_draw.text((48, bottom+20+line_index*(size+8)), line, font=title_font, fill='#0D1B1B')
        title_file = a.output / f'{name}-title-{index}.png'
        title_plate.save(title_file)
        title_files.append(title_file)
    d.rectangle((0, ticker_y, w, ticker_y+ticker_h), fill='#142525')
    d.rectangle((0, ticker_y, label_w, ticker_y+ticker_h), fill=lime)
    d.text((22, ticker_y+21), 'HEADLINES', font=font(22, True), fill='#0D1B1B')
    d.text((42, 1722 if phone else 1059), 'INVERSOLABS.US / NEWSROOM', font=font(22 if phone else 15, True), fill='#AABBB4')
    # Repeat a complete strip so scrolling wraps seamlessly, including on a short list.
    ticker_font = font(28 if phone else 29, True)
    widths = [int(d.textlength(t, font=ticker_font))+95 for t in headlines]
    period = max(sum(widths), w-label_w)
    ticker_speed = max(105, period/max(timeline[-1]['end']-1, 1)) if timeline else 105
    strip = Image.new('RGB', (period*2, ticker_h), '#142525')
    td = ImageDraw.Draw(strip)
    for cycle in range(2):
        x = cycle*period+28
        for title, width in zip(headlines, widths):
            td.text((x, 17), title, font=ticker_font, fill='#F2F3EB')
            td.rectangle((x+width-58, 25, x+width-52, 39), fill=lime)
            x += width
    ticker = a.output / (name+'-ticker.png')
    strip.save(ticker)
    plate = a.output / (name+'-overlay.png')
    overlay.save(plate)
    out = a.output / (name+'.mp4')
    # Preserve the centered anchor. The phone master is reframed, not letterboxed.
    title_graph, panel = '', 'panel'
    for index, segment in enumerate(timeline):
        fade = min(0.2, (segment['end']-segment['start'])/4)
        title_graph += (f'[{index+3}:v]format=rgba,fade=t=in:st={segment["start"]}:d={fade}:alpha=1,'
                        f'fade=t=out:st={segment["end"]-fade}:d={fade}:alpha=1[title{index}];'
                        f'[{panel}][title{index}]overlay=0:0:shortest=1[p{index}];')
        panel = f'p{index}'
    graph = (f'[0:v]scale={w}:{h}:force_original_aspect_ratio=increase,'
             f'crop={w}:{h},setsar=1[base];[base][1:v]overlay=0:0:format=auto[panel];'+title_graph+
             f'[2:v]crop={w-label_w}:{ticker_h}:x=mod(t*{ticker_speed:.3f}\\,{period}):y=0[scroll];'
             f'[{panel}][scroll]overlay={label_w}:{ticker_y}:shortest=1,format=yuv420p[v]')
    title_inputs = [arg for title_file in title_files for arg in ['-loop', '1', '-framerate', '25', '-i', str(title_file)]]
    subprocess.run([a.ffmpeg, '-y', '-i', str(a.input), '-i', str(plate),
                    '-loop', '1', '-framerate', '25', '-i', str(ticker),
                    *title_inputs,
                    '-filter_complex', graph, '-map', '[v]', '-map', '0:a:0',
                    '-c:v', 'libx264', '-preset', 'fast', '-crf', '20', '-r', '25',
                    '-c:a', 'aac', '-b:a', '128k', '-ar', '48000',
                    '-movflags', '+faststart', str(out)], check=True)
    # Decode all frames/audio to catch truncated or invalid exports.
    subprocess.run([a.ffmpeg, '-v', 'error', '-xerror', '-i', str(out), '-f', 'null', '-'], check=True)
    info = subprocess.run([a.ffmpeg, '-hide_banner', '-i', str(out)], capture_output=True, text=True).stderr
    match = re.search(r'Duration: (\d+):(\d+):(\d+\.\d+)', info)
    duration = int(match[1])*3600+int(match[2])*60+float(match[3]) if match else 0
    if not duration or 'Video: h264' not in info or 'Audio: aac' not in info or f'{w}x{h}' not in info:
        raise ValueError('Export format verification failed')
    if timeline and abs(duration-timeline[-1]['end']) > 0.5:
        raise ValueError('Export duration does not match narration')
    outputs.append({'file': str(out), 'width': w, 'height': h, 'bytes': out.stat().st_size, 'duration': duration, 'decoded': True})
(a.output/'exports.json').write_text(json.dumps(outputs, indent=2), encoding='utf-8')
print(json.dumps(outputs))
