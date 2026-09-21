param([switch]$CheckOnly)
$ErrorActionPreference='Stop'
foreach($name in @('node','git','codex')){if(-not(Get-Command $name -ErrorAction SilentlyContinue)){throw "$name is required on PATH. See README.md."}}
if($CheckOnly){Write-Host 'Nova Conductor UI launcher ready.';exit 0}
$port=18181
if($env:NOVA_UI_PORT){$port=[int]$env:NOVA_UI_PORT}
$url="http://127.0.0.1:$port"
$ready=$false
try {$health=Invoke-RestMethod "$url/health" -TimeoutSec 2;if($health.app -ne 'nova-conductor-ui'){throw 'Another application is using the UI port.'};$ready=$true}catch{if($_.Exception.Message -eq 'Another application is using the UI port.'){throw}}
if(-not $ready){
    $logFolder=Join-Path $env:LOCALAPPDATA 'NovaConductor\ui'
    New-Item -ItemType Directory -Path $logFolder -Force | Out-Null
    $serverScript=Join-Path $PSScriptRoot 'ui\server.mjs'
    $server=Start-Process (Get-Command node).Source -ArgumentList @(('"'+$serverScript+'"')) -WorkingDirectory $PSScriptRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $logFolder 'server.log') -RedirectStandardError (Join-Path $logFolder 'server-error.log')
    for($i=0;$i -lt 40;$i++){
        Start-Sleep -Milliseconds 250
        if($server.HasExited){throw "The UI server stopped. Check $logFolder\server-error.log"}
        try{$health=Invoke-RestMethod "$url/health" -TimeoutSec 1;if($health.app -eq 'nova-conductor-ui'){$ready=$true;break}}catch{}
    }
    if(-not $ready){throw 'UI startup timed out. Check the local server log.'}
}
$edge=Join-Path ${env:ProgramFiles(x86)} 'Microsoft\Edge\Application\msedge.exe'
if(Test-Path -LiteralPath $edge){Start-Process $edge -ArgumentList @("--app=$url",'--window-size=1500,1000')}
else{Start-Process $url}
