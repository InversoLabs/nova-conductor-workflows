# The Artificial News

A separate satirical world-news edition at https://inversolabs.us/fakenews/.
It reuses Conductor's workflow engine and the approved Mara Vale studio assets.
It does not reuse IN / SIGNAL's articles, publication queue, or Instagram account.

## Edition flow

Source robot → comedy writer → save/check robot → satire editor → publisher.
The writer returns JSON for an original satirical article plus an accurate `factualSummary`
and source links. The editor can send it back for revision. Only approval routes
to publishing. A deterministic robot parses, validates and saves the writer's JSON,
avoiding model-generated shell quoting or patch operations. Failed checks and exhausted retries require attention rather than
publishing an unchecked draft. Source selection excludes sensitive tragedy topics.

The site labels the publication as satire and separates factual context from the
fictional jokes. Publishing also prepares a 1080×1350 social card and a caption
under the site's `social-drafts` directory. These drafts await a separate account.

The anchor service watches this publication's feed, narrates each new approved
summary, rotates the existing presenter wardrobe, and exports both 1920×1080 and
1080×1920 videos. Each has an original three-second TAN intro with a satire label.
The ticker uses up to the latest six headlines from this publication only.
Copy, file hashes, duration and video decoding are checked before website delivery.
These checks do not replace human review of comedy quality or animation artifacts.

## Server installation

This installation extends an existing working Conductor/newsroom/anchor server.
Use the same Node, Python, FFmpeg, voice and lip-sync runtime as IN / SIGNAL.
Run `node fakenews/setup.mjs` to save the FAKENEWS template and a disabled schedule.
It derives `fakenews.json` from the existing `newsroom.json`, changing the public
URL and site root. Inspect the derived paths before the first publication.

Deploy `site/*` to the website's `fakenews/public` directory, and deploy
`scripts/publish.py`, `scripts/render_articles.py`, and `scripts/card.ps1` to its
`fakenews` root. The website server must include the `/fakenews` route from
`website/server.py`. Preserve existing stories, queues, and delivery records.

Run `node fakenews/anchor/service.mjs` as a persistent server process. The installed
Windows task retains the stable name `Fake News Network Anchor`, running as the same server user as
Conductor. Its logon and 09:59/19:59 wake triggers keep the watcher available.
Only one watcher instance should run. Conductor itself must also remain available.
`fakenews/install-watcher.ps1` recreates the task under the current server user;
its daily wake triggers assume the server Windows timezone is Central.

After end-to-end acceptance, `node fakenews/setup.mjs --enable` enables **10 AM and
8 PM America/Chicago** editions. IN / SIGNAL remains at 6 AM and 3 PM Central.
The durable queue is `%LOCALAPPDATA%\NovaConductor\fakenews-anchor`; config is
`%LOCALAPPDATA%\NovaConductor\fakenews.json`. The two studios share the original
global GPU lease and active-controller checks, so busy inference/rendering waits.

## Operations

`node fakenews/anchor/automation.mjs` prints queue status. Each edition folder
contains `automation.log`, `job.json`, render status, approved media hashes, and
delivery receipts. Three automatic attempts are allowed. Inspect the failure
before retrying; do not delete delivery state or clear seen IDs to force reruns.
Shared GPU recovery remains `node newsroom/anchor/recover.mjs` and refuses a live
owner. Never stop IN / SIGNAL's worker to make room for this publication.

Instagram delivery defaults to disabled. Connect **@theartificialnews** through
`http://127.0.0.1:18183/artificial-social` on the server, then enable publishing.
The form verifies the handle and saves a separate Windows-protected credential
(`NOVA_ARTIFICIAL_INSTAGRAM_TOKEN`). Settings/outbox live under
`%LOCALAPPDATA%\NovaConductor\artificial-social`; IN / SIGNAL's connection is unchanged.
Website and vertical videos still publish while Instagram is disconnected.
Existing preview cards require a manual Publish click; future approved cards and
videos publish automatically after connection. An existing website-only video can
be delivered after connection with `node fakenews/anchor/publish.mjs <render-folder>`.
Delivery receipts prevent duplicate submission; do not delete them to force a retry.

Run `npm test` and Python compilation for the changed publisher/compositor code.
The real model → article → card → lip-sync → public video pilot is a separate
acceptance check; unit tests alone do not establish that it completed.
