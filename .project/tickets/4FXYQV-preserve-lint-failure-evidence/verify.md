# Diagnostic repair verification

## Verify Checklist

**Test Suite:** ❌ One failure in the final stacked full run; isolated focused proof is 19/19 passing.
**Gherkin:** ⏭️ Skipped — no acceptance behavior changed; no isolated acceptance run claimed.
**Build:** ✅ Success — isolated CLI built by the normal focused-test wrapper; no release qualification.
**Lint:** ✅ Clean — root lint passed in both workspaces.
**Typecheck:** ✅ Clean — CLI typecheck passed in both workspaces.
**Scenarios:** ⏭️ Skipped — internal task with inline contract tests, not a feature ledger.
**Refactor:** ✅ No change warranted — one shared diagnostic string; no useful further extraction.
**PR Scope:** ✅ Diff matches ticket scope — two test/helper code paths plus diagnostic investigation and verification records; no PR opened.
**Dep Drift:** ✅ Clean — no dependency, manifest or architectural import changes; this is not a security-scan claim.
**Parent Epic:** N/A
**Reconcile:** ✅ No pattern deviation — existing helper and result contract retained.
**Experience:** ⏭️ N/A — internal test diagnostics; no persona experience claim.
**Surface Evidence:** ⏭️ N/A — no product surface changed; real hook fixture retained as regression proof.
**Evidence limits:** ⚠️ Original stall unreproduced; separate full-stack Go failure; no full-main suite on the isolated branch.

## Result

The helper now preserves failure output and labels ETIMEDOUT correctly; the
repair is independently approved. All 19
focused cases pass on the isolated branch. The original TypeScript stall
remains unexplained, and the final full regression on the preserved stacked
branch is red from a separate Go subprocess failure. No all-green full-suite,
PR-readiness, original-ticket closure or timeout-repair claim is made.

The task remains `verify/in_progress`. The broader reliability investigation
remains open under CQJBSN; maintenance 0G0NHM and original observer history were
not reopened or rewritten.

## Delivery and source identity

Isolated branch: `codex/preserve-lint-failure-evidence`, based on main
`f211c4c30fdb40e7fc5f342eaf981143c750db7b`, workspace
`/Users/alex/.codex/worktrees/lint-failure-evidence/safeword`.

RED commit `9f2f60a3f` corresponds to stacked commit `64616e87b`. Repair commit
`d9a410272` corresponds to stacked commit `2eed79125`. The changed files match
byte-for-byte in both workspaces:

| File | SHA256 |
| --- | --- |
| packages/cli/tests/helpers.ts | 13c3d46a78b5f4b8dd966aa95938368ba71e1df7d3de57c192c915d95baff860 |
| packages/cli/tests/lint-hook-result.test.ts | 4df5256131a4f8f0795e0b4eff7b55db7fb242c9da6894603094a9d2f64c2d08 |

No production hook, existing test expectation, timeout, worker setting, dependency or shared
review policy changed. No independent full-main suite was run on the isolated
branch; its actual focused and static results are identified below. Clean
dependency scans from the maintenance stack do not transfer to this main-based
branch, which imports no dependency overrides.

## Observed checks

| Check and snapshot | Result |
| --- | --- |
| Original helper with new contract tests, stacked branch | RED: 3 intended failures; 6 prior cases passed; exit 1 |
| Repaired helper plus real override fixture, stacked branch | 19 passed; 23.67 seconds; exit 0 |
| Same repaired files on isolated branch | 19 passed; 22.66 seconds; exit 0 |
| Root lint, Gherkin lint and CLI typecheck, stacked branch | Passed; exit 0 |
| Root lint, Gherkin lint and CLI typecheck, isolated branch | Passed; exit 0 |
| Generated checks, stacked branch | All five surfaces current; exit 0 |
| Parity, stacked branch | 277 pairs and 11 contracts passed; exit 0 |
| Instrumented full CLI suite before repair, stacked branch | 728 files passed; 11839 tests passed; 12 existing skips; exit 0 |
| Final uninstrumented full CLI suite after repair, stacked branch | 727 files passed; one failed; 11841 tests passed; one failed; 12 existing skips; exit 1 |
| Separate failed Go fixture rerun, stacked branch | All 18 passed; 15.61 seconds; exit 0 |

