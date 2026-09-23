# IN / SIGNAL handoff — September 22, 2026

## Start here after the 3 PM run

The September 22 **15:00 America/Chicago** edition started but stopped at 15:21
with an editor BLOCKED result. The editor incorrectly said several names were
absent from the collected source; the draft also contained narrower wording
errors. At approximately 15:43 Central, the same project was reopened at WRITER
with source-specific repair guidance and the updated editorial policy below.
Run 0013 was verified running. Its final outcome remains to be checked.
Project: `Newsroom edition-1790107205713` (UI ID `be0053dc04f59dcab626`).
Inspect live state before launching,
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
- Wardrobe source images, hashes and approvals: 
ewsroom/anchor/wardrobe.json`.

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
- The resumed scheduled cycle remains to be verified; do not create a duplicate.

## Editorial repair update


ewsroom/editorial-policy.mjs` updates the saved library, schedule template and
current project: editor reads complete UTF-8 evidence, searches before declaring
names unsupported, and uses REVISE for fixable copy. Its opt-in
`blockedRepairLimit: 2` sends a BLOCKED result to the existing revision role for
up to two attempts while preserving the original outcome in history. It never
converts a blocked result into approval. Exhausted repairs or unusable sources
still hold publication. Templates without this option retain their old behavior.
Future newsroom flows allow up to 36 total role runs to accommodate the bounded
repair and downstream social stages. Previous state/schedules/library are saved
under the current project's `before-editorial-repair-*` folder.

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
- For a stale GPU reservation use 
ode newsroom/anchor/recover.mjs` only after
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
and [Instagram setup and recovery](newsroom/social/README.md). Run 
pm test`,
`python website/test_video.py`, and `python newsroom/scripts/test_publish.py`
after relevant changes. Live model/Instagram acceptance is separate from unit tests.

## Hardware storefront — September 22

Live at https://inversolabs.us/newsroom/hardware/. One navigation link beside Open source; no homepage product sections or article recommendations, per the updated user scope. Eight verified Seeed listings include DGX Spark (explicitly marked discontinued/out of stock at verification) and Jetson AGX Thor. Catalog/config and maintenance/deployment instructions: newsroom/HARDWARE.md. Static files deployed to website public and server Conductor source without service restarts. Desktop/mobile rendering, search/category filtering and tracking URLs verified live; npm test: 90 passed, 3 skipped, 0 failed. The repaired news edition advanced to SOCIAL_WRITER during this work and its article appeared on the public front page. Final social/anchor completion remains to be checked; do not duplicate the running workflow.

Hardware expansion: 32 active products; DGX Spark removed. All hardware is the default catalog view. Added the requested rotating product card under the front-page right-column newsroom note. Live card controls, affiliate URLs, product count and Raspberry Pi filter verified. Focused hardware tests pass. No service restarts or workflow changes.

Social caption fix: card robot now appends a missing canonical article URL to SOCIAL_READY.json before editor review; wrong links and oversized captions still fail. Writer draft is preserved. Server social files, saved NEWSROOM template, schedules and current stopped workflow updated with backups. Current card rendered successfully without model/GPU use. Current project remains NEEDS_ATTENTION at SOCIAL_CARD; resume after anchor rendering finishes so normal SOCIAL_EDITOR approval precedes publishing. No approval bypass or automatic duplicate publish.

## The Artificial News — September 22 pilot

New satire publication at https://inversolabs.us/fakenews/, Instagram handle @theartificialnews. Source is fakenews/; template ID remains FAKENEWS and watcher task remains Fake News Network Anchor to preserve state across renaming. See fakenews/README.md.

The original IN / SIGNAL September 22 newsroom/social edition reached COMPLETE and its anchor video finished. Its schedule remains 06:00/15:00 Central. The new comedy schedule is saved for 10:00/20:00 Central but disabled until the live pilot passes.

Pilot project b4dad28cd9a1822f9fa9 is in C:\Users\justi\Documents\Nova Conductor Workflow Projects\Fake News Network edition-1790118992099. Initial writer patches/PowerShell quoting failed; the revised writer returns JSON, a SAVE robot validates and writes it, and the editor still gates publication. Reopened at WRITER (run 0005); full live acceptance is pending. Website/card/intro plumbing is deployed; Instagram remains disconnected pending separate credentials for the new account. Do not claim video publication until the new anchor queue reports complete and public exports are verified.

### Pilot update — September 23, 00:17 UTC

@theartificialnews is verified and publishing enabled through the separate /artificial-social page. Test card verified by Instagram API: https://www.instagram.com/p/Ddm__eHEVuS/ (IMAGE, ID 18032221091851021). Account credentials are not in this repository. The user PC SSH tunnel uses localhost 18183 → server localhost 18183; a different local port fails the intentional Host/Origin validation.

