# Verification of bounded large-lockfile review

This is the local verification record. The current delivery SHA and terminal
hosted results are maintained in [PR #5947](https://github.com/ArcadeAI/safeword/pull/5947),
whose current-head checks must pass before promotion or merge. Historical CI
results below are identified by SHA, rather than carried forward as current.
The ticket remains in verification while the Draft PR awaits delivery approval.

## Verify Checklist

**Test Suite:** ⚠️ Local verification completed with 24 failures, 11,250 passes and 40 skips; six failing test names reproduced on the unchanged merge-base, while the other eighteen broad-run failures remain undiagnosed locally. Smoke: ✓ 2195/2195 tests pass. The final focused run passed all new lockfile cases and 217/218 total cases; its inspection test observed one call, while the baseline observed no log file. Matching failing test names does not establish the same root cause. Current-head hosted CI remains the delivery gate.
**Gherkin:** ✅ Acceptance lane passes on Node 24.18.1 at CI head bc6460f63a5c4d8dff6a3747b95c94f9a24a41ec: 596 scenarios and 11,118 steps, plus the proof lane. Node 22 acceptance was skipped by workflow design. Current delivery evidence is the PR's current-head acceptance job.
**Build:** ✅ Success — root build for relay, collector and CLI.
**Lint:** ✅ Clean — root ESLint, Gherkin lint and commit-time format/Markdown checks.
**Typecheck:** ✅ Clean — root typecheck covers relay, collector and CLI.
**Scenarios:** ⏭️ No new Gherkin feature for this investigated bug fix; task Test Definitions map to 37 packet cases and four signed-job/compatibility regressions. Existing acceptance coverage remains a regression gate.
**Refactor:** ✅ Completed — protected shared Git-prefix parser extraction in 8d22b8094; 81 targeted tests passed. Two architecture tables became labeled paragraphs with all twelve prior field values preserved.
**PR Scope:** ✅ Diff matches ticket scope — bounded existing bun.lock projection, integrity, tests, architecture rationale and generated native runtimes; no dependency, model, release or profile-selection changes.
**Dep Drift:** ✅ Clean — no manifest or lockfile changes and no new third-party imports. Raw audit findings and the repository's existing policy are disclosed below.
**Parent Epic:** N/A
**Reconcile:** ✅ No pattern deviation beyond the explicitly documented narrow whole-file-capture exception in ARCHITECTURE.md; existing receipt and packet owners remain authoritative.
**Experience:** ✅ No new friction — walked the developer's release-lock review through the real source CLI; worst step was waiting for independent review, new command steps versus before = 0. No UX research or profile deployment is claimed.
**Surface Evidence:** ✅ 2/2 affected boundaries have recorded proof: live source CLI review/status, and deterministic real receipt/gate integration with a simulated reviewer.
**Evidence limits:** ⚠️ Local broad verification is not green; the redundant second CLI run in the generated multi-project plan was stopped. The baseline reproduction proves six specific failures predate the change, not every install timeout. Windows mode/PATH cases are skipped where unsupported; no live installed-profile upgrade or whole-baseline semantic review is claimed.

Audit passed the installed diff-scoped code-quality, learning, principle-trace
and domain checks against origin/main merge-base
2dcc27e57214a2a63379ee9deddbe0f9dfbea3b8. The dependency boundary checker found no
violations across 136 modules and 276 edges. Whole-repository dead-code, clone
and dependency-freshness discovery were deliberately outside this diff audit.

## Completion criteria and proof

| Criterion | Recorded proof |
| --- | --- |
| Original-file coverage without a lockfile exception | The signed job regression goes through the real source CLI, receipt reader and implementation gate; bun.lock is covered and exclusions are empty. |
| Committed, staged and unstaged changes visible | Real Git parameterized packet cases; a newer local main cannot hide committed dependency changes while a remote default exists. |
| Complete bounded patch | Independent authored source oracle, exact displayed-patch replay, a patch larger than 16 KiB and deliberate loss of a later hunk. Partial successful apply is rejected in production. |
| Fresh signed identity | Source, snapshot, executable mode and baseline drift cases; identical patch bytes with a new baseline stale approval; patch-text-as-small-file substitution is rejected. Legacy full-text hash bytes remain unchanged. |
| Limits and disclosure | Full source/baseline credential and encoding cases; 8 MiB raw bounds, 256 KiB representation and 1 MiB packet limits; generated exclusions and full-text context/other-kind guards. |
| Hostile configuration and supported paths | Real diff drivers, textconv, filters and external attributes cannot run or hide the change; six escaping cases reconstruct. Other control-byte names may fail closed. |
| Supported near-limit input | A real 8,388,607-byte source and baseline yielded a 661-byte patch; capture plus freshness took 472 ms on this host. A durable integration case covers that input size. |

## End-user execution

In a fresh real Git repository, capture the immutable pre-release lock from
22307b60d77bbc4349790ceead331d4976043463 as main and the released lock from
873d5d480b78af727c1838f28a286132cc9485e1 as the working-tree change. Both files
are 343,758 bytes. Run the new source CLI's quality-review against bun.lock.
Actual cross-agent review fd21fe4a-3049-4463-847b-664b34b1e227 approved the
original target with empty excluded_targets. Status revalidated approved; a
subsequent source edit returned stale. The reviewer identified the sole 1.1.0 to
1.2.0 workspace-version change. Its missing-manifest note was answered by reading
the immutable release manifest, whose version is 1.2.0.

This proves the new source delivery boundary. The installed 1.1.0 profile was
not upgraded and is not claimed to support the new representation. Deterministic
gate tests use a source-CLI fixture and explicitly simulate the external reviewer.

## Review, compatibility and remaining limits

Cross-agent original-path review 860afb41-e51a-4e90-bb78-77a4951e83d7 approved
all implementation paths, including the complete 255,598-byte ARCHITECTURE.md.
The two generated runtime bundles retain the repository's established generated
exclusions. No exception is asserted for bun.lock or architecture coverage.
The authenticated implementation stamp succeeded through the unmodified cached
1.1.0 distribution; it used the actual installed bundle, not a test wrapper.
All five generated surfaces are current after canonical package generators.
Finding responses and the test-quality assessment are recorded alongside this
file in review-notes.md and test-quality-audit.md.

Raw bun audit reported eight pre-existing advisories: two high, three moderate
and three low. The unchanged repository CI policy passed locally: high-or-higher
audit with its two already-documented exclusions, GHSA-vfj7-8cjw-p6xm and
GHSA-ch52-4w7c-c8xp. No new advisory exception or dependency update was introduced.
The generated multi-project scanner plan for unrelated Python/Go experiments
was not completed; this record does not claim those scans passed.

The capture trusts checkout refs and the host Git executable. It reviews a
complete change with twenty context lines, not the unseen entire baseline;
reviewers must request more context when needed. New, deleted, renamed or
unchanged oversized locks remain unsupported. Large metadata operations have
fixed timeouts and fail closed on slow hosts; no unmeasured cache was added.
