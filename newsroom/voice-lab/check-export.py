from pathlib import Path
import os,subprocess,json
import soundfile as sf
import numpy as np
lab=Path(os.environ['LOCALAPPDATA'])/'NovaConductor/voice-lab'
ff=r'C:\Users\justi\Documents\Nova Conductor Studio\runtime\anchor\bin\ffmpeg.exe'
results=[]
for name in ['website','instagram']:
    decoded=lab/(name+'-test.wav')
    subprocess.run([ff,'-v','error','-y','-i',str(lab/'compose-test'/(name+'.mp4')),'-vn','-ar','24000','-ac','1',str(decoded)],check=True)
    audio,rate=sf.read(decoded);spectrum=np.abs(np.fft.rfft(audio));freq=np.fft.rfftfreq(len(audio),1/rate)
    peak=freq[np.argmax(spectrum)]
    assert abs(peak-9000)<30,peak
    results.append({'layout':name,'dominantHz':round(float(peak),2),'originalWavSelected':True})
(lab/'export-check.json').write_text(json.dumps(results,indent=2))
print(json.dumps(results))
