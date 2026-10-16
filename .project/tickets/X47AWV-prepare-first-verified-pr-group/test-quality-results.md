# Test-quality follow-up: implemented, headless clarification approved

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

## Independent review and clarification

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
This was the blocking finding at d719cb2. On 2026-10-15 the user authorized
clarifying the parent to preserve the existing CLI gate, without bloat.
TBU1.R16 now defines nonblocking invocation: return promptly with pending status
and reviewable output, while required approval holds Implementation Planning.
Dependent admission, reentry, non-goal and demo wording follows that definition.
No runtime or authorization mechanism changed. The compact option comparison
and research are in investigation.md.

Independent Claude Opus reviews 5ba78daf-518d-43b8-b941-d34aec53c41b (all 39
replanning scenarios) and a8d822df-74e0-49df-9e47-79f5a9013e77 (parent clarification)
approve. The earlier three scenario approvals are historical after the parent
context edit; the bounded parent delta review covers the shared change against
the owning approval feature and source, rather than claiming fresh full review
of all four sets. Review warnings and dispositions remain in review-responses.md.

CI run 38764844964 passed on d719cb210de6df74c04b1fe12559ec6032fa53bd:
both Node versions passed 11,084 CLI tests / 10 skips; the acceptance lane passed
596 scenarios / 11,118 steps; release passed 81 tests. The final 13-example local
BDD replay includes strengthened flows beyond that CI lane. This CI is
prior-head evidence after the prose clarification; current-head checks belong
in PR #5881's readiness block.

Other warnings remain non-blocking: some named CLI proofs exercise handlers with
a mocked review job, live semantic judgments remain historical rather than a
new qualification, several demo/owner and contract-invalidation partitions have
narrower proof than their prose, and the adapter's name/count mappings require
maintenance when tests change. No new accepted-case deferral was introduced.
No unchanged paid qualification, recovery work, OpenCode/cloud qualification,
promotion, merge, release or deployment was performed.

Clarification replay: the first local run failed six dependent R17 examples
(7 passed / 6 failed). One cached matrix failure affected all six; the adapter
discarded its JSON report and printed only build output, so the underlying
failure cannot be reconstructed. The direct eight-row CLI matrix passed, and
the identical 13-example replay passed 621 steps in 42 seconds. This does not
establish a cause or erase the initial failure. The adapter now includes the
error message and existing JSON report before cleanup. A controlled failing
runner proves its failure sentinel survives and both dependent examples fail;
it is diagnostics proof, not approval behavior proof. Final real replay passed
13 scenarios / 621 steps in 43 seconds. Configured root lint, Gherkin lint,
CLI typecheck and format checks pass. Forcing ESLint onto its excluded step file
failed project-service admission; no lint configuration was changed. Final review
receipts are preserved alongside that failure. This intermittent local failure
remains a disclosed verification risk; no environmental cause is asserted.

Adapter review 00ba5072 found R11's full TDD-cycle claim exceeded its journey
proof. The same existing journey is extended, without new production machinery:
the denial test reads the fixture's production policy, fails before the edit,
gets actual CLI executable-RED admission using the deterministic reviewer
fixture, passes after implementation, and records GREEN at the new Git revision
plus a justified REFACTOR skip through the installed hook under the same passing
test. The combined replay passed 14 scenarios / 668 steps. Initial missing/stale
RED-admission failures and the fixture's missing-node invocation are retained.
Two lint findings in the extension were corrected; no lint rules changed.
These are newly strengthened tests, not rewritten historical TDD chronology.

Final Claude Opus review d957f5f6-c551-45e1-88f5-efd322dafda3 approves the adapter
and extended journey; the post-lint R11 replay passes 1 scenario / 47 steps.
The reviewer saw these bounded files, not every referenced test. Earlier broad
proof reviews remain historical support. Its retained warnings: shared matrices
are not row-by-row proof; fake reviewers establish wiring rather than semantic
judgment; the journey's earlier direct phase reset is fixture setup, not proof
of approval recovery (the separate eight-row CLI matrix owns recovery); literal
shared-step collisions fail rather than silently pass; live logs accumulate
locally. These do not justify expanding runtime scope or rerunning unchanged
paid qualification. Two intermediate delta reviews went stale after context or
lint edits; their receipts are retained and do not stand in for this final review.
