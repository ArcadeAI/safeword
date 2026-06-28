---
id: 53DQJZ
slug: retro-codex-trigger
type: feature
phase: intake
status: blocked
parent: RV9JT4-retro-transcript-mining
depends_on: [FTCQGD]
blocked_on: [FTCQGD]
scope: |
  Wire Codex's `Stop` hook (new in Codex 2026 — repo currently wires only
  SessionStart/UserPromptSubmit/PreToolUse) to the shared retro auto-trigger
  core (sentinel + substance gate) that FTCQGD factors into lib/. Add a
  `codex/stop.ts` adapter + `config.toml` `[[hooks.Stop]]` entry, and LOCATE +
  PARSE the Codex session transcript so the fresh-context extraction can run.
out_of_scope: |
  - The shared sentinel/substance-gate core (FTCQGD owns it).
  - Claude + Cursor adapters (FTCQGD, KHYXY4).
done_when: |
  A substantial Codex session fires retro once via the Codex Stop hook, mining
  the Codex transcript, with the same idempotency guarantees as the Claude path.
created: 2026-06-28T05:34:06.303Z
last_modified: 2026-06-28T05:34:06.303Z
---

# Fire retro from Codex Stop hook (transcript substrate)

**Goal:** Make retro fire autonomously at the end of real Codex sessions, the
same way it does under Claude Code (FTCQGD).

**Riskiest unknown:** what the Codex `Stop` hook hands the adapter (a transcript
path? a session id?) and the exact rollout-JSONL shape — both UNVERIFIED. Cheapest
test: register a no-op `codex/stop.ts` that dumps its stdin payload in a real
Codex session and inspect it before designing the parser.

**See:** [spec.md](./spec.md) for personas, jobs-to-be-done, and outcomes.

## Work Log

- 2026-06-28T05:34:06.303Z Started: Created ticket 53DQJZ
- 2026-06-28T05:34Z Stubbed: blocked on FTCQGD (shared core). Codex Stop hook
  exists as of 2026; transcript payload/shape is the unverified risk.
