from pathlib import Path
import os,json,subprocess,re,shutil
import soundfile as sf
import numpy as np
lab=Path(os.environ['LOCALAPPDATA'])/'NovaConductor/voice-lab'
ff=str(Path(r'C:\Users\justi\Documents\Nova Conductor Studio\runtime\anchor\bin\ffmpeg.exe'))
public=lab/'public';public.mkdir(exist_ok=True)
report={}
for name,source in [('a','a-raw.wav'),('b','b-raw.wav'),('c','c-raw.wav'),('export-old','export-old-raw.wav')]:
    raw=lab/source
    audio,rate=sf.read(raw)
    assert np.isfinite(audio).all() and len(audio)/rate>30
    base='loudnorm=I=-18:TP=-2:LRA=11'
    result=subprocess.run([ff,'-hide_banner','-i',str(raw),'-af',base+':print_format=json','-f','null','-'],capture_output=True,text=True,check=True)
    measured=json.loads(re.findall(r'\{[^{}]+\}',result.stderr)[-1])
    filt=base+':linear=true:'+':'.join(f'{a}={measured[b]}' for a,b in [('measured_I','input_i'),('measured_TP','input_tp'),('measured_LRA','input_lra'),('measured_thresh','input_thresh'),('offset','target_offset')])
    target=public/(name+'.wav')
    subprocess.run([ff,'-v','error','-y','-i',str(raw),'-af',filt,'-ar','24000','-c:a','pcm_s16le',str(target)],check=True)
    subprocess.run([ff,'-v','error','-y','-i',str(target),'-c:a','aac','-b:a','192k','-ar','48000','-movflags','+faststart',str(public/(name+'.mp4'))],check=True)
    # lossless browser WAV samples prevent codec differences confounding the voice test.
    report[name]={'seconds':round(len(audio)/rate,2),'inputSampleRate':rate,'inputPeak':float(np.max(np.abs(audio))),'inputLoudness':measured['input_i']}
(lab/'validation.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
shutil.copyfile(lab/'index.html',public/'index.html')
shutil.copyfile(lab/'app.js',public/'app.js')
(public/'script.json').write_text(json.dumps({'text':(lab/'script.txt').read_text(encoding='utf-8')}),encoding='utf-8')
print(json.dumps(report),flush=True)
