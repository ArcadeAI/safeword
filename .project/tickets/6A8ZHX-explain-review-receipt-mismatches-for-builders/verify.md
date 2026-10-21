# Verify: Explain review receipt mismatches for builders

This is the local verification checkpoint for the bounded R9 diagnostic fix. Source commit `a63e0d1e89a12d830175fd5f5de16a790a55b565` descends from current main at task start, `9f6ac6fcee254b684abf7a5bb014538a6aa6470d`. The eight changed production/test/generated paths are frozen in `evidence/frozen-product.json.txt`. Subsequent verification records do not change those bytes.

Full Node 22/24 CLI verification is pending CI at this checkpoint. The live Draft PR readiness block will record the final commit and terminal CI result. Neither stopped local full-suite attempt is a pass, and this artifact must not be read as a completed full-matrix result.

## Verify Checklist

**Test Suite:** ✓ 46/46 targeted tests pass across four files; full CLI suite deferred to CI, not claimed locally.
**Gherkin:** ✅ 601 package acceptance scenarios /11,821 steps pass, followed by 51 proof checks.
**Build:** ✅ CLI build and declaration generation succeed through the test wrappers and standalone build.
**Lint:** ✅ Full lint and Gherkin lint clean.
**Typecheck:** ✅ All three package typechecks clean.
**Scenarios:** All 6 task completion criteria satisfied through inline tests; no new feature ledger and no parent scenarios checked off.
**Refactor:** ✅ Completed — `9a4c6db6a` shares one reviewData result per candidate; the currency repair keeps admission and diagnostic views explicit.
**PR Scope:** ✅ Diff matches ticket scope: two production modules, two test files, four generated carriers and this task's evidence.
**Dep Drift:** ✅ No manifest, lockfile or architectural dependency changes. Existing CI audit policy passes; the unrestricted advisory baseline remains visible below.
**Parent Epic:** N/A for task closure; broader repository ticket 5F5ZZA remains in progress. GitHub #4200 was already closed by #4676 on 2026-09-18; this delivery does not change it.
**Reconcile:** ✅ No pattern deviation — extend the existing admission result and prerequisite repair-code vocabulary.
**Experience:** ⚠️ Author walkthrough and automated CLI mechanics only; sibling-owned non-technical wording/comprehension proof remains outside this task.
**Surface Evidence:** ✅ Public CLI exercised directly and in 23 identity cases; native host lifecycle/privacy proof is not claimed.
**Evidence limits:** ⚠️ Full matrix awaits CI; external reviewer processes are faked in behavior tests; five legacy controls deliberately seal malformed test records. Existing active-job status side effects and unsupported nested/archived target diagnosis remain deferred.

Audit passed: diff-scoped architecture check at base `9f6ac6fce`, 56 modules /86 dependencies, zero dependency violations. No changed agent configuration, learnings, domain inventory or principle trace introduced findings. Repository-wide clone, Knip and dependency-freshness discovery were intentionally excluded.

## Criteria and behavior

- A wrong-kind, current authenticated receipt names its actual review kind and the required `plan-execution` kind. A sibling ticket's receipt over identical plan bytes names the ticket mismatch. Both return one exact re-review command for the current ticket, `action_required`, and `grants_authority: false`.
- An applicable matching receipt retains the existing admission/error outcome. A valid current receipt beats mismatched claims in either ledger order. When no candidate applies, the last appended current mismatch wins regardless of untrusted timestamps; a receipt mismatching both kind and ticket names kind first. The sibling `quality-review` case discriminates this priority over the same `execution-plan.md` basename.
- Missing, stale and tampered receipts cannot supply mismatch provenance. Diagnostics now consume only the strict validated current-status view. The separate authenticated legacy view retains the existing matching missing-verdict refusal; no admission-policy change is made.
- All 23 identity cases run through the real public CLI. Eighteen use genuine coordinator jobs with fake external reviewer executables. Five deliberately sealed malformed legacy fixtures cover strict invalidity, current/stale wrong-kind and sibling cases, and matching missing-verdict compatibility. These fixtures are not claimed producible by the current coordinator or proof of provider approval.
- Ticket, ledger and terminal receipt JSON bytes remain unchanged by the prerequisite command. This does not prove read-only behavior for active jobs: the pre-existing status path can finalize an expired or exited worker.

Primary proof: `packages/cli/tests/integration/execution-receipt-recovery.test.ts`. Protection: `delivery-checklist-recovery.test.ts`, `delivery-execution-prerequisite.test.ts` and `plan-execution-journey.test.ts` in the same integration directory. Every previous repair-code assertion remains, with the two new codes added to the closed vocabulary.