Pilot editor APPROVE (run 0021), article published at https://inversolabs.us/fakenews/story/87d31b4d271444f2ad80/. PUBLISH run 0022 stopped after article delivery because a dynamic circular import deadlocked the social queue. Fixed with a static import; social queue was recovered independently and the approved card published. The Conductor project remains NEEDS_ATTENTION/PUBLISH until its normal idempotent robot retry after rendering. Do not duplicate the article or clear delivery state.

The independent anchor watcher automatically started edition-87d31b4d271444f2ad80 under %LOCALAPPDATA%\NovaConductor\fakenews-anchor\editions. Started 00:09:58 UTC; 45.904625 seconds of narration plus 3-second intro; navy wardrobe. At last inspection it was animating normally. Verify completed wide/vertical video and Instagram Reel before enabling the 10:00/20:00 Central schedule.

Recovery guidance now carries guidanceRole so reopening WRITER does not tell EDITOR to produce JSON. Regression test covers role isolation. Draft save robot preserves parsed drafts for revision, gives exact validation errors, and fits long summaries on sentence boundaries before editorial review. Article cap is 600 words; factual context cap 1500 characters. A short question cut off from its answer is removed when fitting future summaries; the first approved pilot retains its original reviewed copy.

Latest checks: 102 Node tests, 99 passed and 3 skipped; Python video-serving and publisher-retry tests passed. Subsequent focused summary-fitting test passed. New artificial-anchor status page and coordination guard are staged locally; deploy/reload after the current video finishes.

### Comedy narration revision — September 22
User wants an AI comedy anchor mocking human news, with no spoken factual recap or disclaimer. Updated TAN writer/editor template and anchor intro/outro; website factual context and satire labels remain. Six focused tests pass. Deployed template via setup (10/20 Central schedule remains disabled pending pilot). Stopped old anchor task and delivery worker before publication; its partial render was preserved as superseded-spoken-disclaimer-* in the edition folder. Rebuilt bulletin for edition-87d31b4d271444f2ad80, reset queue to pending, restarted anchor watcher. Shared studio recovery was active; replacement job waits for that reservation to clear. Existing Instagram image remains published; replacement video/Reel still needs verification. Continue previous handoff's PUBLISH retry, UI deployment, schedule enablement and end-to-end acceptance after new render.

## Human Watch special — September 23, 01:40 UTC
User approved manually crafted FOUR-story script (meeting story explicitly removed): fictional CEO terminology, Miles charts +400% in vibes, dishwasher robot/Mars, Moon advertising/Premium Impact Experience. Final Moon dialogue is in fakenews/specials/human-watch-001/SCRIPT.md; production manifest generated by prepare.mjs. Automated Mara flow stays single-anchor; do not replace it with the special.

New fictional special cast: Vera Volt plum dress, purple/teal studio (front/left/right), Miles Byte close-up office reporter, Iris Field full-body mock lunar site. Generated PNG assets in fakenews/anchor/assets. Built-in imagegen used, reference-preserving side-camera prompts; original generated files remain in Codex generated_images. PIPs: dishwasher and lunar advertising generated; chart drawn in compositor. New broadcast brand AN; no satire line under name or in intro; publication-page/context labels remain. Intro now procedural rotating globe/arcs/title reveal; purple/teal lower thirds. fakenews/anchor/compose.py also updated locally for consistent automated graphics, not yet deployed. Website factual context moved to bottom in source AND deployed article renderer/app.js, but only one public story remains. Six additional reviewed drafts are in specials/human-watch-001/stories.json; not yet published. Need complete requested seven-story site.

Old Mara pilot COMPLETE, public website https://inversolabs.us/fakenews/bulletins/edition-87d31b4d271444f2ad80/ and Instagram https://www.instagram.com/reel/DdnFaQBDzGA/ . Separate comedy watcher disabled while building special; schedule 10/20 Central still disabled; original IN/SIGNAL06/15 remains enabled. Queue may say running stale because watcher disabled; job.json confirms completion. Original Conductor pilot still needs idempotent PUBLISH retry. UI files (including artificial-anchor) copied to server but UI restart still pending.

