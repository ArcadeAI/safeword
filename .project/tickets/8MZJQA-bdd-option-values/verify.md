# Verify — 8MZJQA (#7724)

## Verify Checklist

**Test Suite:** ⚠️ Local environment limitation: full `/verify` at 631fe331b ran 11,890 passed and 4 failed (first pass), then 11,883 passed and 6 failed (second pass). Every non-Go failure (`review-alternate-authentication`, `degraded-explanation`, `opencode/host-contract`, `golden-path`, `typescript-validation`) passes on an isolated rerun (29/29); they timed out under concurrent test load from other worktrees. The two `lint-go-context` failures are the local Go toolchain mismatch (`go1.25.14` vs `go1.27.1`). This change touches no Go or reviewer code.
**Gherkin:** ✅ Acceptance lane passes (599 scenarios passed)
**Build:** ✅ Success
**Lint:** ✅ Clean (ESLint and Prettier on every commit)
**Typecheck:** ✅ Clean (`tsc --noEmit`)
**Scenarios:** ⏭️ Skipped — patch ticket, no test-definitions.md
**Refactor:** ✅ Completed — 27e7b9f78 replaced the name-shape feature-path classifier with Cucumber's positional-argument rule
**PR Scope:** ✅ Diff matches ticket scope (lane-config argument parsing, revision hash, tests, regenerated surfaces)
**Dep Drift:** ✅ Clean (no dependency changes)
**Parent Epic:** N/A
**Reconcile:** ✅ No pattern deviation
**Experience:** ⏭️ N/A — not persona-facing beyond the CLI fix itself
**Surface Evidence:** ✅ 1/1 — real `bun run test:bdd` runs in a freshly installed lane: `--name option-value.feature`, `-df summary`, `--name --` and a `features/targeted/` directory path each run exactly the expected scenarios; each failed before its fix (0 scenarios, or an unselected scenario ran)
**Evidence limits:** ⚠️ Local Go toolchain mismatch and concurrent-worktree load; `bun audit` reports a pre-existing high advisory in `picomatch` (GHSA-fc5q-39xc-vjpf), unrelated to this diff. CI on the final head is authoritative.

Audit passed — diff audit vs origin/main at 631fe331b: no dependency-cruiser violations (384 modules), config current, no docs or agent configs affected.

## Notes

- Cross-agent quality-review (codex gpt-6.1-sol, independence: cross-agent), four passes. Passes 1–3 each found a real gap (directory forms, combined short options, `--name --`); each was fixed red-first. Pass 4 (84ec4a33) approved with no findings.
- Ticket-level review found a lone `-` treated as an option; fixed red-first in e2b2f7fa4 (config and revision-hash tests green, 32/32 lane and config tests green). Re-review ce967590 approved.
- Option arity checked against Cucumber 13.2.1's `argv_parser.js`; `-df summary` and `--name --` behavior checked against its Commander parser directly.