The instrumented experiment captured all 38 Bash lint-hook calls successfully;
the largest took 8057 ms. Original scenario 1.3 took 5704 ms, with both ESLint
calls and Prettier completing. Instrumentation was external and adds wrapper
overhead; it was absent from the final full regression and isolated focused run.

The final full failure was `lint-go-context.test.ts`'s sibling-declarations
case, after 30813 ms, with an empty message from its separate async close
handler. Its code/signal were not recorded. This is consistent with its own
30-second limit, not proof of a cause. It neither uses the repaired helper nor
changed from main. The focused Go pass is non-reproduction, not a repair.

The original failed canonical aggregate from full quality review also remains
exit 1. Neither later passes nor this diagnostic fix overwrites it.

## Independent review and normal gate evidence

- Intake receipt `c2293b1b-d010-43a2-a55f-bd441a0f1077`: approved by
  Claude/Opus, cross-agent, before the original intake transition.
- Stacked delta receipt `31740862-66a2-46f9-85b2-4051c4c00ac0`: approved the
  diagnostic work, but the implementation stamp was refused because the packet
  did not cover the inherited entire branch. No substitute stamp was written.
- Isolated complete receipt `b4d42211-f9df-42a3-b9f3-c8800894e3a9`: approved
  all six changed paths by Claude/Opus, cross-agent, without exclusions. The
  normal helper then printed `review stamped for phase implement` and the
  ticket advanced to verify. The later phase/evidence edits are administrative;
  the receipt describes its reviewed snapshot, not a fresh aggregate stamp
  for every later documentation edit.

No error-level reviewer findings remained. Optional signal-only diagnostics
and log-length caps were declined as separate resilience changes. Raw controlled
proof paths are retained unchanged; the ticket now links its in-repo copy.
The existing infrastructure-warning path is unchanged and retains its output.

The six reviewed paths were the two code/test files in the hash table,
`ticket.md`, `review-context.md`, `evidence/controlled-timeout.json` in this
ticket, and CQJBSN's `lint-timeout-investigation.md`. The two-file hash table
describes source identity, not the entire reviewed inventory.

## Raw records and remaining action

Session evidence root:
`/Users/alex/.local/state/safeword/production-red-gate-B9M6FY/lint-timeout-debug-20261025/`.
Key records: `diagnostics-red-final.log`, `diagnostics-green.log`,
`isolated-focused.log`, `full-trace.log`, `result.json`, `final-full.log`,
`go-focused.log`, both lint logs and the normal review JSON files. The actual
controlled timeout result is also committed under
[evidence/controlled-timeout.json](evidence/controlled-timeout.json).

Additional retained proof is under `evidence/`: `instrumented-summary.json`
lists all 38 measured hooks, `scenario-1-3-trace.jsonl` contains that hook's
actual tool events, and `input-hashes.json` records the two source hashes.
The excerpts also contain the Go case's measured duration and complete
generated/parity output. `command-exit-observations.json` transcribes the
observed exec tool completion statuses and session identifiers for static
checks; these statuses were not printed by the command stdout logs. This is
explicit observer metadata, not a signed execution attestation or an extra run.

`workspace-hashes.json` separately records both workspaces' matching hashes.
`isolated-build-excerpt.txt` retains the isolated wrapper's actual build-success
lines and its worktree-specific Vitest result. These supplement the earlier
review packet's proof gaps; no command was rerun to produce them.

The saved trace probe remains available for a TypeScript recurrence. A Go
follow-up must instrument its different async runner before diagnosing it.
No repeated full run was used to bury a failed aggregate. Missing original
observer RED and all 33 deferrals remain unchanged. No stale branch merge,
paid qualification, PR, push, shared review-gate edit or plugin-cache edit was performed.

**Next:** Capture the Go runner's exit code, signal, captured streams and tool
timing at a recurrence, without changing its budget or the shared worker policy.
