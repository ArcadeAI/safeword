# Test-quality improvements

Historical checkpoint: the later user request authorized Verify, Audit, Refactor,
Quality Review, green CI and admin merge. See [final assessment](delivery-final.md)
and [verification](verify.md) for the current delivery disposition.

This follows the user's explicit instruction to implement the quality
assessment's suggested repairs. The historical assessment remains unchanged.
This work strengthens the scoped proof-command tests and the A639WN/6XW8H7
acceptance proofs; it does not certify all of #4200.

## Changes and boundaries

- Independent pre-call snapshots catch validator input mutation. A permanent
  Markdown → parser → trusted definition → validator table covers repeated
  flags, empty operands, backslashes and escaped pipes. Malformed cases isolate
  argv and assert its rejection code; extra-key rejection names the exact guard.
  A real CLI proof also sends mixed operands to a native Node child and checks
  the recorded stdout digest against independently computed expected bytes.
- Real CLI tests now observe category labels, missing categories, rejected
  contributor handoffs, monitoring/documentation as the remaining work, every
  evidence-currency partition, and pending/satisfied human authority. They also
  check that refused operations preserve the plan and ledger bytes.
- Missing not-applicable reasons and human dependency names have explicit
  rejection examples. The parser already refused them; its repair diagnostics
  now name the required detail. Checklist output adds id/category/obligation
  labels, while evidence and authority still come from their existing checks.
- Shared fixture extraction preserves the prerequisite tests. Its seeded
  admitted-review state is Given setup, including the existing signed-fixture
  fallback; it is not evidence of real plan-execution admission. Real reviewer
  behavior is tested separately through the public CLI live lane.
- Semantic slicing proofs use test-local variants with concrete actor, fixture,
  command, edit and assertion details. Rejection inputs start from a complete
  baseline. Missing proof removes the verification procedure, not merely its
  Markdown label. The accepted scenario context contains ordinary product
  behavior, without expected verdicts or evaluator defect descriptions.
- Live checks assert named findings, exact prerequisite order, proof ownership,
  preserved decisions, complete record fields and boundary-specific rationales.
  The count-only rejection includes both line and file counts. Selectors match
  complete case IDs; filtered tests cannot count as passing selected proofs.
- A bound Cucumber step now fails if its proof hook never ran. Cache identity
  includes supporting proof requirements, preventing scenario order from
  skipping the additional deterministic recovery check.

The production conformance corpus and admission evidence remain unchanged.
Acceptance result IDs are prefixed `acceptance:`; a regression test proves that
the admission builder rejects those results. This lane cannot silently qualify
a production reviewer route.

## Discrimination and R/G/R evidence

Raw logs and review envelopes live in `evidence/test-improvements/`.

| Check | Observed result |
| --- | --- |
| Old shared-reference preservation assertion under intentional argv corruption | 2 tests passed: demonstrated survivor |
| New snapshots and pipeline under the same corruption | 5 tests failed |
| Definition-builder corruption | 3 pipeline tests failed |
| Exact-key guard removal | rejection test failed |
| Ordered-argv regression | both acceptance tests failed |
| Backslash regression | both parser cases failed |
| Restored mutation sandbox | selected tests passed; production worktree was never mutated |
| CLI category/repair refined RED | 3 failed / 7 passed |
| CLI first GREEN, with original prerequisite and parser coverage | 57 passed |
| Expanded deterministic scope | 301 passed / 2 existing platform skips |
| Missing disposition detail RED | 2 failed / 15 filtered |
| First detail GREEN attempt | 100 passed / 1 stale diagnostic expectation failed |
| Updated exact diagnostic expectation | 102 passed |
| Missing proof-hook control | old Cucumber run incorrectly passed; strengthened run failed closed |
| Permanent harness/fixture regression tests | 8 passed |

These are targeted deliberate-fault runs through actual Vitest tests, not a
whole-repository mutation score. The missing-hook RED/GREEN control directly
executes Cucumber; the permanent regression also executes that boundary under
Vitest.

## Retained live failures and corrections

1. A temporary production-corpus edit invalidated the admission digest. All 63
   public CLI cases were blocked before reviewer dispatch. That edit was
   reverted; the admission generator's check confirms the current digest.
2. The first direct headless attempt inherited the test sandbox's unauthenticated
   profile: 63 failed / 1 setup assertion passed. The live helper now restores
   the explicitly captured live profile. The authenticated exploratory matrix
   exposed incomplete legacy approval fixtures and was stopped; it is not a
   completed qualification result.
