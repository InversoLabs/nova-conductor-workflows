# IN / SIGNAL handoff — September 22, 2026

## Start here after the 3 PM run

This checkpoint was prepared before the September 22 **15:00 America/Chicago**
edition. Its outcome is not yet known. Inspect live state before launching,
reopening, resetting, or publishing anything. Do not create a second schedule.

Production runs on NOVA-SERVER, not the laptop. The server's user must remain
signed in (locking the screen is fine). After a reboot, sign in and start Nova
Desktop's bridge; its current GUI does not start the bridge automatically.

From PowerShell on the server:

```powershell
Set-Location 'C:\Users\justi\Documents\Nova Conductor Studio'
Invoke-RestMethod http://127.0.0.1:18183/health
Invoke-RestMethod http://127.0.0.1:18183/api/schedules
Invoke-RestMethod http://127.0.0.1:18183/api/projects
Invoke-RestMethod http://127.0.0.1:18183/api/anchor
Invoke-RestMethod http://127.0.0.1:18183/api/social
Get-ScheduledTask -TaskName 'Nova Conductor Server'
```

Use the existing SSH host alias `NOVA-SERVER` from the development laptop.
Never print credential files or put tokens into command arguments or Git.

## Expected sequence

1. The existing newsroom schedule starts at **06:00 and 15:00 Central daily**.
   It creates one new source-linked briefing, subject to validation and editor approval.
2. After website publication, social writer/card/editor/publisher roles produce
   the Instagram image post for `@inversolabs`.
3. The anchor queue detects the new public story after active Conductor workers
   finish. It creates a bulletin covering that story and the newest other story,
   up to two total. Narration uses the approved summaries verbatim.
4. The GPU lease unloads GPT for SadTalker, then restores its 16K context.
   The compositor creates 1920×1080 website and 1080×1920 Instagram videos.
5. Automated copy/timing/decoding checks authorize delivery. The wide bulletin
   appears on the website; the vertical version is published as an Instagram Reel.

3 PM is the start time, not the delivery time. If no story passes review, there
is no new bulletin. Network-only social retries may run alongside rendering.
Observed due slots persist while hardware is busy. Retries retain publication
state and do not blindly repost uncertain Instagram submissions.

## Current presentation

- Presenter: fictional Mara Vale; introduction uses “with In Signal.”
- Opening title: Top Stories plus the current Central date; measured narration
  timings drive story titles and subtle fades.
- Ticker: six newest published headlines, refreshed before composition.
- Outfit order: navy blazer, burgundy dress, gray blazer, original charcoal;
  repeats per edition. The choice and image hash are saved in the bulletin.
  Both formats and retries keep the same outfit.
- Wardrobe source images, hashes and approvals: `newsroom/anchor/wardrobe.json`.

## Evidence already completed

- A 41.72-second two-story bulletin passed complete decoding, dimension/audio
  checks and rendered-frame inspection. Public video bytes were verified, and
  browser playback loaded successfully with no video error.
- Website: https://inversolabs.us/newsroom/bulletins/launch-two-stories-20260922/
- Instagram: https://www.instagram.com/reel/Ddmb5xRFEEx/
  Meta independently returned media_product_type REELS for media 18042627761816247.
- All three new outfits passed 4.8-second SadTalker trials, both export formats,
  complete decoding and frame inspection. User accepted the previews.
- Server test evidence: app `.nova-trials/bulletin-e2e-20260922` and
  `.nova-trials/wardrobe-test`. These large generated artifacts remain on disk.
- Before the scheduled run: anchor and Instagram enabled, empty anchor queue,
  no GPU lease, GPT loaded at 16384 context, schedule enabled without errors.
- The first fully scheduled combined cycle remains to be verified after 3 PM.

## Where to inspect results

| Item | Server location |
| --- | --- |
| App | `C:\Users\justi\Documents\Nova Conductor Studio` |
| Newsroom projects | `C:\Users\justi\Documents\Nova Conductor Workflow Projects` |
| Service logs | `%LOCALAPPDATA%\NovaConductor\server-18183` |
| Schedule state | `%LOCALAPPDATA%\NovaConductor\schedules.json` |
| Anchor queue | `%LOCALAPPDATA%\NovaConductor\anchor\automation.json` |
| Edition state and output | `%LOCALAPPDATA%\NovaConductor\anchor\editions\edition-<story-id>` |
| Social outbox | `%LOCALAPPDATA%\NovaConductor\social\outbox` |
| GPU reservation | `%LOCALAPPDATA%\NovaConductor\studio-lease.json` |
| Website public files | `C:\Users\justi\Documents\inversolabs-homepage\newsroom\public` |

For the newest newsroom project, read `state.json`, `ui-controller.log`, `runs`,
and `work/PUBLISHED.json` / `work/SOCIAL_RESULT.json`. For an anchor edition, read
`job.json`, `automation.log`, `render/status.json`, `render/render.log`, and
`render/delivery.json`. A successful background social retry may be newer than
the project's last recorded result; consult the authoritative outbox.

The server UI has `/anchor` and `/social` views. It binds to loopback port 18183;
the laptop's port 18181 is a different installation, with its schedule disabled.

## Recovery and limitations

- Do not delete delivery records, reset seen IDs, or re-enable a second publisher.
  Up to three automatic attempts are made before attention is required.
- For a stale GPU reservation use `node newsroom/anchor/recover.mjs` only after
  inspecting the owner. It refuses a live owner/inference process and restores
  recorded models before releasing the hold. Failed restoration retains the lease.
- Instagram token refresh is not automatic. Reconnect through Social team before
  expiry; no token belongs in source control. Model/provider choice remains global.
- Automatic video checks verify copy and technical output; they do not claim a
  human watched every generated edition. The layout and wardrobe were manually
  inspected during acceptance. Subtitles are not implemented.
- Website `server.py` and `video.py` must both be deployed to the website root,
  and the actual Python process reloaded, for MP4/range requests to work.
- A service refresh must wait for active work. Do not restart the model bridge
  or kill a rendering worker just to update UI files.

## Backup scope and restoration

This Git repository backs up source code, install scripts, workflow definitions,
tests, documentation, the IN/SIGNAL logo and all four presenter source images.
It deliberately excludes credentials, installed runtimes/weights, generated
videos, operational queues and live project history. Those remain on the server;
Git alone is not a disaster-recovery backup of live delivery state.

Preserve `%LOCALAPPDATA%\NovaConductor`, the workflow library, project directories,
website public files and edition outputs in a separate private machine backup.
DPAPI credentials are user/machine-bound and may require reconnection on a new
host. Restoring source must not overwrite the current queue or schedule state.

See [server operations](SERVER.md), [anchor setup and recovery](newsroom/anchor/README.md),
and [Instagram setup and recovery](newsroom/social/README.md). Run `npm test`,
`python website/test_video.py`, and `python newsroom/scripts/test_publish.py`
after relevant changes. Live model/Instagram acceptance is separate from unit tests.
