---
id: FTCQGD
slug: retro-auto-trigger
type: feature
phase: done
status: done
parent: RV9JT4-retro-transcript-mining
scope: |
  CLAUDE-FIRST. A `stop-retro.ts` Claude Code Stop hook that, at most once per
  session, surfaces a fact-phrased nudge directing the agent to run the retro
  pipeline (fresh-context extraction → `safeword retro`) WHILE the session is
  alive. Stop-anchored (NOT SessionEnd): fires early once the session has
  substance, idempotent across re-fires via the existing occurrence ledger.
  One mechanism for cloud and local. Reads transcript_path from the Stop hook
  input (the JSONL shape RV9JT4 already parses). The once-per-session sentinel +
  substance gate live in shared lib/ so the Codex (53DQJZ) and Cursor (KHYXY4)
  adapters can reuse the same core. Composes with the sibling Stop hooks
  (stop-quality, stop-reentry, stop-self-report) as an independent
  additionalContext emitter.
out_of_scope: |
  - The retro pipeline itself (shipped in RV9JT4).
  - Codex Stop wiring + Codex transcript substrate → follow-on 53DQJZ.
  - Cursor stop (followup_message) wiring + Cursor transcript substrate → KHYXY4.
  - Headless `claude -p` shellout (rejected: no clean cross-agent story).
  - Robust signature-marker dedup (1FGE1C) and extraction-quality eval (7ZCKS6).
  - Guessing the transcript path: it comes from the Stop hook input
    (transcript_path), so no homedir/env guessing is needed.
done_when: |
  The Claude Stop hook fires retro at-least-once per substantial session while
  the container is alive; never more than once per session (sentinel); the ledger
  absorbs re-fires across sessions with zero duplicate issues; trivial sessions
  (below the substance gate) stay silent; behaves identically in cloud and local;
  the sentinel + substance gate are factored into lib/ for 53DQJZ/KHYXY4 reuse.
created: 2026-06-28T05:22:47.414Z
last_modified: 2026-06-28T05:22:47.414Z
---

# Auto-fire retro at session-stop (cloud-safe, idempotent)

**Goal:** Make `safeword retro` fire on its own at the end of real sessions —
reliably in ephemeral cloud containers — without a human remembering to run it,
and without ever double-filing.

**See:** [spec.md](./spec.md) for personas, jobs-to-be-done, and outcomes.

## Resolved questions (intake)

1. **Trigger = nudge, NOT headless shellout.** RESOLVED by the cross-agent
   evidence: every target agent exposes a turn-end hook that injects back into
   the loop (Claude `additionalContext`, Codex `Stop` context, Cursor
   `followup_message`), so the nudge is the one portable mechanism. A headless
   shellout would be three divergent nested CLIs (`claude -p`, `codex exec`,
   Cursor headless) with three sandbox constraints — no clean cross-agent story.
2. **Substance gate = turn/tool-count, NOT spool-friction.** Gating on the spool
   would only retro sessions the deterministic signals already caught — but retro
   exists to catch the QUALITATIVE friction the spool can't see. Gate on "session
   has substance" (N tool-calls/turns); the ledger dedupes re-fires.
3. **One mechanism, Stop-anchored everywhere.** A cloud/local split buys a
   marginally cheaper local end-of-session fire for two code paths + two test
   matrices; the ledger makes early-firing harmless, so there is no payoff.

## Cross-agent design (the trigger is portable; the transcript is not)

The Stop/turn-end hook is portable across all three agents as of June 2026. The
TRANSCRIPT each hook hands you is NOT uniform, and that is the real per-agent
cost:

| Agent  | Hook   | Inject channel              | Transcript payload                  | Slice   |
| ------ | ------ | --------------------------- | ----------------------------------- | ------- |
| Claude | Stop   | additionalContext (passive) | transcript_path → JSONL (parsed ✓)  | FTCQGD  |
| Codex  | Stop   | hook context output         | rollout JSONL — shape UNVERIFIED    | 53DQJZ  |
| Cursor | stop   | followup_message (auto-submit) | conversation_id, NOT a file path | KHYXY4  |

Reliability gradient: Cursor's `followup_message` auto-submits a new turn (the
nudge's weak link — agent ignoring a passive fact — is mitigated there); Claude's
additionalContext is the softest. Shared sentinel + substance gate go in lib/ so
all three adapters wrap one core.

## Work Log

- 2026-06-28T05:22:47.414Z Started: Created ticket FTCQGD
- 2026-06-28T05:23Z Intake: parented to RV9JT4; drafted proposed scope + 3 open
  questions from the cloud-firing figure-it-out.
- 2026-06-28T05:33Z Converged: locked scope CLAUDE-FIRST. Resolved Q1=nudge
  (cross-agent portability), Q2=substance-gate, Q3=one-mechanism. Recorded
  cross-agent design. Stubbed follow-ons 53DQJZ (Codex) + KHYXY4 (Cursor).
- 2026-06-28T05:37Z Complete: define-behavior - 11 scenarios across 6 rules
  (spec.md personas/JTBD/ACs + dimensions.md + retro-auto-trigger.feature).
- 2026-06-28T05:43Z Complete: scenario-gate - independent fork review caught 3
  vacuous silent-Then blockers (trivial-path, precedence ladder, fail-open);
  rewrote as contrast/precedence/fail-open outlines + added session-id-keying
  scenario. Re-review PASS. 9 scenarios/7 rules. impl-plan.md written. Stamped.
- 2026-06-28T15:00Z Implement: outside-in TDD per impl-plan build order. Shared
  core lib/retro-trigger.ts (countToolUses/isSubstantial, resolveSessionId
  precedence, sentinel, buildRetroNudge, decideRetroNudge) — 24 unit tests.
  stop-retro.ts Claude adapter + integration test (5) spawning the real hook.
  Registered: schema.ts (lib + hook), config.ts Stop entry, .claude/settings.json,
  .safeword byte mirrors. Typecheck + eslint + prettier clean; 60 targeted green.
