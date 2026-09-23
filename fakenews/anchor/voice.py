"""Generate local narration; never sends unpublished copy to an external service."""
import argparse
import json
import numpy as np
from pathlib import Path
import soundfile as sf
from kokoro_onnx import Kokoro

p = argparse.ArgumentParser()
p.add_argument('--runtime', required=True, type=Path)
p.add_argument('--script', required=True, type=Path)
p.add_argument('--output', required=True, type=Path)
p.add_argument('--voice', default='af_sarah')
p.add_argument('--reuse', type=Path, help='Preserve existing non-Iris audio exactly')
a = p.parse_args()
raw = a.script.read_text(encoding='utf-8-sig').strip()
production = json.loads(raw) if a.script.suffix == '.json' else {}
segments = production.get('segments', [{'title': '', 'text': raw}])
text = ' '.join(s['text'] for s in segments)
if not text or len(text) > 6000 or not 1 <= len(segments) <= 32:
    raise ValueError('Narration must contain 1–6000 characters')
a.output.parent.mkdir(parents=True, exist_ok=True)
engine = Kokoro(str(a.runtime / 'models/kokoro-v1.0.onnx'), str(a.runtime / 'models/voices-v1.0.bin'))
chunks, timeline, cursor = [], [], 0
speaker_chunks, speaker_cursors = {}, {}
voices = {"vera": "af_sarah", "vera_left": "af_sarah", "vera_right": "af_sarah", "miles": "am_adam", "iris": "af_nicole"}
old = json.loads((a.reuse/'voice.json').read_text(encoding='utf-8')) if a.reuse else None
old_audio, old_rate = sf.read(a.reuse/'voice.wav', dtype='float32') if old else (None, None)
if old and len(old['segments']) != len(segments): raise ValueError('Reuse requires the same script')
for index, segment in enumerate(segments):
    speaker = segment.get('speaker', 'vera')
    if old and (old['segments'][index]['text'] != segment['text'] or old['segments'][index]['speaker'] != speaker): raise ValueError('Reuse script changed')
    if old and speaker != 'iris':
        previous = old['segments'][index]; rate = old_rate
        chunk = old_audio[round(previous['start']*rate):round(previous['end']*rate)]
    else:
        delivery = segment.get('delivery', [{'text':segment['text'], 'pauseAfter':0.25}])
        parts=[]
        for phrase in delivery:
            speed=float(production.get('deliverySpeed',1.0))
            if not 0.85 <= speed <= 1.1: raise ValueError('Delivery speed outside natural range')
            samples, rate = engine.create(phrase['text'], voice=voices[speaker], speed=speed, lang='en-us')
            pause=float(phrase.get('pauseAfter',0.25))
            if not 0 <= pause <= 2: raise ValueError('Invalid delivery pause')
            parts.extend([samples,np.zeros(round(rate*pause),dtype=np.float32)])
        chunk=np.concatenate(parts)
    offset = speaker_cursors.get(speaker, 0)
    timeline.append({**segment, 'start': cursor/rate, 'end': (cursor+len(chunk))/rate, 'speakerStart': offset/rate, 'speakerEnd': (offset+len(chunk))/rate})
    speaker_chunks.setdefault(speaker, []).append(chunk)
    speaker_cursors[speaker] = offset + len(chunk)
    chunks.append(chunk)
    cursor += len(chunk)
samples = np.concatenate(chunks)
sf.write(str(a.output), samples, rate, subtype='PCM_16')
for speaker, parts in speaker_chunks.items():
    sf.write(str(a.output.parent / (speaker+'.wav')), np.concatenate(parts), rate, subtype='PCM_16')
metadata = {'voice': a.voice, 'voices': voices, 'sampleRate': rate, 'duration': len(samples) / rate, 'text': text, 'segments': timeline}
a.output.with_suffix('.json').write_text(json.dumps(metadata, indent=2), encoding='utf-8')
print(json.dumps({k: v for k, v in metadata.items() if k != 'text'}))
