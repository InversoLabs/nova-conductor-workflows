$ErrorActionPreference='Stop'
$port=18181
if($env:NOVA_UI_PORT){$port=[int]$env:NOVA_UI_PORT}
try { $health=Invoke-RestMethod "http://127.0.0.1:$port/health" -TimeoutSec 2; if($health.app -eq 'nova-conductor-ui'){exit 0} } catch {}
$logs=Join-Path $env:LOCALAPPDATA 'NovaConductor\ui'
New-Item -ItemType Directory -Path $logs -Force | Out-Null
$server=Join-Path $PSScriptRoot 'ui\server.mjs'
Start-Process (Get-Command node).Source -ArgumentList ('"'+$server+'"') -WorkingDirectory $PSScriptRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $logs 'server.log') -RedirectStandardError (Join-Path $logs 'server-error.log')
