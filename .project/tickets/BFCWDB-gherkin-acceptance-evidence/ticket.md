---
id: BFCWDB
slug: gherkin-acceptance-evidence
type: task
phase: intake
status: in_progress
epic: bdd-phase-two-merge
depends_on: [1DT29X]
relates_to: [102a, 102b, 172]
created: 2026-06-13T23:32:20.625Z
last_modified: 2026-06-14T00:58:37Z
scope:
  - Teach `/verify` to run and report the Gherkin acceptance lane when `test:bdd` exists or runnable `.feature` files exist.
  - Teach the done gate's test runner to include `test:bdd` evidence, not only `test` / `test:done`.
  - Keep no-feature / no-runner projects from false-blocking; absence should produce an explicit skip reason, not a fake pass.
  - Update source templates and dogfooded installed copies for verify / done-gate guidance.
  - Add focused tests proving a failing Cucumber lane blocks completion and a passing lane is accepted.
out_of_scope:
  - Requiring `.feature` files for every historical feature ticket.
  - Implementing live/manual Codex smoke execution.
  - Replacing Vitest or the existing TDD ledger with Cucumber.
  - Refactoring the whole stop hook beyond the minimum needed for Cucumber evidence.
done_when:
  - `/verify` output includes a concrete Gherkin acceptance-lane result or an explicit skip reason.
  - A feature ticket with broken `.feature` scenarios cannot satisfy the done gate by passing `bun run test` alone.
  - Projects with no Cucumber lane still follow the existing test fallback behavior without spurious failures.
  - Template and dogfood copies stay aligned.
  - Focused hook/verify tests pass.
---

# Require Gherkin acceptance evidence before done

**Goal:** Make executable `.feature` scenarios part of safeword's completion evidence, not optional side-channel tests.

**Why:** After 1DT29X, `.feature` files are the behavior source of truth, but the current `/verify` and done-gate path can still close a ticket without proving the Cucumber lane runs.

## Evidence

- `templates/hooks/lib/test-runner.ts` only chooses `test:done` or `test`.
- `templates/hooks/stop-quality.ts` calls that runner at done and never calls `test:bdd`.
- `templates/skills/verify/SKILL.md` tells agents to run `bun run test` and `bun run build`, then counts scenario checkboxes in `test-definitions.md`.
- Ticket `172-phase-step-enforcement` names "close Verify without running scenarios" as a broad problem; this ticket is the concrete Gherkin acceptance-lane slice.

## Work Log

- 2026-06-13T23:32:20.625Z Started: Created ticket BFCWDB
- 2026-06-13 Scoped from Gherkin/Cucumber incompleteness audit: `.feature` is now source, but verify/done evidence still ignores the Cucumber runner.
- 2026-06-14T00:07:27Z Implemented: done-gate test runner now aggregates primary tests with `test:bdd` when present; `/verify` and done-gate guidance now report Gherkin acceptance evidence or `Skipped — no test:bdd script`; focused runner/doc tests, lint, typecheck, and package/root Cucumber lanes passed.
- 2026-06-14T00:37:58Z Quality-review follow-up: fixed verify wording from "all three patterns" to "required patterns" and strengthened the verify report test to include the Gherkin evidence line.
- 2026-06-14T00:58:37Z Refactor: extracted single-command execution from the done-gate test runner; focused runner tests, package lint, and package/root Cucumber lanes passed.
