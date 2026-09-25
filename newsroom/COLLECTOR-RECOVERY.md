# Collector recovery — 2026-09-25

The September 25 morning retry and afternoon edition stopped at COLLECT because
selection truncated to the newest ten unpublished entries before checking article
readability. All ten were OpenAI entries returning HTTP 403. Other publishers had
usable unpublished material further down the list (49 fresh entries, 36 unpublished).

Fix: interleave publishers, enrich in batches of three, and continue until a readable
source is found instead of discarding all candidates beyond ten. Keep the existing
minimum source-text requirement and published-URL exclusion. Log fetch/extraction
failures and candidate counts in the robot log. Write only SOURCES.json, as required
by the existing workflow artifact contract. True exhaustion still holds publication;
it must not count as a successfully published edition.

Deployed to NOVA-SERVER's Nova Conductor Studio/newsroom/scripts/newsroom.mjs.
Afternoon project 5f8b45f546608010937d resumed at COLLECT. Run 0003 passed collection
and run 0004 entered WRITER with gpt-oss:20b. An initial retry (0002) rejected a new
diagnostic file under the artifact guard; diagnostics now go to stdout instead.

Validation: node --test test/collector.test.mjs test/editorial-policy.test.mjs
Seven checks passed, covering publisher starvation, more than ten unreadable sources,
deduplication, HTTP error evidence, artifact permissions and editorial repair bounds.
