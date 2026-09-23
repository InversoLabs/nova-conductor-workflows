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
    lime = '#42DFD1'
    # Keep phone graphics inside the central safe area, clear of Reel controls.
    top = 175 if phone else 50
    d.rounded_rectangle((55, top, 280, top+84), radius=5, fill='#181020')
    d.text((75, top+8), 'AN', font=font(48, True), fill='white')
    # Original TAN wordmark
    # No second wordmark line
    # Presenter identity is attached to each timed shot below.
    bottom = 1400 if phone else 840
    ticker_y, ticker_h = (1628, 66) if phone else (988, 62)
    label_w = 178 if phone else 200
    # A compact broadcast strap, bright headline panel, and independent ticker.
    d.rectangle((0, bottom, w, h), fill='#181020')
    d.rectangle((40, bottom-43, 340, bottom), fill=lime)
    d.text((59, bottom-34), a.label, font=font(24, True), fill='#181020')
    d.rectangle((0, bottom, w, ticker_y-10), fill='#F0EBFA')
    d.rectangle((0, bottom, 12, ticker_y-10), fill=lime)
    headline_font = font(62 if phone else 70, True)
    lines = wrapped(d, a.headline, headline_font, w-(170 if phone else 120))
    if len(lines) > (3 if phone else 2):
        raise ValueError('Headline is too long for the broadcast layout')
    if not timeline:
        for i, line in enumerate(lines):
            d.text((48, bottom+20+i*58), line, font=headline_font, fill='#181020')
    title_files = []
    for index, segment in enumerate(timeline):
        title_plate = Image.new('RGBA', (w, h), (0, 0, 0, 0))
        title_draw = ImageDraw.Draw(title_plate)
        title_draw.text((55, top+102), segment.get('presenter', 'Vera Volt').upper(), font=font(26, True), fill='white', stroke_width=1, stroke_fill='#181020')
        pip = segment.get('pip')
        if pip:
            px, py, pw, ph = (70, 1030, 410, 310) if phone else (1390, 170, 470, 350)
            inset = Image.new('RGB', (pw, ph), '#24172d')
            if pip == 'captcha':
                card=ImageDraw.Draw(inset)
                stage=segment.get('captchaStage','bicycle')
                card.rectangle((0,0,pw,60),fill='#285e89')
                label={'bicycle':'SELECT ALL BICYCLES','traffic':'SELECT TRAFFIC LIGHTS','pending':'HUMAN? PROCESSING...','verified':'VERIFIED HUMAN'}[stage]
                card.text((15,18),label,font=font(22,True),fill='white')
                if stage=='verified':
                    card.line([(pw//2-75,145),(pw//2-20,195),(pw//2+85,95)],fill='#42DFD1',width=13)
                else:
                    for cell in range(9):
                        xx=20+(cell%3)*(pw-40)//3;yy=72+(cell//3)*58
                        card.rectangle((xx,yy,xx+(pw-46)//3,yy+53),fill='#435567',outline='#b8c0cb',width=1)
                        if stage=='bicycle':
                            card.ellipse((xx+12,yy+24,xx+37,yy+48),outline='#42DFD1',width=3)
                            card.ellipse((xx+66,yy+24,xx+91,yy+48),outline='#42DFD1',width=3)
                            card.line([(xx+25,yy+36),(xx+49,yy+10),(xx+79,yy+36),(xx+25,yy+36),(xx+40,yy+13)],fill='white',width=2)
                        else:
                            card.rectangle((xx+39,yy+3,xx+63,yy+49),fill='#111820')
                            for k,c in enumerate(['#f35d69','#ffd55c','#42dfb1']):card.ellipse((xx+46,yy+7+k*13,xx+56,yy+17+k*13),fill=c)
                title_plate.paste(inset,(px,py))
            elif pip in ('moon', 'dishwasher'):
                from PIL import ImageOps
                source = Image.open(Path(__file__).parent/'assets'/('pip-'+pip+'.png')).convert('RGB')
                inset = ImageOps.fit(source, (pw, ph-44))
                title_plate.paste(inset, (px, py))
            else:
                chart = ImageDraw.Draw(inset)
                for y in range(40, ph-40, 45): chart.line((20,y,pw-20,y),fill='#483250',width=1)
                chart.line([(25,ph-70),(110,ph-110),(180,ph-95),(260,110),(350,65),(pw-25,20)],fill='#55f0ba',width=7)
                chart.text((25,20), '+400% VIBES',font=font(25,True),fill='#55f0ba')
                title_plate.paste(inset,(px,py))
            title_draw.rectangle((px,py,px+pw,py+ph),outline='#b57bdd',width=3)
            title_draw.rectangle((px,py+ph-44,px+pw,py+ph),fill='#24172d')
            title_draw.text((px+15,py+ph-34), {'chart':'DOWNSIDE REMOVED','moon':'AD SPACE','dishwasher':'LOADING DISPUTE','captcha':'HUMAN VERIFICATION'}[pip],font=font(22,True),fill='white')
        title = unicodedata.normalize('NFKC', segment['title']).replace('\u2010', '-').replace('\u2011', '-')
        for size in range(62 if phone else 70, 25, -1):
            title_font = font(size, True)
            title_lines = wrapped(title_draw, title, title_font, w-(170 if phone else 120))
            if len(title_lines)*(size+8) <= ticker_y-bottom-38:
                break
        else:
            raise ValueError('Story title will not fit the lower third')
        for line_index, line in enumerate(title_lines):
            title_draw.text((48, bottom+20+line_index*(size+8)), line, font=title_font, fill='#181020')
        title_file = a.output / f'{name}-title-{index}.png'
        title_plate.save(title_file)
        title_files.append(title_file)
    d.rectangle((0, ticker_y, w, ticker_y+ticker_h), fill='#281B3D')
    d.rectangle((0, ticker_y, label_w, ticker_y+ticker_h), fill=lime)
    d.text((22, ticker_y+21), 'HEADLINES', font=font(22, True), fill='#181020')
    d.text((42, 1722 if phone else 1059), 'INVERSOLABS.US / FAKENEWS', font=font(22 if phone else 15, True), fill='#AABBB4')
    # Repeat a complete strip so scrolling wraps seamlessly, including on a short list.
    ticker_font = font(34, True)
    widths = [int(d.textlength(t, font=ticker_font))+95 for t in headlines]
    period = max(sum(widths), w-label_w)
    ticker_speed = max(105, period/max(timeline[-1]['end']-1, 1)) if timeline else 105
    strip = Image.new('RGB', (period*2, ticker_h), '#281B3D')
    td = ImageDraw.Draw(strip)
    for cycle in range(2):
        x = cycle*period+28
        for title, width in zip(headlines, widths):
            td.text((x, 17), title, font=ticker_font, fill='#F0EBFA')
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
    if phone:
        base_graph = f'[0:v]scale=-2:1240,crop={w}:1240,pad={w}:{h}:0:120:color=0x17101e,setsar=1[base];'
    else:
        full_ranges = '+'.join("gte(n,%s)*lt(n,%s)" % (seg.get('frameStart', round(seg['start']*25)),seg.get('frameEnd', round(seg['end']*25))) for seg in timeline if seg.get('shot')=='full') or '0'
        base_graph = (f'[0:v]split=2[normal][wide];[normal]scale={w}:{h},setsar=1[normalbase];'
                      f'[wide]scale=-2:780,pad={w}:{h}:(ow-iw)/2:30:color=0x17101e,setsar=1[widebase];'
                      f"[normalbase][widebase]overlay=0:0:enable='{full_ranges}'[base];")
    graph = (base_graph+'[base][1:v]overlay=0:0:format=auto[panel];'+title_graph+
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
subprocess.run([__import__('sys').executable, str(Path(__file__).with_name('intro.py')), '--ffmpeg', a.ffmpeg, '--output', str(a.output)], check=True)
for item in outputs:
    info = subprocess.run([a.ffmpeg, '-hide_banner', '-i', item['file']], capture_output=True, text=True).stderr
    match = re.search(r'Duration: (\d+):(\d+):(\d+\.\d+)', info)
    final_duration = int(match[1])*3600+int(match[2])*60+float(match[3]) if match else 0
    production=json.loads((a.output/'bulletin.json').read_text(encoding='utf-8-sig'))
    expected=float(production['targetDuration']) if production.get('endCard') else item['duration']+3
    if abs(final_duration-expected) > 0.5:
        raise ValueError('Intro export duration does not match the complete bulletin')
    item['duration'] = final_duration
    item['bytes'] = Path(item['file']).stat().st_size
(a.output/'exports.json').write_text(json.dumps(outputs, indent=2), encoding='utf-8')
print(json.dumps(outputs))
