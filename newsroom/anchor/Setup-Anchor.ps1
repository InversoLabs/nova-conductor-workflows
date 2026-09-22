param([string]$Root='C:\Users\justi\Documents\Nova Conductor Studio\runtime\anchor')
$ErrorActionPreference='Stop';$ProgressPreference='SilentlyContinue'
$env:PYTHONUNBUFFERED='1'
$env:PIP_USE_DEPRECATED='legacy-certs'
$env:PIP_DEFAULT_TIMEOUT='30'
$env:PIP_PROGRESS_BAR='off'
New-Item -ItemType Directory -Path $Root -Force | Out-Null
Start-Transcript -Path (Join-Path $Root 'setup.log') -Append | Out-Null
Set-Content -LiteralPath "$Root\setup-status.txt" -Value 'INSTALLING'
function Run([string]$Exe,[string[]]$ArgsList){ Write-Output ("Running: "+$Exe+" "+($ArgsList -join ' ')); $prior=$ErrorActionPreference; $ErrorActionPreference='Continue'; try { & $Exe @ArgsList >> (Join-Path $Root 'commands.log') 2>&1; $code=$LASTEXITCODE } finally {$ErrorActionPreference=$prior}; if($code -ne 0){throw "$Exe failed ($code); see commands.log"} }
function Download([string]$Url,[string]$Dest){if(!(Test-Path -LiteralPath $Dest)){Run 'C:\Windows\System32\curl.exe' @('-fL','--retry','3','--connect-timeout','20','-o',($Dest+'.part'),$Url);Move-Item -LiteralPath ($Dest+'.part') -Destination $Dest};Get-FileHash -LiteralPath $Dest -Algorithm SHA256 | Select-Object Path,Hash | ConvertTo-Json -Compress | Add-Content (Join-Path $Root 'downloads.jsonl')}
try {
$py310='C:\Users\justi\AppData\Local\Programs\Python\Python310\python.exe'
$py312='C:\Users\justi\AppData\Local\Programs\Python\Python312\python.exe'
if(!(Test-Path "$Root\face\Scripts\python.exe")){Run $py310 @('-m','venv',"$Root\face")}
if(!(Test-Path "$Root\voice\Scripts\python.exe")){Run $py312 @('-m','venv',"$Root\voice")}
$face="$Root\face\Scripts\python.exe";$voice="$Root\voice\Scripts\python.exe"
Run $face @('-m','pip','install','--upgrade','pip','wheel','setuptools<70')
$torchWheel=Join-Path $Root 'torch-2.1.2+cu118-cp310-cp310-win_amd64.whl'
$torchTarget=if(Test-Path $torchWheel){$torchWheel}else{'torch==2.1.2'}
Run $face @('-m','pip','install',$torchTarget,'torchvision==0.16.2','torchaudio==2.1.2','--index-url','https://download.pytorch.org/whl/cu118')
Run $face @('-m','pip','install','numpy==1.23.5','numba==0.57.1','opencv-python==4.8.1.78','face_alignment==1.3.5','imageio==2.19.3','imageio-ffmpeg==0.4.9','librosa==0.9.2','resampy==0.3.1','pydub==0.25.1','scipy==1.10.1','kornia==0.6.8','tqdm','yacs==0.1.8','pyyaml','joblib==1.1.0','scikit-image==0.19.3','basicsr==1.4.2','facexlib==0.3.0','gfpgan==1.3.8','av','safetensors')
# SadTalker's cropper uses Image.ANTIALIAS, removed in Pillow 10.
Run $face @('-m','pip','install','pillow==9.5.0')
Run $voice @('-m','pip','install','kokoro-onnx','soundfile')
if(!(Test-Path "$Root\SadTalker\.git")){Run 'C:\Program Files\Git\cmd\git.exe' @('clone','--depth','1','https://github.com/OpenTalker/SadTalker.git',"$Root\SadTalker")}
Run 'C:\Program Files\Git\cmd\git.exe' @('-C',"$Root\SadTalker",'rev-parse','HEAD')
New-Item -ItemType Directory -Path "$Root\SadTalker\checkpoints","$Root\models","$Root\bin" -Force|Out-Null
foreach($name in @('mapping_00109-model.pth.tar','mapping_00229-model.pth.tar','SadTalker_V0.0.2_256.safetensors')){Download "https://github.com/OpenTalker/SadTalker/releases/download/v0.0.2-rc/$name" "$Root\SadTalker\checkpoints\$name"}
New-Item -ItemType Directory -Path "$Root\SadTalker\gfpgan\weights" -Force | Out-Null
foreach($name in @('alignment_WFLW_4HG.pth','detection_Resnet50_Final.pth')){Download "https://github.com/xinntao/facexlib/releases/download/v0.1.0/$name" "$Root\SadTalker\gfpgan\weights\$name"}
Download 'https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.1/kokoro-v1.0.onnx' "$Root\models\kokoro-v1.0.onnx"
Download 'https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.1/voices-v1.0.bin' "$Root\models\voices-v1.0.bin"
$ffmpeg=& $face -c 'import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())'
Copy-Item -LiteralPath $ffmpeg.Trim() -Destination "$Root\bin\ffmpeg.exe" -Force
Run $face @('-c','import torch; print(torch.__version__); print(torch.cuda.is_available()); import face_alignment, gfpgan')
Run $voice @('-c','from kokoro_onnx import Kokoro; print(Kokoro)')
Set-Content -LiteralPath "$Root\setup-status.txt" -Value 'READY'
}catch{Set-Content -LiteralPath "$Root\setup-status.txt" -Value ('FAILED: '+$_.Exception.Message);throw}finally{Stop-Transcript|Out-Null}
