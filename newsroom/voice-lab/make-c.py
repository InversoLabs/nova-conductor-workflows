import faulthandler
faulthandler.enable()
faulthandler.dump_traceback_later(45,repeat=True)
from pathlib import Path
import os,json
import onnxruntime as ort
from pykokoro import KokoroPipeline,PipelineConfig,GenerationConfig
lab=Path(os.environ['LOCALAPPDATA'])/'NovaConductor/voice-lab'
runtime=Path(r'C:\Users\justi\Documents\Nova Conductor Studio\runtime\anchor')
opts=ort.SessionOptions();opts.intra_op_num_threads=2;opts.inter_op_num_threads=1
config=PipelineConfig(model_variant='v1.0',model_config_path=runtime/'voice/Lib/site-packages/kokoro_onnx/config.json',voice='af_sarah',provider='cpu',
 model_path=runtime/'models/kokoro-v1.0.onnx',voices_path=runtime/'models/voices-v1.0.bin',
 generation=GenerationConfig(lang='en-us',speed=1.0,pause_mode='auto',random_seed=42))
os.environ['ESPEAKNG_RUNTIME_LIBRARY']=str(runtime/'voice/Lib/site-packages/espeakng_loader/espeak-ng.dll')
os.environ['ESPEAKNG_RUNTIME_DATA']=str(runtime/'voice/Lib/site-packages/espeakng_loader/espeak-ng-data')
pipe=KokoroPipeline(config)
result=pipe.run((lab/'script.txt').read_text(encoding='utf-8'))
result.save_wav(str(lab/'c-raw.wav'))
print('C READY',flush=True)




