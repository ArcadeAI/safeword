# Verification evidence

This record separates observed checks from the final PR head. The production
code checkpoint is 72129cbf1; the subsequent change repairs only test-profile
restoration and adds six native-child regressions. Final exact-head CI and merge
state belong in PR #5897's Readiness evidence. No whole-#4200 completion is claimed.
The latest user instruction authorizes green CI and admin merge.

## Verify Checklist

**Test Suite:** ✓ 11158/11158 tests pass in the latest complete local CLI run (675 files, 14 skips). CI at 72129cbf1 passed 11162 tests / 10 skips on each Node version. After the profile correction, all 86 targeted tests passed, including six new native-child cases.
**Gherkin:** ✅ Acceptance lane passes twice: 596 scenarios / 11118 steps each, followed by 50 proof-manifest tests each. The 78-scenario live dry-run establishes bindings only.
**Build:** ✅ Success — all resolved project build lanes completed.
**Lint:** ✅ Clean — repository ESLint, Gherkin lint and CLI types passed; profile helper/test lint passed after the last test-only correction. Normal commit hooks remain required.
**Typecheck:** ✅ Clean — resolved typed lanes completed; CLI tsc passed again after profile restoration.
**Scenarios:** ⏭️ Skipped — lean task has no own scenario-completion ledger. Related feature scenario quality and actual proof boundaries are recorded in delivery-final.md; child tickets and the parent initiative are not marked complete here.
**Refactor:** ✅ Completed — 61001cd97 extracts repeated proof-cache retrieval; later test helpers retain strict acceptance assertions and explicit profile/compatibility modes.
**PR Scope:** ✅ Diff matches ticket scope — remaining proof-command/diagnostic fixes, test fidelity, scoped checklist labels/recovery details, generated carriers and evidence. Neither old branch was merged.
**Dep Drift:** ✅ Clean — no dependency or lockfile changes. The configured blocking dependency audit passes; broader unfiltered scans report existing advisories, detailed below.
**Parent Epic:** N/A — follow-up references #4200 without claiming its completion.
**Reconcile:** ✅ No pattern deviation — existing parser, validator, runtime, CLI, proof-manifest and live-reviewer owners retained.
**Experience:** ⚠️ Existing admission/setup friction — walked a contributor through genuine reviewed-plan admission, native proof and checklist projection; worst step was preparing accepted artifacts; new workflow steps from this repair = 0.
**Surface Evidence:** ✅ Public CLI/native-process boundary recorded; generated host carriers verified. Separate installed-host journeys and Windows execution remain outside this bounded repair.
**Evidence limits:** ⚠️ Initial local aggregate had six timeout-related failures; latest full run and source-checkpoint CI passed. The broad dependency scan remains red outside the configured delivery gate. Live model results are provider/model-specific; terminal matrix evidence is pending below.

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
- All five generated surfaces were regenerated and verified. No lifecycle result
  hashes changed. No templates or dependency manifests changed.

## Live semantic matrix

Pending: the corrected CLI-only Claude Opus matrix is running. Do not infer a
passing semantic outcome from CI, registration, metadata, a dry-run, or the
setup-failed attempt. Its inputs, rubric digest and full outputs are retained.

## Dependency policy and compatibility

The broad Verify dependency lane reported eight JavaScript advisories and six
Python finding entries (three urllib3 issues duplicated across identifiers).
The repository's configured CI audit blocks high/critical Bun findings with two
existing documented exceptions. That exact command passed locally and in CI;
no ignore, threshold, dependency or lockfile changed. Root Python dependencies
are development-only and their lockfile is outside the published CLI files.
These remain visible findings, not a repository-wide clean vulnerability claim.
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
