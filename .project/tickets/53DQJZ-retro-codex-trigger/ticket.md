---
id: 53DQJZ
slug: retro-codex-trigger
type: feature
phase: done
status: done
parent: RV9JT4-retro-transcript-mining
depends_on: [FTCQGD]
scope: |
  Wire Codex's experimental `Stop` hook to the shared retro auto-trigger core
  FTCQGD shipped. Per the figure-it-out (2026-06-28, current evidence): the Codex
  Stop payload carries `transcript_path` DIRECTLY (turn-scoped events: session_id,
  turn_id, transcript_path, cwd, model, last_assistant_message), so no rollout-dir
  hunting. Three pieces: (1) refactor the shared core so `countToolUses` is a
  per-agent strategy (Claude variant unchanged); (2) add `countToolUsesCodex` for
  the Codex rollout shape (`{type,payload}` JSONL; count function_call /
  exec_command_begin / mcp_tool_call_begin); (3) a `codex/stop.ts` adapter +
  `config.toml` `[[hooks.Stop]]` entry that reuses resolveSessionId
  (turn_id/CODEX_THREAD_ID/session_id, already in run-identity.ts) + the sentinel,
  and emits Codex's `{decision:"block", reason:<guide pointer>}` continuation
  (NOT additionalContext).
out_of_scope: |
  - The Claude adapter + sentinel/resolver core internals (FTCQGD owns them; this
    only refactors the counter seam, preserving Claude behavior).
  - Cursor adapter (KHYXY4).
  - Empirical live-Codex confirmation of transcript_path fidelity — built against
    rollout fixtures; the dump-payload spike validates in a real Codex run.
done_when: |
  A substantial Codex session fires retro once via the Codex Stop hook
  ({decision:block} continuation pointing at the guide), counting Codex tool
  events from the payload's transcript_path, with the same idempotency + fail-open
  guarantees as the Claude path — and the existing FTCQGD Claude tests stay green
  (the counter refactor is behavior-preserving for Claude).
created: 2026-06-28T05:34:06.303Z
last_modified: 2026-06-28T16:34:00.000Z
---

# Fire retro from Codex Stop hook (transcript substrate)

**Goal:** Make retro fire autonomously at the end of real Codex sessions, the
same way it does under Claude Code (FTCQGD).

**Riskiest unknown (narrowed by figure-it-out):** the Stop payload's
`transcript_path` exists and is canonical, but its file is the Codex-native
rollout (`{type,payload}` event JSONL), NOT Claude's `message.content[].tool_use`
shape — so Claude's `countToolUses` would count 0. Residual empirical unknown:
does `transcript_path` point at a non-empty raw rollout AT STOP TIME (vs an
empty/rotated/normalized file)? Cheapest test: a throwaway `codex/stop.ts` that
dumps its stdin payload + `head` of `transcript_path` in a real Codex session,
before trusting the parser in production.

**See:** [spec.md](./spec.md) for personas, jobs-to-be-done, and outcomes.

## Work Log

- 2026-06-28T05:34:06.303Z Started: Created ticket 53DQJZ
- 2026-06-28T05:34Z Stubbed: blocked on FTCQGD (shared core).
- 2026-06-28T16:34Z Unblocked (FTCQGD done). figure-it-out (current evidence)
  resolved: source via Stop payload `transcript_path` (option a); Codex rollout
  shape ≠ Claude → factor `countToolUses` to a per-agent strategy + add
  `countToolUsesCodex`; reuse resolveSessionId + sentinel; emit {decision:block}.
  Locked scope; entering define-behavior.
- 2026-06-28T16:40Z Complete: define-behavior + scenario-gate. 11 scenarios/6
  rules. Independent fork review caught 2 blockers (trivial-path vacuous vs
  fail-open; no end-to-end proof the Codex counter drives the fire) → added a
  below-threshold-count trivial scenario + a Claude-shaped-zero-events adversarial
  twin. Re-review PASS. impl-plan.md written (counter-seam refactor + adapter).
  Stamped. Entering implement.
- 2026-06-28T17:00Z Implement: outside-in TDD. countToolUsesCodex (Codex rollout
  shape, nesting-tolerant); factored isSubstantial + decideRetroNudge to inject a
  per-agent counter + resolver (Claude defaults — regression-proven by FTCQGD
  suite staying green); resolveCodexSessionId (session_id > CODEX_THREAD_ID, NOT
  turn_id). codex/stop.ts adapter emits {decision:block} or {} (valid JSON). Wired
  config.toml [[hooks.Stop]] (+ schema patch + unpatch) + schema.ts + mirrors.
  CORRECTION mid-impl: dropped turn_id as a session-id source (per-turn → would
  break idempotency); fixed the scenario. Excluded /codex/ from the SETTINGS_HOOKS
  drift test (Codex hooks wire via config.toml). 13 codex unit + 5 integration; 73
  targeted green; typecheck + lint + prettier clean.
