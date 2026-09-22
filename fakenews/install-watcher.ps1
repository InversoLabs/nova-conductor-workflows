param([string]$Node=(Get-Command node -ErrorAction Stop).Source)
$ErrorActionPreference='Stop'
$repo=Split-Path $PSScriptRoot -Parent
$service=Join-Path $PSScriptRoot 'anchor\service.mjs'
$action=New-ScheduledTaskAction -Execute $Node -Argument ('"'+$service+'"') -WorkingDirectory $repo
$user=[Security.Principal.WindowsIdentity]::GetCurrent().Name
$triggers=@((New-ScheduledTaskTrigger -AtLogOn -User $user),(New-ScheduledTaskTrigger -Daily -At '09:59'),(New-ScheduledTaskTrigger -Daily -At '19:59'))
$settings=New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew -StartWhenAvailable -WakeToRun -ExecutionTimeLimit ([TimeSpan]::Zero) -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 5)
$principal=New-ScheduledTaskPrincipal -UserId $user -LogonType Interactive -RunLevel Limited
# Retain the installed task's stable name across the publication rename.
Register-ScheduledTask -TaskName 'Fake News Network Anchor' -Action $action -Trigger $triggers -Settings $settings -Principal $principal -Force | Out-Null
Write-Host 'Watcher registered. Start it with Start-ScheduledTask only when no existing watcher or bulletin worker is active.'
