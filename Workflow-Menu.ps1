# Workflow and agent library menus. All saved definitions are validated by the engine.
function Read-Default([string]$Label,[string]$Default) {
    $value=Read-Host "$Label [$Default]"
    if(-not $value.Trim()){return $Default};return $value.Trim()
}
function Read-Paths([string]$Label,$Default) {
    $text=Read-Default "$Label (comma separated; - for none)" ($Default -join ',')
    if($text -eq '-' -or -not $text){return @()}
    return @($text.Split(',') | ForEach-Object {$_.Trim()} | Where-Object {$_})
}
function Select-Library([string]$Kind) {
    $items=@(& node $cli $Kind | ConvertFrom-Json)
    if($LASTEXITCODE -ne 0){throw 'Cannot read library.'}
    for($i=0;$i -lt $items.Count;$i++){Write-Host ("{0}  {1}" -f ($i+1),$items[$i].name)}
    Write-Host 'P  Load a JSON definition from disk'
    $value=Read-Host 'Choose'
    if($value -eq 'P'){return (Read-Host 'JSON file path').Trim().Trim('"')}
    $number=0
    if(-not [int]::TryParse($value,[ref]$number) -or $number -lt 1 -or $number -gt $items.Count){throw 'Choose a listed number.'}
    return $items[$number-1].key
}
function Save-Definition([string]$Kind,$Definition) {
    $temp=[IO.Path]::GetTempFileName()
    try {
        [IO.File]::WriteAllText($temp,($Definition | ConvertTo-Json -Depth 20))
        $command=if($Kind -eq 'agents'){'save-agent'}else{'save-template'}
        $saved=& node $cli $command $temp
        if($LASTEXITCODE -ne 0){throw 'Definition failed validation; nothing saved.'}
        Write-Host "Saved: $saved" -ForegroundColor Green
        return $saved
    }finally{Remove-Item -LiteralPath $temp}
}
function Edit-Agent {
    $base=$null
    if((Read-Host 'N New agent | E Edit or duplicate saved agent').ToUpperInvariant() -eq 'E'){
        $key=Select-Library 'agents';$base=& node $cli show-agent $key | ConvertFrom-Json
        if($LASTEXITCODE -ne 0){throw 'Cannot load agent.'}
    }
    $agent=[ordered]@{schemaVersion=1;id=(Read-Default 'Stable ID (uppercase letters/digits/underscore)' $(if($base){$base.id}else{'MY_AGENT'})).ToUpperInvariant();name=(Read-Default 'Display name' $(if($base){$base.name}else{'My agent'}));prompt=(Read-Default 'Agent responsibilities' $(if($base){$base.prompt}else{'Inspect the project, implement the user request, and verify the result.'}));access=(Read-Default 'Access: workspace-write or read-only' $(if($base){$base.access}else{'workspace-write'}))}
    $override=Read-Default 'Model override (inherit or a model ID)' $(if($base.model){$base.model}else{'inherit'})
    if($override -ne 'inherit'){$agent.model=$override}
    return Save-Definition 'agents' $agent
}
function Edit-Template {
    $base=$null
    if((Read-Host 'N New workflow | E Edit or duplicate saved workflow').ToUpperInvariant() -eq 'E'){
        $key=Select-Library 'templates';$base=& node $cli show-template $key | ConvertFrom-Json
        if($LASTEXITCODE -ne 0){throw 'Cannot load template.'}
        if($base.engine){$base=& node $cli show-template custom-code | ConvertFrom-Json}
    }
    $template=[ordered]@{schemaVersion=1;id=(Read-Default 'Template ID (change to duplicate)' $(if($base){$base.id}else{'MY_WORKFLOW'})).ToUpperInvariant();name=(Read-Default 'Workflow name' $(if($base){$base.name}else{'My workflow'}));maxRuns=[int](Read-Default 'Maximum role sessions including retries (1-200)' $(if($base){[string]$base.maxRuns}else{'20'}))}
    $count=[int](Read-Default 'Number of roles (1-20)' $(if($base){[string]$base.roles.Count}else{'3'}))
    if($count -lt 1 -or $count -gt 20){throw 'Choose 1-20 roles.'}
    $roles=@()
    for($i=0;$i -lt $count;$i++){
        $old=$null;if($base -and $i -lt $base.roles.Count){$old=$base.roles[$i]}
        Write-Host "`nRole $($i+1) of $count" -ForegroundColor Cyan
        $role=[ordered]@{id=(Read-Default 'Role ID' $(if($old){$old.id}else{"ROLE_$($i+1)"})).ToUpperInvariant();name=(Read-Default 'Display name' $(if($old){$old.name}else{"Role $($i+1)"}));prompt=(Read-Default 'Responsibilities' $(if($old){$old.prompt}else{'Complete your assigned part of the original request and verify the result.'}));access=(Read-Default 'Access: workspace-write or read-only' $(if($old){$old.access}else{'workspace-write'}));inputs=@(Read-Paths 'Input artifact paths' $old.inputs);outputs=@(Read-Paths 'Required output paths' $old.outputs);writes=@(Read-Paths 'Writable paths (* for product files, excluding other owned artifacts)' $old.writes)}
        $override=Read-Default 'Model override (inherit or model ID)' $(if($old.model){$old.model}else{'inherit'})
        if($override -ne 'inherit'){$role.model=$override}
        $roles+=,$role
    }
    Write-Host ('Role IDs: '+(($roles | ForEach-Object {$_.id}) -join ', ')) -ForegroundColor Cyan
    for($i=0;$i -lt $roles.Count;$i++){
        $role=$roles[$i];$old=$null;if($base -and $i -lt $base.roles.Count){$old=$base.roles[$i]}
        Write-Host "Routes for $($role.id)"
        $defaultNext=if($i+1 -lt $roles.Count){$roles[$i+1].id}else{'COMPLETE'}
        $review=(Read-Default 'Review role? Y returns APPROVE/REVISE; N returns DONE' $(if($old.routes.APPROVE){'Y'}else{'N'})) -eq 'Y'
        $routes=[ordered]@{BLOCKED='NEEDS_ATTENTION'}
        if($review){
            $routes.APPROVE=(Read-Default 'Approved destination (role ID or COMPLETE)' $(if($old.routes.APPROVE){$old.routes.APPROVE}else{$defaultNext})).ToUpperInvariant()
            $routes.REVISE=(Read-Default 'Revision destination role ID' $(if($old.routes.REVISE){$old.routes.REVISE}else{$roles[0].id})).ToUpperInvariant()
        }else{$routes.DONE=(Read-Default 'Done destination (role ID or COMPLETE)' $(if($old.routes.DONE){$old.routes.DONE}else{$defaultNext})).ToUpperInvariant()}
        $role.routes=$routes
    }
    if($base.allowBuildPlanUpdates){$template.allowBuildPlanUpdates=$true}
    $template.roles=$roles;$template.start=(Read-Default 'Starting role ID' $(if($base){$base.start}else{$roles[0].id})).ToUpperInvariant()
    Write-Host ($template | ConvertTo-Json -Depth 20)
    return Save-Definition 'templates' $template
}
function Start-Workflow([switch]$OneShot) {
    if($OneShot){
        if((Read-Host 'S Select saved agent | N Create agent').ToUpperInvariant() -eq 'N'){$key=Edit-Agent}else{$key=Select-Library 'agents'}
    }else{$key=Select-Library 'templates'}
    $name=Read-Host 'Project name'
    if($name -notmatch '^[A-Za-z0-9][A-Za-z0-9 _-]{0,59}$'){throw 'Use letters, numbers, spaces or dashes.'}
    $source=(Read-Host 'Existing codebase/content folder (Enter for an empty project)').Trim().Trim('"')
    $prompt=Read-Host 'Instructions for this project'
    if(-not $prompt.Trim()){throw 'Instructions are required.'}
    $script:model=Select-Model -Current $model
    $root=Join-Path $projects ($name+'-'+[DateTime]::Now.ToString('yyyyMMdd-HHmmss'))
    $temp=[IO.Path]::GetTempFileName()
    try {
        [IO.File]::WriteAllText($temp,$prompt)
        $command=if($OneShot){'one-shot'}else{'workflow-init'}
        $cliArgs=@($command,$root,$key,$temp,$model);if($source){$cliArgs+=,$source}
        & node $cli @cliArgs
        if($LASTEXITCODE -ne 0){throw 'Project initialization failed.'}
    }finally{Remove-Item -LiteralPath $temp}
    Write-Host "Working folder: $root\work" -ForegroundColor Green
    if($source){Write-Host 'This is a separate copy; your original folder is unchanged.'}
    Start-Project $root
}
