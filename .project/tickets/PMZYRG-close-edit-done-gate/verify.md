# Verification evidence

Verified: 2026-10-07 at merge-ready head (origin/main merged at ecf4cb27d).

## Verify Checklist

**Test Suite:** ✓ 10503/10503 tests pass (14 skipped) across 612 CLI files; relay 198 pass / 1 skip; collector 153/153.
**Gherkin:** ✅ Acceptance lane passes — 596 scenarios, 11,118 steps; BDD proof 47/47.
**Build:** ✅ Success — authoritative build plan (CLI, plugins, relay/collector, website).
**Lint:** ✅ Clean — changed-file ESLint and Prettier via pre-commit on every commit.
**Typecheck:** ✅ Clean — `tsc --noEmit` for relay, collector, CLI and `astro check` (0 errors).
**Scenarios:** ⏭️ Skipped — task with inline regression tests; no feature scenario ledger.
**Refactor:** ✅ Completed — 1bd735736 (shared `runDoneGate`), 34b77b2d1 (shared `DONE_GATED_TICKET_TYPES`), b2abb5de9 (close detection extracted to `hooks/lib/ticket-close.ts`).
**PR Scope:** ✅ Diff matches ticket scope: PostToolUse close detection and owed-gate record, Stop owed-gate resolution and settlement, `quality-state` field, schema entry for the new lib, unit and integration tests, generated carriers, and this ticket.
**Dep Drift:** ✅ Clean — no dependency or lockfile changes.
**Parent Epic:** N/A
**Reconcile:** ✅ No pattern deviation — reuses session quality state, `resolveStopPhase` types, and the existing `runDoneGate` harness.
**Experience:** ✅ No new friction — Walked a Safeword user through closing a task ticket by edit; worst step = the Stop now blocks on failing tests (the intended gate); new steps vs before = 0 when evidence is green.
**Surface Evidence:** ✅ 1/1 affected surface (Claude hooks via installed `.safeword/hooks`) proven by `close-edit-done-gate.test.ts` driving real PostToolUse (Edit, MultiEdit, Write) and Stop.
**Evidence limits:** ⚠️ The dependency-audit lane exits non-zero on pre-existing advisories (8 JS: 2 high, 3 moderate, 3 low; 6 for Python urllib3 2.7.0), the same baseline recorded on K536NC; this change adds no dependencies. Codex Stop without `session_id` is out of scope (follow-up filed).

## Red-first proof

- `close-edit-done-gate.test.ts` failed on origin/main 485d8ac77: Stop allowed a close-by-edit with failing tests.
- Each review-driven case was confirmed red against the earlier commit it fixes; the MultiEdit case was confirmed by mutation (restoring the old shortcut fails it).
- Owed until every check passes: `keeps the gate owed through failed Stops until every check passes` closes a ticket, then Stops block twice on failing tests, block on missing verify.md once tests pass (tests still run), allow once evidence is restored, and do not rerun afterwards (test-run counter 2 → 3 → 4 → 4). Mutation that drops the owed entry when Stop first reads it fails this test (`expected '' to contain 'Tests failed'`). Integration file: 19/19 pass.

## Review

- `/tdd-review` twice; `/refactor` (3 committed steps); `/quality-review` cross-agent (Codex) 10 passes, final pass approved with no findings.
- CI 13/13 on b2abb5de9.