Special production STARTED on server with Start-Process Hidden, Node PID10684, output %LOCALAPPDATA%/NovaConductor/fakenews-specials/human-watch-001. full-show-preview.mjs; status.json, render.log, controller.log/controller-error.log. Narration208.525208sec plus3sec intro. At last read animating speaker vera. Five camera/voice groups rendered sequentially (vera, vera_left, miles, vera_right, iris); same voice across Vera cameras. Shared withGPU lease covers all groups then restores model. Do not start another renderer or interrupt this job. It only generates PREVIEW_READY, no automatic special publisher yet. Need independent full media verification and a special-aware reviewed publisher (existing publish.mjs assumes Mara/launch or scheduled summaries; don't fake automated approval or use wrong captions). It remains essential to monitor render until completion.

15sec silent layout fixture passed: both exports decoded, 1920x1080 /1080x1920, durations15.04sec. Preview .nova-trials/special-layout/index.html opened. Inspected wide Vera/PIP and phone full-body Iris frames; face/PIP/boots clear. Normal studio background remains static intentionally; only intro/ticker/title motion. Chart PIP is currently static, not yet animated line. Full-show compositor/source and generated assets deployed before production. Latest branding was included. Portrait PIP and full-body layouts differ appropriately. No full lip-sync special acceptance yet. Need preserve per-camera render resume artifacts before retry; current preview script does not yet implement checkpoint resume, so inspect rather than blind rerun.

## 2026-09-23 presenter covers and Human Watch Instagram
- Published the original approved phone special to https://www.instagram.com/reel/DdooU07j45R/ on @theartificialnews. Server delivery record: fakenews-specials/human-watch-001/special-phone-delivery.json. Idempotent publisher: fakenews/anchor/publish-special-phone.mjs. Vera cover requested at 5000 ms; original intro remains in this already-rendered special.
- Future shared InstagramReels container creation uses thumb_offset=1000 for a presenter cover in both newsroom channels.
- Artificial News intro compositor now opens with the complete first presenter greeting, inserts the 3-second ident, then continues remaining narration. IN SIGNAL already opens on its presenter. Both website and phone layouts covered. Deployed intro.py and shared instagram-reels.mjs to NOVA-SERVER without restarting running workers.
- Verified short full-HD/vertical fixture renders decode, first frame shows Vera, total fixture duration remains 15.04s; checked shared cover API parameter with a stub request. Existing videos are not retroactively changed.
- Larger headline fonts and Iris widescreen framing corrections remain pending; this publication uses the user-requested existing phone version.

## CAPTCHA special production (2026-09-23)
- User approved a roughly 60-second Vera/Miles CAPTCHA comedy special; no new social publication requested yet. Draft, delivery beats and reproducible bulletin live in fakenews/specials/captcha-001/.
- Preserve deliberate phrase grouping and pauses, natural voices, Vera cold open, SPECIAL REPORT intro, a one-second hold after Verified human, and a brief Special Report end card. deliverySpeed 0.9; no post-hoc audio speed-up. Six distinct custom joke headlines must remain independent of the live feed.
- Assets are existing Vera/Miles portraits and procedural CAPTCHA insets (bicycle/traffic/pending/verified). Larger full-show lower thirds and ticker. Render blocks before GPU if narration cannot fit a 1–4s end card within 60s.
- Full render launched on NOVA-SERVER at 20:56Z into AppData/Local/NovaConductor/fakenews-specials/captcha-001. It waits up to three hours for the studio lease/Conductor workers, then renders. Existing IN SIGNAL edition owns the GPU initially. Inspect status.json and render.log; do not claim finished until PREVIEW_READY and independent export check.
- Silent 15.04s layout fixture passed complete decode at 1920x1080 and 1080x1920; Special Report logo and CAPTCHA phone frame visually inspected. This is not the full voiced render.
- Iris original voice restored to af_nicole. Human Watch original widescreen correction remains separate pending work.

## Artificial News AI-audience reframe (2026-09-23)
- Live /fakenews now presents an AI newsroom reporting for other AIs about human affairs. AN branding, purple/teal palette, AI desk and correspondent bios, human visitor note. Repeated satire/disclaimer banners removed; a concise comedy identity remains in About. Source context remains at the bottom of modal and permanent articles. Existing story bodies/media retained.
- Deployed index.html/app.js/style.css and render_articles.py to live site and app source; regenerated permanent article HTML. Updated bulletin page display branding to The Human Briefing. Static backups are under website/fakenews/backups/ai-desk-20260923-160531; bulletin pages have .before-ai-desk backups.
- Updated saved FAKENEWS writer/editor prompts and schedule prompt via fakenews/update-editorial.mjs. Existing models, paths, slots, enabled state and 10:00/20:00 America/Chicago times retained. No service restart. Saved schedule/template backups created before update.
- Verified live desktop appearance, opening/closing story modal, source record placement, permanent article HTTP 200 and banner absence; JS syntax and diff checks pass. Fixed pre-existing double-encoded punctuation in app.js.

## Instagram access block (2026-09-23 afternoon)
- Meta returns HTTP400/code200 OAuthException, exact message API access blocked, even for account identity reads on BOTH @inversolabs and @theartificialnews. Not an image/caption problem. No token or raw credential-bearing responses logged. User asked to check Meta developer dashboard notice; awaiting that information.
- IN SIGNAL post 30aa7c0acfe7f3809f1c remains approved and unpublished. autoRetry=false, blockedReason=INSTAGRAM_ACCESS_BLOCKED; prior post state backed up next to post.json. No media/container deletion or account disconnect.
- Shared Instagram client now classifies this exact access block with an actionable safe error. Both image publishers hold automatic retry for that error. Deployed files, 17 focused social tests pass. Long-lived processes were not restarted, so loaded modules take effect on their next process start; the current pending post is explicitly held in durable state.
- Did not stop the 3PM render or CAPTCHA special queue. Instagram video publication may hit the same external block; website/render work can continue. Restore Meta access before retrying publication; preserve delivery records to prevent duplicate posts.
