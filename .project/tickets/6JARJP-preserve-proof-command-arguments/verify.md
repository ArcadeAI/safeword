# Verification evidence

The user subsequently authorized the completion-timeout prerequisite. Its
current evidence and pending closure/CI state are in timeout-results.md. The
frozen-source checklist below records the original proof-command slice; its
passing history does not substitute for the new prerequisite's verification.

This record separates observed checks from the final PR head. The frozen source
checkpoint is cb18cb71f, reconciled with main cfe93e30. The four production repair
modules remain byte-identical to CI-green 72129cbf1. Later commits improve the
test profile and integrity/negative fixtures. Final exact-head CI and merge state
belong in PR #5897's Readiness evidence. No whole-#4200 completion is claimed.
The latest user instruction authorizes green CI and admin merge.

## Verify Checklist

**Test Suite:** ✅ Frozen source cb18cb71f passed 677 CLI files / 11224 tests / 10 skips on each Node version in CI run 39003088682. Earlier local aggregate: 11158 passed / 14 skips. Profile correction group: 86 passed, including six native-child cases.
**Gherkin:** ✅ Acceptance lane passes twice: 596 scenarios / 11118 steps each, followed by 50 proof-manifest tests each. The 78-scenario live dry-run establishes bindings only.
**Build:** ✅ Success — all resolved project build lanes completed.
**Lint:** ✅ Clean — repository ESLint, Gherkin lint and CLI types passed again on frozen source cb18cb71f. Normal commit hooks remain required.
**Typecheck:** ✅ Clean — resolved typed lanes completed; CLI tsc passed again after profile restoration.
**Scenarios:** ⏭️ Skipped — lean task has no own scenario-completion ledger. Related feature scenario quality and actual proof boundaries are recorded in delivery-final.md; child tickets and the parent initiative are not marked complete here.
**Refactor:** ✅ Completed — 61001cd97 extracts repeated proof-cache retrieval; later test helpers retain strict acceptance assertions and explicit profile/compatibility modes.
**PR Scope:** ✅ Diff matches ticket scope — remaining proof-command/diagnostic fixes, test fidelity, scoped checklist labels/recovery details, generated carriers and evidence. The user additionally authorized the bounded completion-timeout prerequisite recorded in timeout-fix.md. Neither old branch was merged.
**Dep Drift:** ✅ Clean — no dependency or lockfile diff from current main. The configured blocking dependency audit passes; fresh Python audit is clean after main's urllib3 update. Broader JavaScript findings remain detailed below.
**Parent Epic:** N/A — follow-up references #4200 without claiming its completion.
**Reconcile:** ✅ No pattern deviation — existing parser, validator, runtime, CLI, proof-manifest and live-reviewer owners retained.
**Experience:** ⚠️ Existing admission/setup friction — genuine reviewed-plan/native-proof walkthrough added zero steps for new artifacts; worst step was preparing accepted artifacts. Existing admitted definitions whose ordinary-cell backslashes now parse differently require a fresh plan-execution review.
**Surface Evidence:** ✅ Public CLI/native-process boundary recorded; generated host carriers verified. Separate installed-host journeys and Windows execution remain outside this bounded repair.
**Evidence limits:** ⚠️ Initial local aggregate had six timeout failures; later local aggregate and frozen-source CI passed. Two normal local closure attempts then exceeded the fixed five-minute acceptance budget and refused completion. Ticket closure and promotion remain blocked. Broad JavaScript audit findings and provider/model-specific live limits remain disclosed.

## Observed checks

- Original TDD: 48 failed / 102 passed / 2 existing skips, then 150 passed / 2 skips.
  Added diagnostic assertions are included; 48 failures do not mean 48 bugs.
- Final nested-definition RED reproduced four field-diagnostic failures. The
  wider fixture RED also included an unimplemented case and setup mistakes;
  these are not counted as production regressions. The corrected three-file
  recheck passed 109 tests / 2 existing skips.
- The verbatim Verify block completed with exit 1, preserving its first failure.
  First full CLI pass: 11152 passed / 6 failed / 14 skipped across 675 files.
  All six failures were timeout/termination related in four files unchanged by
  this PR. The plan's scheduled second full run passed all 675 files with
  11158 passed / 14 skipped. Failed aggregate evidence is not relabeled green.
- Relay: 198 passed / 1 skip. Collector: 153 passed. The Go experiment command
  completed with `[no test files]` (compilation only). Resolved build/type lanes
  and both BDD lanes completed. Raw full output is retained.
- Fast smoke: 103 files / 2174 tests passed.
- The no-CLI acceptance probe failed before test registration with the required
  CLI-mode error and wrote no result artifact. It is an expected refusal, not
  a passing semantic matrix or a product test failure.
- A profile cleanup regression then caused 28 authentication setup failures and
  zero semantic outputs. Six native-child regressions reproduced it (2 failed /
  4 passed), then passed after the helper fix. The full focused group passed
  86/86; lint and tsc passed. No login or credential files were changed.
