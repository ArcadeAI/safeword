---
id: KHYXY4
slug: retro-cursor-trigger
type: feature
phase: implement
status: in_progress
parent: RV9JT4-retro-transcript-mining
depends_on: [FTCQGD]
scope: |
  Add a retro path to the existing `cursor/stop.ts` adapter, reusing the shared
  retro core FTCQGD/53DQJZ shipped. Per the figure-it-out (2026-06-28, OFFICIAL
  current Cursor docs): EVERY Cursor hook — including `stop` — carries a base
  `transcript_path` field pointing at the main conversation transcript (JSONL with
  `message.content[].tool_use` blocks — the SAME shape as Claude). The repo's
  current `cursor/stop.ts` interface is STALE (omits transcript_path). So: (1)
  reuse the Claude `countToolUses` (Cursor's transcript is Claude-shaped — confirm
  by a live spike); (2) resolve the Cursor session id from `conversation_id`
  (session-stable); (3) read transcript_path → decideRetroNudge → emit the retro
  nudge as Cursor's `followup_message` (auto-submits — the strongest channel).
  Must coexist with cursor/stop.ts's existing quality-review followup + the
  5-auto-submission cap (retro yields to quality-review on a given stop; the
  once-per-session sentinel ensures retro still fires once).
out_of_scope: |
  - The shared sentinel/substance-gate/orchestration core (FTCQGD owns it).
  - Claude + Codex adapters (FTCQGD, 53DQJZ).
  - SQLite chat-store mining — MOOT: transcript_path is hook-provided (docs).
  - A new Cursor-specific tool-use counter — likely unneeded (Claude-shaped);
    add one only if the live spike shows the shape differs.
done_when: |
  A substantial Cursor session fires retro once via `followup_message` pointing at
  the retro guide, counting tool_use from the hook-provided transcript_path, with
  the same idempotency + fail-open guarantees as Claude — without breaking the
  existing quality-review followup or the 5-submission cap.
created: 2026-06-28T05:34:06.358Z
last_modified: 2026-06-28T19:10:00.000Z
---

# Fire retro from Cursor stop hook

**Goal:** Make retro fire autonomously at the end of real Cursor sessions, the
same way it does under Claude Code (FTCQGD) and Codex (53DQJZ).

**Riskiest unknown (narrowed by figure-it-out):** the official docs confirm the
stop hook carries `transcript_path`, and the transcript is documented as JSONL
with `message.content[].tool_use` blocks (Claude-shaped), so the Claude counter
should apply unchanged. Residual: confirm the exact shape + that transcript_path
is non-empty at `stop` time, via a dump-payload spike in a real Cursor session.
Second risk: composing the retro `followup_message` with the existing
quality-review followup under the 5-submission cap.

**See:** [spec.md](./spec.md) for personas, jobs-to-be-done, and outcomes.

## Work Log

- 2026-06-28T05:34:06.358Z Started: Created ticket KHYXY4
- 2026-06-28T05:34Z Stubbed: blocked on FTCQGD (shared core).
- 2026-06-28T19:10Z Unblocked + CORRECTED. Official Cursor hooks docs disprove the
  "no transcript" premise: every hook (incl. stop) carries `transcript_path` to a
  Claude-shaped JSONL transcript. Dropped the SQLite-mining scope. Resolved:
  reuse Claude `countToolUses`, resolve session id from conversation_id, emit
  `followup_message`. Entering define-behavior.
- 2026-06-28T19:11Z Complete: scenario-gate - independent fork review caught 3
  blockers (vacuous coexistence, unexercised counter, unproven id resolution); all
  fixed. Re-review PASS. 13 scenarios/5 rules. impl-plan written. Stamped.
- 2026-06-28T19:20Z Implement: resolveCursorSessionId (conversation_id) +
  conversation_id on RetroTriggerInput; reused Claude countToolUses (Cursor
  transcript is Claude-shaped, characterization-pinned). Added the retro path to
  cursor/stop.ts on the non-quality-review branch (yields to quality-review,
  sentinel untouched). 4 unit + 6 integration tests; fixed a brittle exact-import
  assertion in cursor-stop-review.test.ts. 51 cursor/retro tests green, typecheck
  + lint clean.
