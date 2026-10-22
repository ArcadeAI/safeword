# Verification

## Administrative merge preparation

User authorized admin merge on 2026-10-21 PDT. PR #6041 links all three issues.
Merged origin/main a3c216940 into the delivery at 83f099c6c, preserving upstream
Claude asset-integrity changes and regenerating conflicting plugin metadata
from source. All five generated surfaces pass. All 49 focused tests pass on the
combined branch; the real hook walkthrough passed package tests, nested imports
and go.work/unrelated-package cases on both linter versions. Final full CI must
cover the closure commit before merge. Previous full remote proof is below.

Independent source review 7991f5c9-e76e-4bdd-8903-e26f5f01927e approved with no
errors. Full branch-wide phase-stamp coverage is deliberately skipped, not
claimed: the coordinator rejects ARCHITECTURE.md above 262144 bytes, and upstream
main's copy already exceeds that limit. The supported --skip escape records the
reason in the invocation ledger. Source review, diff inspection and executable
proof remain required; the final exact-head CI gate is retained.

Review suggestions: custom run.issues-exit-code: 0 retains native/prior hook
exit-code behavior; this delivery does not override that explicit customer policy.
The internal hook command directly prints its JSON response; update notices
belong to public command setup, and bundled helpers use the pinned executable.
Malformed protocol output warns rather than reporting a clean lint. Existing
plain-warning and temporary-file limits remain documented above/below. Deploy
job dependencies are unchanged. No blocking finding remains.

## Historical full refactor verification — beac76fc3

Everything from this heading through the historical checklist below describes
beac76fc3 or explicitly named older revisions. It is not exact-head approval
for the merged branch or the pending closure commit. Current merge readiness
is BLOCKED on full final-head CI, regardless of historical passing glyphs.

