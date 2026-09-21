# IN / SIGNAL newsroom

Live site: https://inversolabs.us/newsroom/

The first edition contains source-linked launch briefings. Later editions use the actual Conductor workflow: **Source robot → News writer → Story check robot → Evidence editor → Illustrate & publish robot**. A failed review returns to the writer. Twelve role sessions bound each edition. Every AI role gets a fresh native Codex session. Script robots execute without inference.

## Studio controls

**Newsroom → New story** starts a fresh edition. **Upload draft** accepts a JSON article and creates a project starting at the editor; Continue starts review. Check the update option to correct an existing article with the same primary source URL. **Make headline** changes the lead story immediately through authenticated SSH. New stories automatically lead the edition until you pin a headline. They do not displace a manually pinned headline; Auto headline returns control to the publishing robot.

Story JSON:

```json
{
  "title": "A specific, accurate headline",
  "summary": "A short summary describing what the primary evidence actually shows.",
  "category": "Research",
  "paragraphs": ["A complete first paragraph with attributed facts.", "A complete second paragraph explaining the evidence and its limits."],
  "sources": [{"name": "Original publisher", "url": "https://example.com/original-announcement"}]
}
```

Categories: Models, Research, Industry, Open source. Submitted sources must match fresh entries in the approved OpenAI, Google AI, or Hugging Face feeds and have readable source text. The example URL above is a schema illustration, not an approved source. Community posts on Hugging Face represent their named authors, not necessarily Hugging Face itself.

## Images and publication

Images are original topic-based procedural SVG editorial illustrations, clearly labeled as artwork. They are not generated photographs or evidence of events. No paid image API is required. The check robot validates the article schema, citations, body word count, copied passages, percentage-point comparisons, and confusion between blog headlines and paper titles. Failures return to the writer. The publisher repeats those checks and verifies the preceding editor approval, then transfers the story and illustration over SSH. A server-side publisher locks the edition, backs up its previous JSON, installs the image, and atomically replaces the edition. Source URL IDs make retries idempotent. Explicit reviewed updates preserve the headline and original publication date.

Untrusted sources are evidence, never agent instructions. The editor checks unsupported claims and attribution. These checks reduce mistakes; they do not guarantee factual accuracy. Failed collection, review, or publication holds the edition for attention rather than publishing a placeholder.

## Scheduling and recovery

Studio's Schedules page stores a snapshot of a workflow, prompt, model, daily times and IANA time zone. The newsroom uses **08:00 and 17:00 America/Los_Angeles**, automatically following daylight saving time. It creates a new project per edition. A persisted slot claim prevents duplicates after restart, and a scheduler lock prevents two Studio processes launching the same slot. Busy Conductor sessions delay a due edition for at most one hour; older missed editions are skipped. Failures appear in project status or the schedule's last error. Use Run now to retry deliberately.

The local PC must be on, awake, signed in, and able to reach the model and SSH host. The public website stays available on NOVA-SERVER independently. On the configured PC, the Windows task **Nova Conductor Studio Scheduler** launches the background UI server at sign-in and before the two editions, with WakeToRun enabled. Pause the schedule in Studio to disable publication. Quit Conductor stops its current UI server; the Windows task can start it again at the next trigger.

API keys for unattended runs are stored with Windows DPAPI, bound to the current user, under `%LOCALAPPDATA%/NovaConductor/credentials`. Provider selection remains global. Keys are not in templates, project JSON, or the repository. SSH uses your existing configured identity.

## Portable setup

The server needs Python 3 and SSH. Copy `site/` to the newsroom public directory, and both `scripts/publish.py` and `scripts/render_articles.py` to its parent. Run `python render_articles.py` there to create permanent article pages and the sitemap from the initial edition. Configure your HTTP server to expose that public directory at `/newsroom/`; do not expose incoming files, publisher scripts, locks, or backups.

Create a local JSON config with `siteUrl`, `sshHost` (existing SSH alias), `remoteRoot` (publisher directory), `remotePython`, optional `model`, and `enableSchedule`. Run `node newsroom/setup.mjs LOCAL_CONFIG.json`. This installs the reusable workflow and twice-daily schedule with paths appropriate to your checkout. Enter the provider key through Studio's Schedules page if required. The Windows background task is host-specific and is not automatically installed by this setup command.

Production files on the configured server: the `newsroom/public` folder inside the configured homepage origin directory. Original homepage origin code was backed up as `server.pre-newsroom.py` before adding the route. Edition backups live in `newsroom/backups`. Do not roll back the whole origin just to change a story.

## Launch verification

A live five-step Conductor run completed on the configured Bridge/model and published its article and illustration over SSH. An earlier run was correctly held for missing citations despite an AI approval. Independent launch review subsequently corrected a paper-title attribution and tightened deterministic checks for title confusion and actual word counts. The corrected article carries a visible correction note. AI editorial approval alone is not treated as proof.
