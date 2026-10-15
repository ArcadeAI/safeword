# Test-quality follow-up: implemented, policy decision pending

The four implemented feature contracts now have 122 matching named scenarios
and ledger entries: G1C9PP 50, 7CAMAD 39, slicing 15, checklist 18. The assessment
is in test-quality-assessment.md; complete logs, fingerprints and review results
are under evidence/test-quality/. Original bypass RED and historical failures
remain intact. Production source and templates are unchanged from d7006bc52.

## Improvements verified

- Explicit bypass and unchanged-approach recovery examples cover both human
  settings. Changed approaches still require a new configured human decision.
- The repair adapter selects eight routing tests, excluding ordinary-task
  compatibility. Its R1 selector also proves headless pending behavior. Failure
  diagnostics retain both output streams and always return a numeric exit code.
- Two proof links now name real public CLI tests. Canonical slicing dispatch
  checks both exact contract hashes, every slicing obligation and rubric bytes.
- The small-work rejection now requires an explicit not-applicable verdict and
  no authority, rather than only asserting that no files were created.
- The approval feature/ledger mismatch is corrected without deleting internal
  unit regressions or historical proof. Nine non-ancestral RED/GREEN references
  and passing-live-result RED annotations are expressly qualified.

Local verification: 231 tests passed in the four-file focused run; final changed
planning flows passed 13 Cucumber examples / 621 steps after the diagnostic
correction. Root lint, Gherkin lint and CLI typecheck pass. These overlapping
runs are not additive. Exact-head CI is recorded in PR #5881's readiness block.

Counterfactual checks are selective and are not historical test-first claims:

- Dropping the retained discovery in an isolated built-CLI copy fails all seven
  design-repair rows at the repeated-approval assertion; sequencing-only passes.
- Refusing existing human approval after fresh review fails only the enabled,
  unchanged-approach row; the other seven rows pass.
- Omitting dispatched dependency-safety metadata fails the strengthened public
  CLI assertion; restoring the source passes. Live source/dist remain intact
  during the retained replay script's mutations.

Independent executable-RED approvals 9d3ba37e-5b88-4b71-8b6c-1f8524de2aec and
355babc4-c661-4cf9-b6ec-33af1af701cd cleared the two new GREEN bindings through
Safeword's gate. The gate's ambiguous partial-edit reconstruction was resolved
with one exact, unique row replacement, without bypassing receipt validation.

## Independent review and remaining decision

Claude Opus approved G1C9PP (3cc0a831-d86d-4291-994d-6802228ccff6), checklist
(a00be152-2607-458d-93ca-9cd6a091cf5e), and slicing
(42692fce-cdf3-49e9-b687-d73ef95a95b6). The broad test-quality review
846a42c5-0132-49bc-8f15-521a89b3460d approved; the subsequent final adapter review
9e9bfb27-e725-44fa-915c-035547b1ef17 approves numeric error handling and counts.

Replanning review d2047ce1-ca82-42b3-8649-1a1d1ac4cb4d requests changes because
the parent and owning approval contract disagree about headless pending state:

- Parent TBU2.R1 / R17 says pending on a nonblocking headless surface can permit
  Execution Planning, and its project non-goal forbids needing an interactive
  human to unblock a headless session.
- G1C9PP R19's existing CLI scenario and implementation return promptly with
  pending approval, preserve Implementation Planning, and grant no new authority.
  The new R1 example exposes that existing behavior rather than changing it.

The user explicitly prohibited inventing a parallel authorization policy.
Neither the parent contract nor production approval behavior has been changed
to resolve this discrepancy. The human decision is whether to clarify the
parent to preserve the existing CLI gate, or authorize a different headless
phase-transition contract with its own implementation and proof. Until that
decision is recorded and reviewed, this is Draft and merge confidence is blocked.

Other warnings remain non-blocking: some named CLI proofs exercise handlers with
a mocked review job, live semantic judgments remain historical rather than a
new qualification, several demo/owner and contract-invalidation partitions have
narrower proof than their prose, and the adapter's name/count mappings require
maintenance when tests change. No new accepted-case deferral was introduced.
No unchanged paid qualification, recovery work, OpenCode/cloud qualification,
promotion, merge, release or deployment was performed.
