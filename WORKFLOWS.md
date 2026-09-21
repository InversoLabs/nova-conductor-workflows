# Workflows and one-shot agents

## Start testing

Run **Start Conductor.cmd**. Node 22+, Git, and Codex CLI must be on PATH. No npm install is required. New projects go under Documents/Nova Conductor Workflow Projects. Configure your provider with **8**, then choose:

- **W -> Writing studio** for Producer -> Writer -> Editor.
- **W -> Customizable code builder** for an editable planner/build/review loop.
- **W -> Code builder with second final review** for an additional independent review before completion.
- **1** or **W -> Code project builder** for the original coding engine.
- **O** for one agent: select General agent, another saved profile, or create one. Enter an existing folder (or Enter for empty), instructions, and a model. It can execute many tools and turns, with no automatic reviewer or role change.

Imported folders are copied to `<project>/work`; originals stay unchanged. Review results there before copying changes back. Import skips Git metadata, dependency/environment caches, and links. Existing REQUEST.md is archived outside the new workspace. Generic workflows preserve other existing project documents, including AGENTS.md.

Stop the active original Conductor session before testing another local-model run. The launcher retains its one-session mutex to avoid competing requests. Use a provider API reachable from this PC. A server's localhost Ollama address is not this PC's localhost address; use a reachable LAN endpoint or an existing SSH forward.

## Save your own workflow

Choose **T**, then New or Edit/duplicate. Change the ID to create a duplicate. The editor asks for:

1. Name and maximum role sessions, including retries.
2. Role IDs, names, responsibilities, access, input files, required output files, writable paths, and optional models.
3. Destinations: DONE for workers; APPROVE and REVISE for reviewers. All roles can report BLOCKED.
4. Starting role.

Paths are exact relative file paths. `*` under writable paths allows general product edits except REQUEST.md and artifacts owned by other roles. It is not a glob language. Each owned artifact has one owner, except the coding presets explicitly permit builder updates to BUILD_PLAN.md while retaining the original planner baseline. Read-only roles own no writable output files; the controller saves their final Markdown response.

For a second final review, add a read-only role, route the first review's APPROVE to it, and set APPROVE -> COMPLETE and REVISE -> your builder/writer. Invalid destinations, duplicate IDs, unreachable roles, unsafe paths, competing ownership, and unbounded budgets are rejected before saving. Every role must have a route to completion.

Choose **A** to create or edit reusable agent profiles: name, responsibilities, access, and optional model. One-shot runs select these profiles. Workflow roles carry their own editable profile fields. Overrides choose another model on the project's provider, not a different provider.

Personal definitions live in `%LOCALAPPDATA%\Nova-Conductor\library`. Set `NOVA_WORKFLOW_LIBRARY` to use another location. The file-path choice loads JSON definitions; saving validates them. Keep credentials out of prompts and templates. Templates contain no executable startup hooks. Verification commands remain an explicit project setting.

## Running and recovering

Each role starts a fresh 16K native Codex session. Project files and a concise handoff carry progress. Codex renders native tools, colors, and summaries exposed by the selected model/provider.

- Interrupt inside the native Codex window to pause; submit guidance to continue the same role.
- Use **4 Stop** in another menu, or Ctrl+C in the controller, to stop its worker. Closing only the viewer is not a stop command.
- **2 Continue** starts a fresh session for the stopped role.
- **7 Reopen** selects a role and adds guidance, including after completion. Prior runs are retained.
- Protected-file violations restore originals and archive attempted edits in `runs/<run>/rejected-edits`. Allowed product changes survive.
- Disconnects retry the same role with bounded backoff. Deadlines stop custom workflows for attention. The session budget prevents infinite loops.

Completion requires a valid agent outcome, required output files, and any configured checks. It does not guarantee a model's work or review is correct. One-shot deliberately has no independent reviewer. Generic checklists are saved in `runs/<run>/handoff.md` and supplied to the next role; the original coding preset retains REVIEW.md and BUILD_CHECKLIST.md.

The project's frozen definition lives in workflow.json and state.json. Later library edits affect new projects only.

## CLI

```powershell
node src/conductor.mjs templates
node src/conductor.mjs agents
node src/conductor.mjs show-template writing
node src/conductor.mjs save-template .\my-workflow.json
node src/conductor.mjs save-agent .\my-agent.json
node src/conductor.mjs workflow-init C:\Projects\story writing .\request.txt gpt-oss:20b
node src/conductor.mjs one-shot C:\Projects\change general .\request.txt gpt-oss:20b C:\Source\my-app
node src/conductor.mjs run C:\Projects\change
node src/conductor.mjs stop C:\Projects\change
node src/conductor.mjs reopen C:\Projects\change GENERAL .\feedback.txt
```

The destination project folder must not exist. Template/agent arguments accept built-in keys or saved JSON paths.

## Verification scope

Controller tests cover coding compatibility, custom revision loops, boundaries, restoration, required outputs, model overrides, frozen definitions, one-shot import, disconnects, pause/steering, stop, reopen, failed checks, and cleanup after storage errors. PowerShell tests exercise guided creation and duplication.

Native integration tests run the real Codex executable, execute apply_patch, and inspect resulting files through the bundled proxy. They cover normal/Gemma repair paths and a writing workflow followed immediately by one-shot. Provider responses are deterministic test data, not live Ollama inference. Trial logs remain in TEMP; disposable sandbox executable copies are removed.

```powershell
npm test
$env:CONDUCTOR_NATIVE_TEST='1'
node --test --test-concurrency=1 test/native-provider.test.mjs test/native-gemma.test.mjs test/native-workflows.test.mjs
```

The original desktop install and parent v0.3.4 release remain the rollback baseline.
