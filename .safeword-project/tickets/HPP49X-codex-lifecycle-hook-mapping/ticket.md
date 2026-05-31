---
id: HPP49X
slug: codex-lifecycle-hook-mapping
type: task
phase: intake
status: in_progress
epic: codex-changelog-alignment
relates_to: QM5G9M
---

# Map safeword lifecycle events to Codex hook events (design)

**Goal:** Design doc mapping safeword's five gate moments onto Codex hook events.

**Why:** Before generating config we need the event→gate contract, reusing Claude Code's logic where Codex matches.

## Mapping (to validate)

- `SessionStart` → bootstrap / context + state.
- `UserPromptSubmit` → per-turn phase reminder.
- `PreToolUse` → phase gate + edit gate (deny).
- `PostToolUse` / `Stop` → LOC gate.
- `Stop` → done gate (Codex `Stop` *can* block via `decision:"block"`, unlike Cursor — confirm).

## Done when

- Design doc in the ticket folder: each safeword gate → Codex event + signal + reuse-vs-divergence note from epic 8R54HV.

## Source

developers.openai.com/codex/hooks, /config-advanced

## Work Log

- 2026-05-31 Created from Codex research.
