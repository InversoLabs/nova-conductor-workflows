# Server-hosted newsroom

The newsroom now runs on NOVA-SERVER under the Windows account `justi`, independently of the laptop. The server hosts the model bridge, Conductor controller, schedule, and website publisher.

## Installed locations

- App: `C:\Users\justi\Documents\Nova Conductor Studio`
- Projects and run evidence: `C:\Users\justi\Documents\Nova Conductor Workflow Projects`
- Settings and schedules: `C:\Users\justi\AppData\Local\NovaConductor`
- Workflow library: `C:\Users\justi\AppData\Local\Nova-Conductor\library\templates\NEWSROOM.json`
- Service logs: `C:\Users\justi\AppData\Local\NovaConductor\server`
- Website: `C:\Users\justi\Documents\inversolabs-homepage\newsroom`

## Runtime and schedule

The `Nova Conductor Server` Windows task runs Run-Server.ps1 as `justi` with an interactive token and limited privileges. The server user must stay signed in; the screen can be locked. The task starts at user logon, retries after failure, and has daily wake triggers. On this server (Central time), 09:59 and 18:59 wake it before the 08:00 and 17:00 Pacific publication slots. The app uses America/Los_Angeles when deciding which edition is due. The server must remain powered on, with justi signed in, and have internet access. Wake requires hardware/Windows support.

Codex 0.155.1 is installed privately in `runtime/node_modules`; the existing global Codex installation is unchanged. Node 22.22.0 runs the service. A private PowerShell 7.6.5 runtime is in runtime/powershell. NOVA_CONDUCTOR_HEADLESS=1 suppresses native viewer windows for background jobs. On an interactive workstation, normal viewer behavior is unchanged.

Nova Bridge uses server loopback http://127.0.0.1:8787/v1. The API credential is protected by Windows DPAPI for justi. Do not put secrets into workflow files or task arguments. The publisher uses `transport: local`, calls the existing Python publisher directly, and still requires editorial approval, validates content, and verifies public URLs. SSH publishing remains available for workstation installations.

The management UI binds only http://127.0.0.1:18183 on the server. Open that address in a browser on NOVA-SERVER. The laptop's original UI on port 18181 is a separate installation; its newsroom schedule is disabled to prevent duplicate editions.

## Operations (PowerShell on the server)

```powershell
Get-ScheduledTask -TaskName 'Nova Conductor Server'
Start-ScheduledTask -TaskName 'Nova Conductor Server'
Invoke-RestMethod http://127.0.0.1:18183/health
Invoke-RestMethod http://127.0.0.1:18183/api/projects
```

Use Stop in the Conductor UI for an active edition and wait for it to stop before stopping the task. Stop-ScheduledTask is appropriate for maintenance when no workers are active. Failed editorial or validation steps remain NEEDS_ATTENTION; they do not silently become approved. The next scheduled slot starts a new edition. Empty source feeds hold publication.

To roll back hosting, first disable the server's newsroom schedule and stop any active server edition. Only then re-enable the laptop schedule. Never leave both publication schedules active. Existing laptop project history is preserved.

## Migration verification

A normal server collection run held publication because no fresh, unpublished source remained. A separate bounded migration project reuses a previously published source to exercise native writer and editor sessions plus validation and local publishing. The publisher's existing source ID is idempotent, so this test must neither create a duplicate nor replace an article. See the migration project's state.json, runs, and work/PUBLISHED.json for the result.

The verified configuration uses Codex's unelevated Windows sandbox, retaining workspace restrictions and default private-desktop isolation. On this older Windows 10 18363 host, sandboxed PowerShell failed to initialize under a non-interactive S4U task, even with modern PowerShell. The elevated sandbox runner also failed in that context. The interactive user task passes the shell probe. Supported elevated setup was evaluated, but its sandbox accounts are not used by the final fallback configuration. Do not disable filesystem sandboxing to work around shell startup failures. After a server reboot, sign in as justi to resume the task.
