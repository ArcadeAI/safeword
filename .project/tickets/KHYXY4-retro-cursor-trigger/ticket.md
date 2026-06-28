---
id: KHYXY4
slug: retro-cursor-trigger
type: feature
phase: intake
status: blocked
parent: RV9JT4-retro-transcript-mining
depends_on: [FTCQGD]
blocked_on: [FTCQGD]
scope: |
  Wire the existing `cursor/stop.ts` adapter to the shared retro auto-trigger
  core (sentinel + substance gate) that FTCQGD factors into lib/. Use Cursor's
  `followup_message` (which auto-submits a new turn — the strongest nudge of the
  three) to run the retro pipeline, and LOCATE + PARSE Cursor's chat store, since
  the stop hook gives `conversation_id`/`generation_id`, NOT a transcript path.
  Must coexist with cursor/stop.ts's existing quality-review followup + the
  5-auto-submission cap.
out_of_scope: |
  - The shared sentinel/substance-gate core (FTCQGD owns it).
  - Claude + Codex adapters (FTCQGD, 53DQJZ).
done_when: |
  A substantial Cursor session fires retro once via followup_message, mining the
  Cursor chat store, with the same idempotency guarantees as the Claude path,
  without breaking the existing quality-review followup or the submission cap.
created: 2026-06-28T05:34:06.358Z
last_modified: 2026-06-28T05:34:06.358Z
---

# Fire retro from Cursor stop hook (transcript substrate)

**Goal:** Make retro fire autonomously at the end of real Cursor sessions, the
same way it does under Claude Code (FTCQGD).

**Riskiest unknown:** Cursor's stop hook exposes `conversation_id`/`generation_id`,
not a transcript file — locating and parsing Cursor's chat store is UNVERIFIED.
Cheapest test: dump the stop-hook stdin payload + probe Cursor's on-disk chat
storage in a real session before designing the parser. Second risk: composing a
retro followup with the existing quality-review followup under the 5-submission cap.

**See:** [spec.md](./spec.md) for personas, jobs-to-be-done, and outcomes.

## Work Log

- 2026-06-28T05:34:06.358Z Started: Created ticket KHYXY4
- 2026-06-28T05:34Z Stubbed: blocked on FTCQGD (shared core). Trigger channel
  (followup_message) is known; the Cursor chat-store transcript is the unknown.
