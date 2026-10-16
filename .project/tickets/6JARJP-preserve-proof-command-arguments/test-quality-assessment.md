# BDD and TDD quality assessment

Assessed 2026-10-16 against production/test head
`630e0b48e0e212893dfd5c8d48614de81bb4bf51`, after the user requested a
substantive test-quality review. This is an assessment, not a repair or a new
completion claim for #4200. Production code and test contracts remain unchanged.

**Verdict:** the patch's TDD tests discriminate its primary regressions, with
one demonstrated assertion weakness and a missing automated integration chain.
The surrounding BDD evidence is insufficient for several claimed outcomes.
Green CI does not resolve those proof mismatches.

## Evidence obtained

- Read the three relevant feature/spec/ticket/dimension sets: 7CAMAD execution
  planning, A639WN delivery checklist, and 6XW8H7 slicing. They contain 72
  scenario declarations across 29 Rules. Read parent 82T411 boundaries and
  current principles/persona/surface context through review-knowledge.
- Traced the scenario adapter and both .bdd-proof.json manifests to executable
  assertions, distinguishing corpus-shape tests, pure validators, public
  handlers, real CLI subprocesses, and opt-in real-reviewer proofs.
- Independent Claude Opus scenario reviews: 7CAMAD approved with warnings;
  A639WN and 6XW8H7 requested changes. All used cross-agent review and supplied
  parent/spec/ticket context. Raw results and their packet limits are retained.
- Independent Claude Opus review of the 21 added TDD regression cases approved
  with warnings. It reviewed current production collaborators and the patch.
- Current-head CI run 38948606357 completed successfully on both Node versions.
  CLI suite: 671 files, 11,102 passed / 10 skipped per Node job; changed files
  ran as 53 validator, 28 parser, and 71 runtime cases (one runtime skip on CI).
  Node 24 also ran 596 Cucumber scenarios, all passed; provenance proof gate
  passed 50 tests. This supersedes the earlier uncertainty about final test text.
- Cucumber dry-runs found bindings for 65 default and 47 live 7CAMAD examples.
  All were skipped by dry-run: this is binding evidence, not behavioral proof.
- Seven standalone assertion probes detected six old-main regressions and
  deletion of the command exact-key guard. They were direct source probes,
  not executions of the Vitest suite under a mutation-testing runner.
- One additional in-place corruption probe survived the current shared-reference
  equality assertion; a pre-call snapshot detected it. See TDD finding below.

## Must fix before claiming these BDD outcomes are proven

The following eight independently identified proof defects are inherited from
main; this patch does not introduce or repair them. Related cases are grouped
below without treating a shared mechanism as proof that only one scenario fails.

### A639WN: installed-CLI claims mapped to parser-only checks

Affected: R2 complete-category presentation and missing-category rejection;
R3 contributor work labeled pending-human. Their manifest registrations point
to delivery-checklist.test.ts parser calls. Those are valid lower-level parser
tests, but cannot prove that the installed CLI invokes the checks, reports the
open item, or supplies the concrete repair action promised by the scenarios.
This is a boundary mismatch, not an assertion that parser tests are useless.

Proposed: retain these unit checks as support and bind the outcomes to real
CLI tests with the required category/open-item/recovery assertions.

### A639WN: in-flight example and its proof assert different next work

R3 says monitoring and documentation are the next open obligations. The mapped
test `records retained proof and immediately reports the next open obligation`
leaves all non-testing obligations open and asserts
`next_open_obligation: 'Deliver outcome and scope.'`. It never proves the
stated monitoring/documentation outcome.

Proposed: use the scenario's actual fixture and assert its next-work result;
resolve any contract disagreement before changing the scenario to fit the code.

### A639WN: evidence taxonomy and readiness rows prove neighboring behavior

R7 current-revision proof maps to direct argv execution, partial proof maps to
rejecting a plan's proof method, and missing proof maps to parsing a fixture's
missing cell. None proves the named recording/classification transition at the
CLI boundary. R6's partial-proof readiness row similarly maps to plan-parser
rejection rather than the promised readiness result with evidence class named.

Proposed: map each evidence partition to recording/readiness assertions on its
resulting class and open/complete state. Existing supporting-proof integration
tests are useful candidates, but merely renaming a corpus fixture is not proof.

### 6XW8H7: missing slice details map to the wrong result and incomplete partitions

R2 promises semantic denial naming each missing purpose, boundary, prerequisite,
proof, or completion signal. Its manifest selects `classifies %s as retryable
invalid output`, whose assertion is `kind: invalid_output` and any string reason.
It has no missing-purpose/boundary/completion-signal partition and does not
establish a named semantic denial. Structural invalid output and final semantic
denial intentionally differ in the product.

Proposed: exercise the semantic review path for each representative missing
element and assert denial plus that element's finding. Preserve structural
validator tests as supporting evidence rather than relabeling their result.

### 6XW8H7: conceptual slicing and unchanged-decision claims map elsewhere