3. The first acceptance preflight had 9 passed / 1 failed / 54 filtered. The
   selector unintentionally included a suffixed migration case. Its substantive
   failure showed that deleting a proof label still left the actual proof
   procedures present. Both fixture and selector were repaired.
4. The first complete acceptance attempt had 17 passed / 11 failed / 37 filtered.
   Its positive fixtures omitted assertions for retained judgments and unchanged
   stored bytes required by their accepted scenarios. Those assertions were
   added before another live run. The failures are retained, not replaced by a
   claim that all denials were correct.
5. The second attempt had 22 passed / 6 failed / 37 filtered (21 of 27 actual
   cases passed). Four label-only omissions were still inferable from the tasks.
   Those examples now leave one field explicitly `Not specified.` instead.
   The two positive fixture defects were a vacuous mirror inventory and missing
   authorization recovery assertions; both were repaired. The acceptance bank
   was restricted to its 27 owned cases rather than unrelated qualification data.
6. The third full acceptance run had 27 passed / 1 failed, with no skips: 26 of
   27 cases passed, plus the identity assertion. The remaining positive mirror
   fixture put a second RED list after a GREEN edit, making its order impossible.
   Its steps were merged into one ordered list. Before/after serialized case
   snapshots initially proved only `many-mechanical-edits` changed. A later
   independent review also found a confound in a previously passing authorization
   case: contradictory upstream context and a destination hint could satisfy
   its assertions without detecting the implementer-deferred Boundary.
   The repaired authorization case preserves the approving baseline's approach,
   scenarios, decision accounting and existing boundary content; only its
   Boundary adds the unapproved choice. A paired integrity test proves that
   isolation, and the same finding must identify the slice, authorization and
   Boundary. Exactly those two cases now differ; the other 25 inputs and
   expectations remain byte-identical and passed in the third run. Both changed
   cases were subsequently rerun; their terminal results are below.

The post-admission applicability test initially exercised the testing category's
earlier parser rejection instead of admission binding (76 passed / 1 failed in
that batch). Moving it to an applicable documentation obligation isolated the
intended signature/definition check; its targeted rerun passed. The unreadable
plan fixture now explicitly establishes `phase: implement`, and the small-work
cases assert no recovery or next action requesting feature planning.

Do not retry unchanged semantic failures until they happen to pass. Classify
environment, fixture, assertion, or product defects against the exact input;
retain the failed run and explain the repair before rerunning. A single passing
live sample is evidence of that run, not a guarantee of future LLM verdicts.

## Independent review responses

The first scenario reviews requested the CLI boundary repairs, single-defect
slicing fixtures, and missing-detail rejection examples; all were acted on.
Later reviews approved the bounded test changes with warnings. Every earlier
request-changes or stale result remains retained. Current-source status must
be checked again after the final commit.

The warning about cloned validator expectations does not invalidate the unit
preservation check: the snapshot is taken before the validator invocation, the
operation under test. Actual Vitest mutation runs show that normalization/input
corruption survives the old shared-reference assertion and fails the new one.
The separate pipeline test covers the definition builder too.

The proof-registration ratchet rises from 73 to 75 shared declarations because
two real CLI tables serve related scenario rows. Row-selected fixtures and
assertions remain distinct; maximum fan-in stays at 14. Independent review
explicitly judged that increase justified. No assertion or scenario was dropped
to satisfy the counter.

## Remaining initiative limits

The 7CAMAD fresh-authoring-agent demonstration and separate downstream
authorization interactions remain broader #4200 proof gaps. These changes do
not claim that a fresh authoring agent produced a plan. The historical source
qualification is not new acceptance evidence. Canonical ticket updates remain
unavailable through the host's permitted edit-tool fields, so the scaffold is
not marked done. Keep #5897 Draft; do not merge or promote.

## Terminal verification and review

The final two-case live run selected exactly those cases plus the identity
assertion: **2 passed, 1 failed, 25 filtered**. `many-mechanical-edits` passed.
`unresolved-authorization-decision` was denied with a finding naming the correct
slice, authorization and Boundary, but returned `plan-execution` instead of the
required `plan-implementation`. The dispatched Discovery routing contract says
changed or newly required accepted design decisions return to Implementation
Planning. The expected destination was retained; this unchanged input was not
retried. Thus 25 unchanged inputs passed in the third matrix, the corrected
mirror passed separately, and the corrected authorization case remains failing.
This is **not** a complete passing 27-case matrix or a new route qualification.

The full local CLI suite completed: **669 files passed, 5 failed; 11,123 tests
passed, 6 failed, 14 skipped**. Failures were in plugin-resource-contract,
review-explanations, bdd-lane-golden-path, re-entry-concurrent and
status-close-gate. Four files showed timeout symptoms; review-explanations
reported an unavailable fallback reviewer instead of the fixture's invalid
answer. An unchanged isolated run of all five files passed **10/10 tests**.
That supports transient execution failure, but does not establish its cause or
turn the failed aggregate green. Both logs are retained.

