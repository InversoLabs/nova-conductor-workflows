# Reusable workflows — development direction

Status: implemented in v0.4.0-preview.1. Reusable workflows, agent profiles, one-shot execution, generic routing, and the guided CLI editor are available. The original coding engine remains a compatibility preset. See WORKFLOWS.md for usage and verification scope. The milestones below describe the implementation sequence; live-model quality testing remains a user trial.

## Product

Nova Conductor runs a saved sequence of specialist roles over a shared project. A template defines the roles and handoffs; the engine provides fresh Codex sessions, tool execution, model/provider selection, recovery, and the native terminal experience.

The existing **Code project builder** is the first built-in template. A second example is **Writing studio**: Producer → Writer → Editor, with Editor returning either approval or a concrete revision checklist for Writer. The framework must not assume every deliverable is code or require software tests for prose.

## Template editor

Start with a CLI option to choose, duplicate, create, edit, validate, and save templates. Editing a built-in template creates a personal copy. A simple guided editor is enough initially; a visual canvas can follow a proven execution model.

Each template contains a stable ID, schema version, display name, purpose, starting role, roles, transition rules, and bounded run limits. Each role contains:

- A stable ID and editable display name, such as Producer or Editor.
- A concise responsibility prompt; the exact user request is always included separately.
- Input artifacts and required output artifacts, using relative workspace paths.
- Access mode: read-only review or workspace editing, plus explicit artifact ownership.
- Optional model override; otherwise inherit the project model.
- Handoff type: finish the step, request revisions, approve, or report a blocker.

Templates are data, not executable scripts. No arbitrary JavaScript, shell hooks, credentials, or absolute machine paths. Existing project verification commands remain an explicit project setting rather than silently executing commands from an imported template.

## Predictable routing

The engine decides the next role from validated outcomes. A model does not invent roles or choose arbitrary destinations. Every review has explicit approval, revision, and blocked routes; every revision route points to a defined role. Validation rejects duplicate IDs, missing destinations, unreachable roles, missing terminal routes, unsafe artifact paths, and unbounded loops.

An approval is accepted only when the required artifact and evidence checks pass. A revision names the unmet requirements and ordered corrective actions. Infrastructure failures remain separate from project feedback. Disconnect retries retain the same role and entry mode. Each role change starts a fresh session with the existing 16K default.

The runtime records the template version, current role, entry reason, outcomes, and retries. It copies the template into each project at creation so later template edits cannot alter an in-progress run. Continue, stop, manual steering, and reopen-at-role must work for all templates.

## Artifact ownership

The user request is immutable. Requirements/briefs are written by their designated planning role; implementers write deliverables and progress notes; reviewers return evidence and repair instructions. The engine saves review artifacts. Templates must not give competing ownership to these documents.

Protect originals before starting a role and check writes before advancing. Protected-file restoration is implemented: the controller archives attempted edits, restores trusted originals, preserves allowed deliverable work, and stops for guidance with a consistent snapshot. Reopen can then resume the project.

One-shot mode selects or creates one reusable agent and runs it on an empty project or imported codebase. DONE completes the run; BLOCKED stops for attention. It adds no planner or reviewer. Disconnect recovery stays on the same role with fresh context. A second final review in a custom workflow is another read-only role on the approval route.

## Small implementation milestones

1. Add a versioned template schema, validator, and two example templates. Keep the current runner as the default path.
2. Make prompt assembly consume the selected template, while verifying Code project builder produces equivalent roles and file boundaries.
3. Generalize routing and persisted state; prove initial build, revision, approval, pause, disconnect recovery, and reopen behavior with deterministic fake workers.
4. Add the guided CLI template editor and project template selection. Import existing codebases continues to work with the coding template.
5. Trial the writing template in an isolated project, then run small live coding and writing checks. Keep the desktop coding installation on the baseline until the new runner is verified.

Avoid plugin systems, parallel agent scheduling, arbitrary workflow code, and a visual editor in the first iteration. The first useful release is a reliable sequential workflow with an explicit review/revision loop.

## Baseline and rollback

Parent: https://github.com/InversoLabs/nova-conductor

Baseline: v0.3.4, commit 7d134fa. The new repository retains its history and has an `upstream` remote pointing to the parent. It is a separate development repository rather than a GitHub fork-network entry. The owner's existing desktop shortcut continues to run the installed coding version.
