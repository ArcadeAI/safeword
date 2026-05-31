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

## Mapping (verified against hooks doc 2026-05-31)

- `SessionStart` → bootstrap / context + state (inject, non-blocking).
- `UserPromptSubmit` → per-turn phase reminder **and the done/phase hard gate** — `decision:"block"` blocks the prompt; refuse the next turn until `verify.md` / phase precondition is met.
- `PreToolUse` → edit/phase gate — `permissionDecision:"deny"` (or exit 2) blocks the edit/command before it runs.
- `PostToolUse` → LOC gate signal — `decision:"block"` stops result handling (side effect already happened; can't undo).
- `Stop` → done-gate **nudge only**. Correction: Codex `Stop` `decision:"block"` does NOT prevent stopping — it auto-creates a continuation prompt. Same as Cursor, unlike Claude Code's hard Stop block. So the real done-gate enforcement lives at `UserPromptSubmit`, with `Stop` used to nudge continuation.

Divergence from Claude Code (8R54HV): CC enforces the done gate at `Stop` (hard block, capped at 8 — ticket EKNEW0). Codex/Cursor can't hard-block at stop, so the gate moves upstream to the prompt-submit event. Design the shared gate logic with this seam.

## Done when

- Design doc in the ticket folder: each safeword gate → Codex event + signal + reuse-vs-divergence note from epic 8R54HV.

## Source

developers.openai.com/codex/hooks, /config-advanced

## Work Log

- 2026-05-31 Created from Codex research.