- Source CI [38997769169](https://github.com/ArcadeAI/safeword/actions/runs/38997769169)
  passed both Node versions, the Node 24 default BDD lane, release-gate tests,
  physical install proof, contract, OpenCode, lint, parity and dependency checks.
- Audit passed: no dependency violations across 90 modules / 146 dependencies;
  scoped architecture, principles, learnings and configured docs checks found
  no contradiction. Whole-repository unused-code, clone and upgrade discovery
  were intentionally outside this diff audit.
- Refreshed Audit after current-main reconciliation passed: 92 modules / 148
  dependencies, no violations; principles, learnings and domain checks exited 0.
- Current core/CLI reconciliation passed 269 tests / 2 existing platform skips.
  The final fixture/profile/adapter group passed 73 tests, including 16 bank
  guards and six native-profile cases. These are deterministic results, not
  substitutes for the live matrix.
- All five generated surfaces were regenerated and verified. No lifecycle result
  hashes changed. No templates or dependency manifests changed.

## Live semantic matrix

PASS: frozen source cb18cb71f, Claude Opus, actual packaged CLI dispatch:
28/28 semantic cases plus the reviewer-identity test passed (29 tests total,
609.95 seconds). Every retained result is marked cli; expected verdicts,
destinations, slice ownership and localized rejection reasons passed unchanged.
Output inspection confirmed the repaired few-files positive is approved, the
unsafe predecessor is denied for unsupported merge/dependency safety, inadequate
proof returns to Execution Planning, and unresolved/changed authorization returns
to Implementation Planning. This is one provider/model run, not general model
qualification. Negative cases may elicit additional valid findings; no claim
that every negative has exactly one defect is made.

The source fingerprints, all 28 inputs, unchanged rubric digest
14bc17090fbbe44a996c543e1593d3a1af0dd89f4c2cf5baac635863304e426b,
full outputs, terminal log and results are retained under evidence/final-delivery
with final-v3 names. Earlier failed attempts remain separately retained. No
production conformance corpus, admission oracle or qualification rule changed.

## Frozen-source CI and local closure

CI run [39003088682](https://github.com/ArcadeAI/safeword/actions/runs/39003088682)
passed at exact source cb18cb71fda966476492240284e180f34de44648:
677 CLI files / 11224 passing tests / 10 skips on each Node version;
596 scenarios / 11118 steps and 50 manifest tests on Node 24; release checks,
physical install, lint, contract, parity, OpenCode and configured dependency gate
all passed. Full logs and summaries are retained as ci-cb18 artifacts.

The current normal Codex completion gate was also invoked with the actual
session identity. It refused closure twice when its acceptance command was
terminated at the existing five-minute cap. No scenario assertion failure was
reported before termination. These are failed local gate attempts, retained as
done-stop-direct and done-stop-retry logs; they are not relabeled passing Verify.
The ticket remains in_progress/done. No completion status, review stamp or
readiness receipt was forged; PR #5897 remains Draft. The timeout investigation
is in closure-timeout.md. Final evidence-commit CI belongs in the PR body and
does not erase this local closure blocker.

## Dependency policy and compatibility

The broad Verify dependency lane reported eight JavaScript advisories and six
Python finding entries (three urllib3 issues duplicated across identifiers).
The repository's configured CI audit blocks high/critical Bun findings with two
existing documented exceptions. That exact command passed locally and in CI;
no ignore, threshold, dependency or lockfile changed. Root Python dependencies
are development-only and their lockfile is outside the published CLI files.
The Python findings are historical: main cfe93e30 supplied urllib3 2.8.0,
frozen synchronization installed it, and a fresh audit found no known Python
vulnerabilities. Existing JavaScript findings remain visible; this is not a
repository-wide clean vulnerability claim.
See delivery-final.md for the policy, primary advisory links and scope evidence.

Non-pipe backslashes now remain literal in ordinary table cells as well as JSON.
Retained definitions whose parsed bytes change require a fresh plan-execution
review; approval is never silently carried across that change.

## Independent review and manual boundary

Current code/profile review 8011cb83-eb20-4792-8236-78e2ff36c3de approved with no
errors (Claude Opus, cross-agent). Scenario reviews 391fb5fe and b971fe7e approved
the unchanged feature texts; the later profile transport correction is separately
reviewed and tested. Remaining non-blocking findings are answered in delivery-final.md.

The real CLI walkthrough used genuinely reviewed scenario, approach and Execution
Plans. Native operands produced exactly 75 stdout bytes with independent SHA-256
f5efb78f6e25534d98ea164b4385cef3766b5be594203740c6df1833773fc46a.
A mismatching child was refused; after restoration, all applicable contributor
items were proven and merge authorization remained pending. The walkthrough
claims neither failed-receipt retention nor cryptographic signing of delivery
proof records. Coordinator review receipts were genuinely verified and stamped.

Historical verification, rejected/stale reviews, failed aggregates, source diff
snapshots and raw outputs remain under evidence/final-delivery (and the earlier
evidence directories). Duplicate plain patches are compressed, not discarded.