R4 conceptual scope selects `assigns staged obligations honestly in %s`, which
only inspects ownership text in corpus fixtures. It omits the many-mechanical-edits
case and does not observe the slicing decision/proof per concern. R5 accepted
decisions unchanged selects a one-slice positive validator fixture, not a test
which would detect mutation or loss of a particular accepted decision.

Proposed: bind both to discriminating behavior through the claimed review
boundary, with the actual slicing/decision outcomes asserted. Corpus metadata
checks alone remain insufficient even if bound to better-named corpus cases.

## TDD findings and confidence limits

### Demonstrated weakness: shared expected/actual record masks mutation

execution-plan-output.test.ts lines 238–250 uses the same record inside `output`
and the returned approved result. A disposable validator mutation appended an
unexpected argv operand after trusted-definition comparison; the existing
deep-equality shape still passed because expected output mutated too. An
independent pre-call snapshot detected the corruption.

Proposed: clone the expected output before invoking the validator, and assert
both returned output and original input against that snapshot. This directly
strengthens the stated preservation guarantee.

### Missing automated parser-to-definition-to-validator chain

The parser and output tests build their own fixtures. There is no new automated
test passing parsed Markdown through createExecutionPlanDeliveryDefinition and
trusted validateExecutionPlanOutput. A corrupting transformation in that middle
step can escape both isolated tests. The manual pipeline probe establishes
current behavior, but is not a permanent CI regression test.

Proposed: one table-driven round-trip test for repeated flags, empty/whitespace
operands, JSON backslashes and escaped pipes, using the real collaborators.

### Assertions that can be more specific

Malformed parser argv cases assert only `ok === false` and use a different cwd
from their paired valid case. An unrelated parse failure could satisfy them.
Use the same valid row/cwd, mutate only argv, and assert the parser's error code.
For extra invocation keys, matching the exact-key diagnostic is clearer, but
the current valid fixture does detect deletion of that guard (confirmed by probe).

The runtime diagnostic test uses a real subprocess and covers propagation and
classification. Its example is a null record, so nested argv-path propagation
and proof indexes are supporting-validator coverage rather than separately
executed runtime examples. No requirement for a new scenario per parser field.

The original implementation used one batch RED/GREEN cycle, not 21 individually
recorded cycles; its 48 RED failures include additive diagnostic expectations
on old rejection cases. Do not describe that count as 48 new defects.

## BDD strengths, warnings, and corrected reviewer uncertainties

- Scenario language is generally coherent, Rule-owned, and paired with rejection
  cases. The dense argument matrix belongs in lower-level tests; its lack of
  duplicate Gherkin rows is not a BDD defect.
- Real prerequisite CLI tests assert pass/deny, ordered findings, repair commands,
  and absence of granted authority. The human-approval rejection proof also
  checks unchanged ledger/plan bytes. These are discriminating boundary tests.
- The 7CAMAD adapter runs actual selected proofs and checks expected test counts;
  its final steps merely assert proof success, so their fidelity depends on the
  selected tests. Cached outline proofs do not themselves vary by Examples row.
- Live semantic proofs exist and check real reviewer outputs. Default CI excludes
  @live and @proof.vitest from Cucumber; the proof-manifest test checks executable
  registration/counts, not semantic sufficiency. Neither 596 green scenarios nor
  the static manifest gate establishes a new live semantic qualification.
- The fresh-context demo uses a prewritten plan and a fake reviewer in the
  journey test. Its live matrix judges plans; neither proves a fresh authoring
  agent derives the plan. Record this as a demo/claim gap, not an authored-agent
  success inferred from wiring tests.
- Checked the review warning about R9/R16: the mapped coding-authorization test
  actually mutates each input, invokes CLI authorization and review-status, and
  verifies implementation-review survival for execution-only changes. It is
  stronger than its title suggests; no missing-direction defect is asserted.
- Checked the canonical-dispatch warning: review-wiring.test.ts explicitly
  checks author/reviewer contract digests, five slicing obligations, and the
  canonical rubric in the recorded prompt. That warning is resolved by source.
- Replan tests verify retained proof, different implementation-review counts,
  and that proof was not rerun, with a control that would create a marker. They
  support those claims; the exact promised next obligation still needs matching
  evidence. R14 checks absence of downstream authority fields, not four distinct
  downstream request/rejection interactions.

## Scope and retained failures

No production code, tests, scenarios, proof manifests, or ticket phases changed
during this assessment. The temporary reversion harness first failed three
times loading dynamically created modules, then once because a falsey predicate
was compared with literal false. Staging modules before imports and normalizing
the predicate produced the retained final results. Those setup failures are
not product regressions; their logs remain alongside the successful probes.
No new Vitest process was launched while another worktree's suite ran.

All four fresh independent review envelopes are retained under evidence. The
two request_changes verdicts remain unmodified. The Draft PR must not present
broader BDD acceptance quality as approved merely because the bounded code and
TDD reviews approved or CI passed.

**Next:** strengthen the shared-reference preservation assertion and add the
real round-trip test; repair the listed BDD bindings in their owning #4200 work
before claiming those acceptance outcomes. Keep #5897 Draft.
