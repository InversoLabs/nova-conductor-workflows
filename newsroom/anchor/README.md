# IN/SIGNAL anchor studio

Presenter: Mara Vale. The wardrobe includes the original charcoal/ivory look,
a navy blazer with pale blue blouse, an understated burgundy dress, and a light
gray blazer with black blouse. Only tested, approved entries in wardrobe.json
are eligible. Each edition pins the selected look and source-image SHA-256;
retries keep it, and both video formats come from that same animation master.
New editions rotate navy, dress, gray, charcoal, then repeat.

`Setup-Anchor.ps1` installs isolated face and voice environments under the app's
`runtime/anchor` folder. It does not change Conductor's Python or Ollama install.

Run `node newsroom/anchor/preview.mjs <fresh-output-directory>` on the server.
The preview uses a studio introduction, not an unreviewed news story. It creates
local narration, animates the master portrait, restores loaded Ollama models,
then exports website.mp4 (1920×1080) and instagram.mp4 (1080×1920). Nothing is
published by this command. Inspect status.json and render.log for progress.

The compositor includes a broadcast headline panel and a seamless scrolling
ticker. Pass `--headlines-json <file>` to compose.py with a JSON array of approved
headline strings, plus optional `--headline` and `--label` for the main panel.
Graphics can be re-exported from the saved face master without repeating lip sync
or unloading the language model. The ticker scrolls at least 105 pixels per second, increasing enough to show the complete headline cycle within a timed bulletin.

For a bulletin, run `node newsroom/anchor/preview.mjs <fresh-output-directory>
<bulletin.json>` (one command). The JSON contains an ID, editionDate, source story
snapshots, and segments with title/text. Generate the introduction with a dated
Top Stories title, one segment per story, and a closing segment. Voice synthesis
records actual segment times in voice.json; `--timeline-json voice.json` makes
the compositor fade each matching title in/out over 0.2 seconds. Each bulletin
refreshes the six most recently published headlines immediately before export,
independent of front-page priority. If fewer than six exist, it uses those available.

The explicit publisher is `node newsroom/anchor/publish.mjs <output-directory>`.
It requires review.json with outcome APPROVE, checkedBy, checkedAt, and SHA-256
hashes for bulletin.json, voice.json, headlines.json, website.mp4 and instagram.mp4.
Review the source copy and rendered files before writing this receipt. Changed
artifacts are rejected. The publisher verifies public video hashes, exposes the
bulletin on the newsroom website, and uses durable Instagram delivery state to
avoid reposting an uncertain submission. The current test caption identifies a
launch-edition studio test. This command does not enable a recurring schedule.

The hardware lease holds new Conductor runs while animation owns the GPU.
After interruption, do not simply delete the lease: confirm the renderer ended
and restore models recorded in `%LOCALAPPDATA%/NovaConductor/studio-lease.json`.
Run `node newsroom/anchor/recover.mjs` for explicit crash recovery. It refuses
to clear the reservation while its owner or an inference process remains alive.
The first version restores recorded context sizes and indefinite model keepalive.
It does not reconstruct other custom Ollama runtime options.

The first 14-second studio preview passed on the P1000: about seven minutes of
face rendering, thirteen minutes end to end including model reload and exports.
Voice, animation, and the broadcast layout were accepted by the user. The 41.72-second two-story trial passed timed-title and video validation, website
playback, and Instagram Reel delivery on September 22, 2026. Automatic editions
were enabled afterward without backfilling old stories.
Automatic editions are supported by the server queue described below. Subtitles remain separate work.


## Autonomous coordination

After a successful end-to-end acceptance test, run `node newsroom/anchor/automation.mjs enable`
on the server. Enabling records existing story IDs without backfilling them. The existing
6 AM / 3 PM America/Chicago newsroom schedule is unchanged. New publicly published
stories enqueue a bulletin with that story and the newest other story, up to two total.
Mara reads their approved summaries verbatim; this path does not generate new claims.
The ticker refreshes the six newest headlines before composition.

The server waits until Conductor's newsroom/social agents finish before launching one
anchor worker. Its durable PID keeps new UI/scheduled model runs waiting. The exclusive
hardware lease additionally protects animation against CLI launch races. Network-only
social retries can continue because they do not use inference hardware.

Each bulletin persists its queue, render, review, and delivery state. A server UI restart
reattaches by live PID; finished exports are reused for delivery retries. Up to three
attempts are made with a five-minute delay, then the job needs attention. A dead studio
owner can trigger bounded model restoration using the guarded recovery command; live
inference is never killed to make space. Failed restoration keeps the GPU hold.
Due schedule slots observed during a long render persist until they can launch.

Automatic review checks exact published copy, measured narration timing, both video
formats, complete decoding, and duration. It records these actual checks, not a claim
of human visual inspection. It uses the presenter/layout accepted in the initial trial.
Changed published copy holds the bulletin. Instagram uncertainty is reconciled without
blindly reposting. Delivery state and errors appear at `/anchor` and `/api/anchor`.
These files live under `%LOCALAPPDATA%/NovaConductor/anchor` on the server.
