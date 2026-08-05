---
id: V8Z1NP
slug: stop-review-turn-boundary
type: task
phase: done
status: in_progress
created: 2026-08-05T15:06:34.162Z
last_modified: 2026-08-05T16:28:00Z
---

# Review the long turns that do the most work, instead of silently skipping them

**Goal:** Make the Stop quality review reach turns whose edits happened more than a few tool rounds before the reply — today those turns are skipped entirely.

**Why:** `detectEditToolsUsedInCurrentUserTurn` walks back looking for the turn's user prompt but stops after `MAX_MESSAGES_FOR_TOOLS` (5) assistant messages. Any turn with more tool rounds than that never finds its boundary, so the caller falls back to a turn-blind scan of the same short window — and an edit made earlier in the *same* turn is invisible. The Stop quality review is silently skipped on exactly the largest turns.

**Corrected diagnosis:** this ticket was opened expecting a false *positive* (review firing on turns that did no work, per #1431). Writing the test inverted it: the window bug is a false *negative*. The control case (edit inside the window) reviews correctly; push the edit out with 12 tool rounds and the hook exits silently. Recorded because the original hypothesis shipped into the ticket before the test ran.

**Scope:** `detectEditToolsUsedInCurrentUserTurn` only. The legacy `detectEditToolsUsed` fallback (reached only when no boundary is found within the new line budget) is unchanged.

## Work Log

- 2026-08-05T15:06:34.162Z Started: Created ticket V8Z1NP
- 2026-08-05T15:12:00Z RED: tests/integration/stop-review-long-turn.test.ts — control passes, long-turn case fails (hook silent despite an in-turn edit). Hypothesis inverted vs intake: false negative, not false positive.
- 2026-08-05T15:12:00Z GREEN: boundary walk bounded by transcript lines (MAX_LINES_FOR_TURN_BOUNDARY = 400) instead of assistant-message count. 47/47 in the new file; 209/209 across six stop-hook suites. Template + .safeword mirror kept byte-identical.
- 2026-08-05T15:35:00Z CI (run 31019532494, head cf4dcd9e): lint pass, Dogfood parity pass, vitest 6572 passed / 4 skipped / 0 failed (434 files). Acceptance lane 957/959 — the 2 failures are `test-codex-plugin-migration.feature:103` and `:112`, which fail identically on main at base `fba74ddd3` (run 30984010293). Inherited red, filed as #1964.
- 2026-08-05T15:35:00Z Third mirror caught by CI, not by `parity:fix`: the generated `plugin/runtime/hooks/stop-quality.ts` (+ inventory/identity hashes) needs `bun run --cwd packages/cli generate:claude-plugin`. `parity:fix` reporting "all 8 contracts in sync" does not cover it.
- 2026-08-05T16:20:00Z /audit (diff scope, base fba74ddd3): 0 errors, 0 warnings. Self-applied two audit findings on the new test file — weak assertion (`not.toBe('')`) replaced with decision/reason assertions, and two silent-path cases added for negative coverage. Mutation-checked: forcing the detector to `return true` fails exactly those two.
- 2026-08-05T16:20:00Z /verify: 6571/6571 vitest, build ✅, lint ✅, dep drift clean, PR scope clean. Acceptance lane 954/959 — 2 failures inherited from main (#1964), not this change. verify.md written. Phase → done.
- 2026-08-05T16:35:00Z Phase held at verify (not done): `test:done` cannot run — the machine-global build lock is held by PID 84779 from the main checkout (/Users/alex/Projects/safeword), so the gate's run is SIGTERM'd while queued. Signal-terminated with zero assertions is contention, NOT a failure; the same tests passed 6571/6571 minutes earlier. Holding at verify so each Stop stops spawning another contending run. Flip to done once test:done completes green.
- 2026-08-05T16:28:00Z test:done GREEN once the lock freed: 1468/1468 tests, 87 files, 164s. Confirms the earlier SIGTERMs were queue contention, not failures. Phase -> done. Status stays in_progress until merge.
