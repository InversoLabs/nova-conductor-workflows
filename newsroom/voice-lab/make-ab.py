from pathlib import Path
import os,json,re,subprocess
import numpy as np
import soundfile as sf
import onnxruntime as ort
import kokoro_onnx
lab=Path(os.environ['LOCALAPPDATA'])/'NovaConductor/voice-lab'
runtime=Path(r'C:\Users\justi\Documents\Nova Conductor Studio\runtime\anchor')
edition=lab.parent/'anchor/editions/edition-280bf64dcca75cee1131/render'
meta=json.loads((edition/'voice.json').read_text(encoding='utf-8'))
selected=[meta['segments'][i] for i in [0,1,3]]
text=' '.join(s['text'] for s in selected)
(lab/'script.txt').write_text(text,encoding='utf-8')
def cpu(path):
    opts=ort.SessionOptions();opts.intra_op_num_threads=2;opts.inter_op_num_threads=1
    return ort.InferenceSession(path,sess_options=opts,providers=['CPUExecutionProvider'])
kokoro_onnx.create_session=cpu
engine=kokoro_onnx.Kokoro(str(runtime/'models/kokoro-v1.0.onnx'),str(runtime/'models/voices-v1.0.bin'))
# A is the exact original narration, before animation/export degradation.
original,rate=sf.read(edition/'voice.wav',dtype='float32')
a=np.concatenate([original[round(s['start']*rate):round(s['end']*rate)] for s in selected])
sf.write(lab/'a-raw.wav',a,rate)
# B changes sentence grouping and boundary pauses, not wording or voice.
chunks=[]
for segment in selected:
    sentences=re.split(r'(?<=[.!?])\s+(?=[A-Z])',segment['text'])
    for sentence in sentences:
        samples,rate=engine.create(sentence,voice='af_sarah',speed=1.0,lang='en-us')
        # Retain consonants; only remove near-silent padding at the outside edges.
        active=np.flatnonzero(np.abs(samples)>0.001)
        if len(active): samples=samples[max(0,active[0]-480):min(len(samples),active[-1]+720)]
        chunks.extend([samples,np.zeros(round(rate*0.42),dtype=np.float32)])
    chunks.append(np.zeros(round(rate*0.25),dtype=np.float32))
sf.write(lab/'b-raw.wav',np.concatenate(chunks),rate)
# Matching original compressed audio for a separate export-path diagnostic.
decoded=lab/'old-export.wav'
subprocess.run([str(runtime/'bin/ffmpeg.exe'),'-v','error','-y','-i',str(edition/'website.mp4'),'-vn','-ar','24000','-ac','1',str(decoded)],check=True)
old,_=sf.read(decoded,dtype='float32')
sf.write(lab/'export-old-raw.wav',np.concatenate([old[round(s['start']*rate):round(s['end']*rate)] for s in selected]),rate)
(lab/'source.json').write_text(json.dumps({'edition':str(edition),'segments':selected,'voice':'af_sarah','A':'Original Kokoro ONNX segment synthesis, speed 1.0','B':'Same Kokoro ONNX voice and speed, sentence grouping and explicit pauses','C':'PyKokoro CPU pipeline, same text and voice','exportFix':'Original 24 kHz narration bypasses SadTalker 16 kHz audio and intermediate AAC'},indent=2),encoding='utf-8')
print('A/B and export comparison ready',flush=True)
