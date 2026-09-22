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
a = p.parse_args()
raw = a.script.read_text(encoding='utf-8-sig').strip()
segments = json.loads(raw)['segments'] if a.script.suffix == '.json' else [{'title': '', 'text': raw}]
text = ' '.join(s['text'] for s in segments)
if not text or len(text) > 6000 or not 1 <= len(segments) <= 12:
    raise ValueError('Narration must contain 1–6000 characters')
a.output.parent.mkdir(parents=True, exist_ok=True)
engine = Kokoro(str(a.runtime / 'models/kokoro-v1.0.onnx'), str(a.runtime / 'models/voices-v1.0.bin'))
chunks, timeline, cursor = [], [], 0
for segment in segments:
    samples, rate = engine.create(segment['text'], voice=a.voice, speed=1.0, lang='en-us')
    pause = np.zeros(int(rate*0.25), dtype=np.float32)
    chunk = np.concatenate([samples, pause])
    timeline.append({**segment, 'start': cursor/rate, 'end': (cursor+len(chunk))/rate})
    chunks.append(chunk)
    cursor += len(chunk)
samples = np.concatenate(chunks)
sf.write(str(a.output), samples, rate, subtype='PCM_16')
metadata = {'voice': a.voice, 'sampleRate': rate, 'duration': len(samples) / rate, 'text': text, 'segments': timeline}
a.output.with_suffix('.json').write_text(json.dumps(metadata, indent=2), encoding='utf-8')
print(json.dumps({k: v for k, v in metadata.items() if k != 'text'}))