Final source/test revision: beac76fc375634b41b1ca0e9a6cf0acb8d345435.
[Remote CI run 39695922147](https://github.com/ArcadeAI/safeword/actions/runs/39695922147)
is the current-source verification; the older results below are historical.
Complete workflow result: **SUCCESS**. Both Node 22.23.2 and 24.18.1 passed
11,645 CLI tests (10 explicit skips), physical-install proof and 83 release
tests. Relay passed 198 plus one skip on Node 22 and 199 on Node 24; collector
passed 153 in each lane. Acceptance passed 601 scenarios and 11,821 steps;
all 51 proof-tag tests passed. All lint, format, types, architecture, generated,
parity, contract, conformance and configured dependency-policy gates passed.
Deployment jobs were skipped by their existing policy. Machine receipt:
remote-result.json. Subsequent changes are ticket evidence only.

Both remote Go jobs passed all 49 focused tests. The current-linter job also
passed all 12 installed-hook golden-path cases with shuffle seed 4733.
Local 49-case runs passed with both pinned linter/Go pairs. ESLint, TypeScript,
parity and all five generated surfaces passed; lifecycle behavior result hashes
were unchanged after regeneration. The post-refactor diff audit found no
violations across 539 modules and 949 dependencies.

Four source refactors were independently tested and committed: immutable
config-precedence caching, caller-directory naming, capability-predicate naming,
and helper transport/validation extraction. Eight characterization cases and
four legacy-YAML policy comparisons strengthen the existing regression suites;
the process trace now proves formatting precedes exactly one package lint.

Independent Claude/Opus reviews approved both the source and updated tests with
no errors. See refactor-quality-review.md and the two machine receipts for
primary-source research, answered findings and retained nonblocking limits.
The scout ledger records each resolved candidate and declined abstraction.
No dependency change, merge, release or ticket closure is included.

## Test-quality follow-up (2026-10-21)

Audit-fix commit 536dd1fe7aaf2eb660f7fac108cef396fe1b54ed passed every job in
[CI run 39686478082](https://github.com/ArcadeAI/safeword/actions/runs/39686478082).
Both linter versions passed 37 focused Go tests. The current-linter job also
passed 12 installed-hook golden-path tests in shuffled order (seed 4733).

Seven new automated cases and five strengthened policy cases pass 37/37 locally
with golangci-lint v2.13.2 and Go 1.25.14. ESLint and TypeScript checks pass.
The final remote results below cover the audit-fix revision and all these tests.

Follow-up remote proof for commit f490b07272bc9c89cdd54582515c1168c4f16423:
[CI run 39685589843](https://github.com/ArcadeAI/safeword/actions/runs/39685589843).
Both Linux Go jobs passed 37/37 tests across three suites: golangci-lint v2.0.0
and v2.13.2. This also verifies the child-only file-size-limit test on Linux.
That entire workflow subsequently passed, including both full Node suites.

The full local CLI run completed with 11,628 passed, 12 skipped, and three
subprocess-timeout failures in the unchanged stop-hook transcript and
PR-readiness delivery suites. All three Go suites passed in that full run.
An isolated rerun together with the older-linter lane could not acquire the
shared test lock: PID 48551 in worktree ffcf held it for the full 60-second
wait, and no test started. The three timeout failures did not reproduce in
either passing remote full run; the latest remote evidence supersedes the
local verification limitation.

Two deliberately broken implementations were tested temporarily and restored:

- Suppressed package findings: all five policy controls failed.
- Omitted partial-write cleanup: the OS-limited write test failed on the leaked file.

These are two targeted mutation checks, not an exhaustive mutation score. The
new cases cover existing behavior; no claim is made that every added test
preceded implementation. No new Gherkin scenarios were added.

## Historical remote verification — beac76fc3

Final remote result: **SUCCESS** for beac76fc375634b41b1ca0e9a6cf0acb8d345435.
Run: https://github.com/ArcadeAI/safeword/actions/runs/39695922147
Machine result: remote-result.json. Audit/refactor detail: remote-verification.md.

## Historical Verify Checklist — beac76fc3, not the pending closure head

**Test Suite:** ✓ 11645/11645 CLI tests pass on both Node 22.23.2 and 24.18.1, with 10 explicit skips per lane. Relay and collector suites pass; both physical-install proofs pass; 83/83 release tests pass per lane. Both Go compatibility lanes pass 49/49 tests; 12/12 installed-hook golden-path tests also pass in shuffled order.
**Gherkin:** ✅ Acceptance lane passes — 601/601 scenarios, 11821/11821 steps, and 51/51 proof-tag tests.
**Build:** ✅ Success — all resolved project build lanes passed.
**Lint:** ✅ Clean — remote ESLint, Gherkin lint, formatting, Shellcheck and generated-plugin checks pass.
**Typecheck:** ✅ Clean — remote typechecks pass after the final source changes.
**Scenarios:** ⏭️ Skipped — this bug-investigated task uses regression tests and a manual proof matrix, with no separate scenario artifact.
**Refactor:** ✅ Completed — the full follow-up adds four independently exercised source refactors (333fd1623, 25d01284c, cc6dbc870, a3c8fdc70) and stronger regression proof at beac76fc3. Earlier 731e56450 extracts YAML parsing; 258accff3 names stream character limits. The scout ledger records declined extractions; both independent follow-up reviews approve with no errors.
**PR Scope:** ✅ Diff matches ticket scope — Go package loading, configuration preservation, feedback, host wiring, regression proof, generated carriers and directly affected documentation only.
**Dep Drift:** ✅ Clean — no dependency manifests or lockfiles changed; existing YAML/TOML runtime dependencies are documented in ARCHITECTURE.md.
**Parent Epic:** N/A
**Reconcile:** ✅ No pattern deviation — existing CLI resolver and hook result protocol retained. See version-compatibility.md for the interpolation correction.
**Experience:** ✅ No new friction — walked a Go developer through editing package tests and nested-module source via the actual source hook; worst step = package feedback can include pre-existing sibling lint debt; new manual steps vs before = 0. No killer demo was declared.
**Surface Evidence:** ✅ 3/3 affected hook process boundaries have recorded proof — shared post-edit entry, packaged Codex entry, and Cursor after-file-edit entry pass in the final automated runs. No live editor session is claimed.
**Evidence limits:** ⚠️ Successful execution of the separate offline ruleguard DSL probe remains unproven; its normalized file was located but the DSL dependency was unavailable. Live editor sessions were not exercised. Earlier local lock limitations are superseded by the passing remote suites.

**Dependency Audit:** ⚠️ The configured remote dependency-policy gate passes.
The earlier unrestricted local audit reported 7 existing Bun findings
(2 high, 2 moderate, 3 low); uv reported 2 advisory records for certifi. The
other Python scan reported none. Go found no reachable vulnerable calls, while
noting advisories in imported/required modules. Dependency files are unchanged
from origin/main; remediation is outside this fix.

Audit passed with warnings; see audit.md, review-notes.md and the independent
approval receipts. The compatibility correction was approved separately in
compatibility-review.json.

## Earlier local commands and results

The packaged verify skill's complete shell block ran as one bash invocation
through scripts/dev. Aggregate exit status: 75, preserving the first test-lock
failure. The first CLI attempt waited 15 minutes without starting tests. Later
duplicate CLI and proof-tag waiters from that workflow were terminated after
confirming their PID and this worktree's cwd. The other worktree's runner and
lock were not modified.

Acceptance completed before its separate proof-tag check waited. Build,
typecheck and dependency lanes all executed. verification-output.txt preserves
the console output with only bundle listings and progress dots removed.

`scripts/dev bun run test:smoke:fast` waited one minute and exited 75 without
starting tests; see smoke-output.txt.

Parity passed all 277 pairs and 11 contracts. The generated-surface checker
reported all five surfaces current after regeneration. Its additional lifecycle
Vitest invocation was lock-limited; the earlier lifecycle run and template
digest check passed. Final compatibility changes did not edit templates.

Final direct checks and reproducible probes are in manual-evidence.md. The 88
focused automated tests and 28 compatibility tests in the work log are
historical runs before the final compatibility correction.

## Affected surfaces

| Affected surface | Proof | Result |
| --- | --- | --- |
| Shared Go executor | Nine policy probes per version | 18/18 passed before beac76fc3; historical source proof |
| Claude shared hook entry | Three package/module probes per version | 6/6 passed before beac76fc3 and repeated during admin-merge preparation; no live client |
| Codex packaged-hook boundary | Final full suite and parameterized warning-plus-findings / oversized-warning checks | Passes remotely on Node 22 and 24 |
| Cursor after-file-edit boundary | Final lifecycle.test.ts launch/workspace check | Passes remotely; no new feedback delivery claimed |
| Generated/dogfood copies | Final CI parity, plugin freshness, release and lifecycle tests | Passes remotely |
| CI compatibility lane | Tool-required v2.0.0/Go 1.24 and v2.13.2/Go 1.25 matrix | 49/49 tests passed in each lane at beac76fc3; 12/12 installed-hook tests also passed in the current-linter lane |

## Completion state

Current PR #6041 is Draft and final-head CI is pending. Historical source
verification at beac76fc3 is complete; it does not approve the merged head.
Upstream main was merged into the delivery branch at 83f099c6c. No merge of this
PR into main and no release has occurred. Existing dependency advisories remain
outside this fix. Ticket closure and Ready promotion remain separate gates.

Follow-up for the administrative review-size limitation: restore full branch-wide
phase-stamp coverage by adding bounded changed-section review support or splitting
the architecture narrative. This is outside the Go lint fix; no generated marker,
limit change or unrelated document reduction was used to force admission.
