# Conductor Studio

Double-click **Start Conductor UI.cmd**. Requires Node 22+, Git, and Codex CLI on PATH, just like the CLI. No UI dependencies or downloads are needed. The launcher opens an Edge app window (or your default browser) backed by a loopback-only server at http://127.0.0.1:18181.

## Build your team

- Drag saved agents from the inspector onto the canvas, or use + to add them.
- Drag node headers to arrange the workflow. Connect an output dot to an input dot by dragging or clicking each dot. Click a cable then Disconnect to remove a route.
- Edit instructions, model overrides, file access, inputs, outputs, and the starting role in the inspector. Apply changes, Check flow, then Save copy.
- Pan the background, use Fit or zoom buttons, and choose reusable templates from the dropdown.
- Agent library creates reusable profiles; One-shot runs one profile on your prompt.

The office shows the selected project's real role and status. An idle draft is explicitly a preview. Roles execute sequentially, each in a fresh context; the office is a visual representation, not parallel execution. Revision cables route work back for another pass within the saved run limit.

## Run and guide work

Run workflow creates a project from your prompt and a frozen workflow snapshot. Optionally select an existing code folder: Conductor copies it into a separate workspace. Model overrides on individual roles take precedence over the project model.

Starting or continuing a workflow or one-shot automatically opens the native Codex terminal alongside Studio. The same viewer follows fresh role sessions as the workflow advances.

Projects offers Continue, Pause, guidance while paused, Stop, Reopen at a role, Files, and Native Codex. Public completed agent messages, tool results, and file changes appear in activity; Native Codex opens the existing terminal viewer for its full supported presentation. The web UI does not duplicate token-by-token terminal output or private reasoning.

Provider settings are global and shared with the CLI. Projects do not silently select another provider. API keys entered in the UI are transient and passed only to the launched process. Saved settings contain the key environment-variable name, not its value.

Closing the browser window leaves runs available to reconnect. To stop a worker, use **Stop** and wait for its status to settle. Use **Quit Conductor** to close the UI server; it refuses while a UI-owned run remains active. Existing CLI runs remain independently managed.

## Verification

The main suite passed 56 tests. All three opt-in native Codex tests passed using simulated provider responses, including proxy patch compatibility and workflow/one-shot execution. Playwright exercised node movement, connection validation, saved workflows and agents, project creation, pause, steering, reopen, global settings, and mobile layout using an isolated controller fixture. No live model quality or completion claim is implied.

Run `npm test`. For native checks set `CONDUCTOR_NATIVE_TEST=1` and run `node --test --test-concurrency=1 test/native-provider.test.mjs test/native-gemma.test.mjs test/native-workflows.test.mjs`. For browser checks provide Playwright externally via `PLAYWRIGHT_MODULE` and run `node test/ui-browser.cjs`; Edge is the default browser, overridable with `BROWSER_EXE`.