## End-user execution and derived delivery

The standalone built-CLI probe created a real review, explicitly sealed a malformed legacy test record, changed its source, observed `REVIEW_JOB_INVALID`, then invoked `ticket execution-prerequisite`. Before repair it incorrectly emitted a mismatch diagnosis; the same unchanged probe passed after repair with generic refusal and no granted authority. It used isolated test keys. The earlier plugin-runtime attempt did not locate that isolated key and stopped before resealing; no production key was read. This is a CLI walkthrough with controlled provider/legacy fixtures, not a native-host or live-provider walkthrough.

Walked the Technical Builder through this refusal response; worst step remains interpreting generic refusal for malformed legacy data, while valid wrong-kind/ticket claims now receive specific diagnostics and the same concrete command. New user steps: zero. No non-technical comprehension or isolation claim is made.

All five derived surfaces were regenerated in the prescribed order and verified. Parity passes 277 pairs /11 contracts. Generated CLI reference and terminology checks pass. Release verification passes 14 files /83 tests. Offline qualification verification retained its existing results (Claude to Codex: `not_weaker`; Codex to Claude: `weaker`); no catalogue, seals, models, settings or paid qualification were changed or rerun. Ordinary independent code-review receipts do not upgrade those bounded historical capability results.

## Independent review and retained limits

Independent Claude Opus reviews `31c51fd9`, `0f75e02f`, `6121f339`, `0fd8157b`, `4de1796a` and final complete-scope `db4c59a9-d449-45b8-822e-888704474d02` are preserved. The final review approved source, tests, ticket and generated carrier metadata. Both compiled runtime bundles were automatically excluded by the coordinator and are covered by source review, regeneration and execution, not raw bundle review. The authenticated implement-phase stamp was earned before entering verification.

The malformed/stale diagnostic gap reported by `0fd8157b` was treated as a contract defect despite its warning label, demonstrated by four failing tests and repaired. Remaining suggestions are answered: same-level canonical sibling detection matches the supported ticket resolver; nested, archived, symlink-dependent and noncanonical paths retain generic fail-closed recovery. Existing applicable-but-invalid matching receipt outcomes still dominate mismatched claims; changing candidate selection or active-job cleanup is outside this fix. No new independence/capability grade or approval authority is inferred.

The #5957 copy tests, #5980 context/disposition tests, parent feature, ledgers, capability catalogue and qualification admission evidence remain byte-identical to the starting main. R7 native retrieval/private injection, broader host proofs, sibling-owned recovery copy, #5139 enforcement and the historical six failed /585 unfinished and 33 deferred cases remain unchanged. There is no new epic-wide acceptance claim.

## Failures, deferrals and reproducibility

Initial RED: two failed /one passed. Initial protection expansion: one fixture-only duplicate target/context error with 37 passes; repaired without weakening assertions. Refactor's duplicate local-name build failure was immediately reverted; its corrected run passed 38 checks. The discriminating quality-review expansion passed 39 checks; a dynamic-regex lint issue was replaced by literal/value assertions. Currency RED: four failed /19 passed; final protection: 46 passed. Missed patch anchors applied nothing.

The first canonical verification attempt was interrupted with exit 130 when the currency defect was found. A separate local full attempt passed relay/collector checks but was stopped with exit 130 while the CLI suite waited behind another checkout. The project prefers remote verification, so the complete Node matrix is deferred to CI. A lock wait exited 75 before any test; the unchanged queued regression later ran with a longer lock wait, not a changed test timeout. Only this task's verified process groups were interrupted; other checkouts were not signaled.

Phase-advance and stamp attempts correctly refused incomplete review coverage. The final complete-scope receipt includes generated carriers and authenticated bundle exclusions. A temporary reviewer runtime was removed with another worktree; the installed runtime supplied the subsequent independent reviews. No gate/configuration bypass or hand-written review stamp was used.

The unrestricted dependency audit exits 1 with existing advisories. The repository's exact high/critical CI policy passes with its two existing exceptions, `GHSA-vfj7-8cjw-p6xm` and `GHSA-ch52-4w7c-c8xp`; this slice adds no exception or dependency change. Release output retains a non-blocking Vite future-loader warning without suppression. The optional Go checker compiles and reports no test files; a missing optional uv-venv warning is retained, not new behavior coverage.

Raw verdicts, RED/GREEN/interruption logs and standalone probe sources are in `evidence/`; `compressed-log-sha256.json.txt` hashes every decompressed archive. `local-verification.json.txt` explicitly describes this pre-CI checkpoint. Full CI and its final commit must be observed in the PR before any Ready or merge decision. This task grants no merge, Ready promotion or destructive cleanup authority.
