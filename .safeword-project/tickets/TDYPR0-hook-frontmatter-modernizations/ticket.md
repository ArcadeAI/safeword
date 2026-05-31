---
id: TDYPR0
slug: hook-frontmatter-modernizations
type: task
phase: intake
status: in_progress
epic: cc-changelog-alignment
relates_to: 8R54HV
created: 2026-05-31T21:05:09.536Z
last_modified: 2026-05-31T21:05:09.536Z
---

# Adopt sessionTitle, args exec form, updatedToolOutput, plugin validate fields

**Goal:** Pick up four small, low-risk CC hook/plugin primitives that improve safeword's ergonomics and robustness.

**Why:** Each is a cheap, independent quality-of-life win surfaced in the Mar–May changelog. Bundled into one ticket because none justifies its own; split out only if one grows.

## Candidate changes

1. **`sessionTitle` (CC 2.1.152)** — "SessionStart hooks set session title via `hookSpecificOutput.sessionTitle`." Safeword knows the active ticket at session start (`session-start-reentry.ts` already emits `hookSpecificOutput`). Set the session title to the active ticket id/slug so the agent dashboard (`claude agents`) is legible. Evidence: `.safeword/hooks/session-start-reentry.ts:86`.

2. **Hook `args: string[]` exec form (CC 2.1.139)** — "Hook `args` exec form (direct spawn, no shell)." Today every hook is a shell string `bun "$CLAUDE_PROJECT_DIR"/.safeword/hooks/x.ts` in `.claude/settings.json`. The exec form spawns directly (no shell parsing, fewer quoting pitfalls, marginally faster). Evaluate converting the generated settings to `args` form. Verify `$CLAUDE_PROJECT_DIR` expansion still works in exec form.

3. **`updatedToolOutput` (CC 2.1.121)** — "PostToolUse `hookSpecificOutput.updatedToolOutput` for all tools." `post-tool-lint.ts:47` currently appends remaining lint errors via `additionalContext` (a separate context blob). Rewriting the tool's own output inline may read more naturally to the agent. Evaluate the swap; keep `additionalContext` if it's actually clearer.

4. **`claude plugin validate` accepts top-level `$schema`/`version`/`description` (CC 2.1.120)** — confirms our "no `version` in `plugin.json`" rule (CLAUDE.md) won't trip validation, and that marketplace.json stays the version source of truth. Mostly a verification + a note; add `$schema` to manifests if it improves tooling.

## Approach

- Treat each as an independent sub-change; verify each against current CC docs before wiring (esp. `args` expansion semantics and `updatedToolOutput` shape).
- Check ticket **107** (new-hook-events) for overlap before starting.

## Done when

- Each of the four is either adopted (with docs-confirmed shape) or explicitly declined with a one-line reason in the work log.
- Any settings/manifest changes reflected in both templates and dogfood copies (parity-check clean).

## Out of scope

- `MessageDisplay` hook (CC 2.1.152) — no current safeword need; revisit separately if a use case appears.

## Work Log

- 2026-05-31T21:05:09.536Z Started: Created ticket TDYPR0
- 2026-05-31 Identified four low-risk adopts; post-tool-lint uses additionalContext (:47), reentry already emits hookSpecificOutput (:86).
