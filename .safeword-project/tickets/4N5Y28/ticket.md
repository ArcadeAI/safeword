---
id: 4N5Y28
slug: monotonic-novel-claim-state
type: task
phase: done
status: done
created: 2026-05-20T15:34:58.205Z
last_modified: 2026-05-20T15:34:58.205Z
---

# Replace novelResearchReminder boolean with monotonic per-file arrays

**Goal:** Replace the mutable `novelResearchReminder?: boolean` in `QualityState` with two append-only string arrays (`learningsNudgesPending`, `learningsNudgesAcknowledged`) so the novel-claim nudge has per-file fingerprints, monotonic state transitions, and the disqualification message can name which files triggered.

**Why:** The boolean was a textbook flag-footgun shape — overloaded across three consumers, destructive on transition (the consumer set it `false`, losing history), no fingerprint (couldn't tell which file armed it, couldn't dedup second edits of same file). The 2026 agent-state literature (ESAA event-sourcing paper, idempotent-agent patterns) names append-only per-fingerprint state as the canonical fix.

**Scope:**

- `QualityState` (template + consumer pair): remove `novelResearchReminder?: boolean`, add `learningsNudgesPending: string[]` and `learningsNudgesAcknowledged: string[]`.
- Setter (`post-tool-quality.ts`, pair): on a learnings/\*.md edit, append to `pending` only if file isn't already in `pending ∪ acknowledged` (per-fingerprint dedup).
- Consumer (`prompt-questions.ts`, pair): if `pending.length > 0`, inject the nudge (now naming the files), then `acknowledged.push(...pending); pending = [];` as a single atomic move.
- Enforcer (`quality.ts:getDisqualificationMessage`, pair): swap the `novelResearchReminderUnconsumed: boolean` option for `pendingLearningsNudges?: string[]`; surface filenames in the message text.
- Caller (`stop-quality.ts`, pair): pass the new array shape.
- Test (`quality.test.ts`): update the three test cases for the new option shape and new message substrings.

**Out of scope:**

- Promoting /quality-review to a true gate (still advisory).
- Migrating old session state files (they're per-session and short-lived; the optional-chaining defaults mean stale boolean state just stops nagging, which is the safer failure mode).
- Auditing other QualityState mutable flags for the same footgun shape (could be a follow-up).

**Done when:**

- `bun run lint:eslint` exit 0 from both repo root and `packages/cli/`.
- Targeted tests on `quality.test.ts` pass with the new options shape.
- Full vitest suite still 1884/1884 + 1 skipped.
- Template/consumer pair diff empty across all 5 file pairs.

## Work Log

- 2026-05-20T15:34:58.205Z Started: Created ticket 4N5Y28