The final deterministic recheck passed **28/28** across the CLI-boundary,
slicing-fixture and omitted-hook regression files. Repository lint passed
ESLint, Gherkin lint and CLI typechecking; formatting checks passed. All five
generated surfaces are current. The all-package build, parity (276 pairs and
11 contracts) and dependency structure check (zero errors, five existing
orphan warnings) also passed during this follow-up. No dependency changed.

The optional full default BDD run was interrupted with SIGINT (exit 130) after
prolonged execution without a terminal summary. Its partial output includes
undefined-step markers; it is not a passing acceptance aggregate. The complete
partial log is retained. The scoped live binding dry-run established bindings
only, and the completed CLI/harness tests above remain the actual deterministic
proof. Current-head CI must establish its own default-lane result.

Fresh bounded independent reviews used Claude in a separate headless process
with `independence: cross-agent`:

- Code/test quality: `1a9f229e-53aa-428c-9aee-bc53d781b0c6`, approved.
- A639WN scenarios: `72816255-075e-4aa7-ba38-e54943bc32e3`, approved.
- 6XW8H7 scenarios: `0ba37e07-2db8-45b8-a3bd-9a1c8cbb84fe`, approved.

These are judgments of the bounded test work, not passing semantic results or
human approval. No source under review changed after dispatch.

### Responses to remaining review warnings

- Missing-proof isolation: the current baseline has exactly one slice. The
  variant removes its proof declaration and verification tasks; a named-slice
  finding is required. A future multi-slice baseline needs a narrower transform
  and integrity assertion. This is a maintenance limitation, not an assertion
  that generic metadata demonstrates denial.
- Guarded replacements: obligation rows throw if absent, and paired field and
  authorization tests compare exact baseline differences. Other negative
  replacements fail closed in the live lane if they stop matching. Guarding
  every positive mirror transform remains an optional robustness improvement.
- Root prerequisites: `Not specified.` deliberately means unresolved rather
  than an honest `none`; the accepted contract requires an explicit set. The
  retained live result demonstrates that interpretation for this reviewer run.
- Supporting-proof cache: the full identity intentionally prevents a shared
  selector from dropping the checklist-specific check. It may repeat two live
  cases; optimize only with separate primary/support completion caches, not by
  weakening the identity again.
- Applicability proof context: the inherited case requires both `item-4` and
  `behavior-boundary` in findings. Public CLI plan bytes remain unchanged on
  denial. This proves refusal, not a successful readiness projection. The
  deterministic post-admission example separately proves definition binding.
- Not-applicable reason: the plan artifact retains the concrete reason, and
  the sibling missing-reason rejection enforces it. The current CLI projection
  does not expose that reason; no new display contract is claimed.
- Earlier incompatible evidence: current consumer behavior safely reports
  `partial_or_structural` with `earlier_revision` and leaves the item unproven.
  This tests existing conservative behavior without inventing a fifth class;
  the taxonomy wording remains a follow-up contract clarification.
- One-PR rationale regexes check domain-specific cohesion, not the validity of
  every counterfactual split. Two-purpose denial requires the named slice and
  `two`/`purpose` in one finding, not exact wording of both purposes. These are
  bounded semantic assertions, with the reviewer transcript retained for human
  assessment. Mirror approval expects exactly `['Contract mirrors']`.
- Semantic model variability is explicit in tags, opt-in flags and stamped
  reviewer/model receipts. Default CI cannot certify these judgments. The
  scenario-context guard is supplemental to the shared neutral context.
- Earlier owner-handoff warning: the invalid contributor/pending-human row
  tests parser refusal; it does not certify every human reassignment. The
  immutable definition binds owner, reviewed disposition and proof; the separate
  applicability test exercises that common admission boundary. No wider human
  authorization coverage is claimed.
- Remaining scenario wording/style and task/patch dimension warnings do not
  change the assertions: R4 explicitly assigns small-work behavior to 3EG00H;
  readiness tests assert actual owning states without merge authority; review
  recovery tests cover the concrete next command. No NTB walkthrough is claimed.
- The live authorization transcript also warns about unnamed highest-risk RED
  ordering and generic documentation refactor wording in the fictional plan.
  They did not cause its blocking denial or routing mismatch. They remain
  visible fixture-quality limitations, rather than being removed by retries.

**Next:** push the requested Draft with current check results and the unresolved
live routing failure; do not merge or promote.
