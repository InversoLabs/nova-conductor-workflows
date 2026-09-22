$ErrorActionPreference='Stop'
$ProgressPreference='SilentlyContinue'
$env:PATH=(Join-Path $PSScriptRoot 'runtime\powershell')+';'+(Join-Path $PSScriptRoot 'runtime\node_modules\.bin')+';C:\Program Files\nodejs;'+$env:PATH
$env:NOVA_CONDUCTOR_HEADLESS='1'
if(-not $env:NOVA_UI_PORT){$env:NOVA_UI_PORT='18183'}
$logs=Join-Path $env:LOCALAPPDATA 'NovaConductor\server'
New-Item -ItemType Directory -Force -Path $logs | Out-Null
Set-Location $PSScriptRoot
$node=(Get-Command node).Source
while($true){
  & $node (Join-Path $PSScriptRoot 'ui\server.mjs') 1>> (Join-Path $logs 'service.log') 2>> (Join-Path $logs 'service-error.log')
  Start-Sleep -Seconds 10
}
