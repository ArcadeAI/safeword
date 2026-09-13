# Execution Plan: Complete contributions with a default Delivery Checklist

**Status:** planned

## Pull-request slicing

**Decision:** multiple pull requests

**Rationale:** Separate the inert contract, public operations, and prerequisite
helper so each merge has one independently provable outcome and no merge relies
on a later slice.

## PR 1 — Define trustworthy checklist and proof contracts

- **Purpose:** Add one closed, human-readable checklist model and the smallest
  reusable worker seam that can execute only a reviewed proof invocation.
- **Boundary:** Include proof specifications, checklist parsing and validation,
  stable-definition snapshots, derived evidence classes, and the no-shell
  proof worker. Exclude public CLI leaves, plan-review retention, readiness
  reporting, and pre-tool activation.
- **Prerequisites:** none
- **Proof:** Parser and mutation tests cover every enum and cross-field rule;
  the load-bearing worker test proves a retained real-boundary invocation can
  complete while a narrower proof stays partial and caller-supplied argv cannot
  execute.
- **Completion signal:** The checklist modules are unused by production entry
  points; executable-RED reaches only the extracted execution seam through its
  compatibility wrapper, its regression suite passes, and existing CLI behavior
  is unchanged.
- **Relies on an unmerged successor:** no

### Tasks and tests

1. RED: Add `packages/cli/tests/execution-plan/delivery-checklist.test.ts`
   cases for the eleven ordered categories, unique IDs, disposition-specific
   fields, empty proof on reviewed `not_applicable`, owner/proof constraints,
   missing categories, and full-definition owner/row/proof mutations. Run:
   `node ./node_modules/vitest/vitest.mjs run tests/execution-plan/delivery-checklist.test.ts`.
2. GREEN: Add the typed proof-specification and Delivery Checklist parser and
   validator under `packages/cli/src/execution-plan/`. Return typed defects;
   never drop, default, repair, or rewrite an invalid row.
3. RED: Add `packages/cli/tests/execution-plan/delivery-proof.test.ts` proving
   command proofs execute the retained project-contained `cwd` and reviewed
   `argv` directly, reject a `cwd` or review target outside the project,
   close stdin, inherit no TTY, and cannot accept a caller substitute. Treat
   argv as opaque reviewed input; bare executables may resolve through PATH.
   Run the same stdin, TTY, caller-substitution, and termination assertions
   through the executable-RED compatibility wrapper.
4. GREEN: Extract the narrow reusable no-shell execution seam from the existing
   executable-RED worker without changing executable-RED behavior. Return the
   observed termination and output hashes; do not write a receipt yet.
5. REFACTOR: Keep parsing, validation, execution, and readiness derivation as
   separate functions. Delete any abstraction used once and retain the existing
   executable-RED entry point as a compatibility wrapper.
6. Run:
   `node ./node_modules/vitest/vitest.mjs run tests/execution-plan/delivery-checklist.test.ts tests/execution-plan/delivery-proof.test.ts tests/review/red-execution.test.ts`.
7. Run: `bun run typecheck`.
8. Run: `bun run test`.

## PR 2 — Record proof and report contributor readiness

- **Purpose:** Make the reviewed checklist usable throughout execution through
  explicit proof recording and read-only readiness reporting.
- **Boundary:** Include the Execution Plan template, review-output record,
  stable-definition retention, ledger receipts, evidence currency, public CLI
  leaves, fixed readiness projections, canonical Execution Planning guidance,
  and generated contract mirrors. Exclude automatic first-edit denial and
  installed-host dispatch.
- **Prerequisites:** Define trustworthy checklist and proof contracts, with the
  accepted 6XW8H7 PR-slicing contract present in the merge branch
- **Proof:** Real-process CLI tests exercise both leaves, receipt identity and
  idempotency, current and earlier revisions, review-receipt currency,
  compatibility review, concurrent ledger appends, stable-definition mutations,
  PR-slicing admission, and all four readiness states.
- **Completion signal:** A contributor can inspect and complete an admitted
  checklist through public commands, and plan-execution admission requires the
  versioned definition. Existing unreviewed plans are upgraded on their next
  plan-execution entry. Ordinary code edits remain governed by the pre-existing
  execution boundary.
- **Relies on an unmerged successor:** no

### Tasks and tests

1. RED: Extend `packages/cli/tests/review/execution-plan-output.test.ts`,
   `packages/cli/tests/review/job.test.ts`, and
   `packages/cli/tests/cli-protocol/review-wiring.test.ts` so an approving
   plan-execution result must retain scenario-and-approach coverage, the exact
   ordered proof specs and stable checklist definition, reviewed applicability,
   `designApprovalGate`, the normalized plan digest, and the existing slicing
   record. Prove that changing any stable plan byte invalidates review while
   changing only contributor progress does not.
2. GREEN: Extend the plan-execution reviewer schema, validator, persistence,
   conformance corpus, generated rubric/admission assets, and durable review-job
   fingerprint. Bind review jobs to the normalized plan digest and retained
   delivery definition rather than mutable checklist progress. Preserve the current
   slicing contract and reject omitted categories or a contributor Required proof
   that is not reviewed as `real_boundary`. Reject a testing category backed
   only by review receipts; at least one contributor testing item must require a
   real-boundary command proof.
3. GREEN: In the same change that activates those admission rules, replace the
   provisional Execution Plan checklist template with the reviewed
   proof-specification and versioned checklist sections. Update the canonical
   Execution Planning guidance and the existing Conformance-Gated Execution
   Plan Review architecture record, remove the non-actionable preparation date,
   teach plan-execution authoring to insert the current sections into an
   existing unreviewed plan that lacks them while preserving decisions and slices,
   regenerate every host mirror from canonical sources, and run schema and
   parity tests. The repository must never enforce a plan shape its own template
   cannot produce. Prove an absent section is repairable and a present malformed
   section fails without automatic rewrite.
4. MIGRATE: This ticket bootstraps the new shape before the shipped validator
   understands it. After task 2 lands, obtain a fresh plan-execution review of
   these existing versioned sections before tasks 8–10 activate a consumer.
5. RED: Add `packages/cli/tests/integration/delivery-proof-ledger.test.ts` for
   command and review methods, foreign ticket/item/Proof ID, failed and stale
   proof, same-item supporting proof, partial-plus-earlier combined gaps,
   compatible-earlier independent review, stale compatibility reasons,
   idempotent retry, write conflict, unknown-event preservation, and concurrent
   proof/approval appends.
   Include an untracked, non-ignored source file and prove it demotes an existing
   receipt; an ignored file does not.
   Prove recording refuses a dirty proof subject before execution and any
   command-created source change after execution. Two sequential recordings
   may change only this ticket's Execution Plan and the shared review ledger and
   leave both receipts current; any other commit or working-tree change makes
   them earlier-revision evidence. Normalize only machine-owned phase/work-log
   changes in this ticket's `ticket.md`; prove that authored scope or acceptance
   changes still stale every command receipt.
6. GREEN: Append `delivery-proof:v1` only after a successful retained command or
   admitted review whose normalized plan identity still matches. Bind the event
   to ticket, item, Proof ID, method, reviewed boundary, producing revision,
   invocation, output, outcome, and idempotency key. Require a clean proof
   subject outside this ticket's Execution Plan and the exact shared review
   ledger before and after execution.
   Derive current evidence only while the producing revision remains an ancestor,
   `git diff` reports no later committed change, and
   `git status --porcelain=v1 --untracked-files=all` reports no tracked or
   untracked non-ignored change outside the shared delivery-progress
   normalization; validate the independently normalized
   plan identity rather than ignoring its stable content. Atomically update the
   Markdown row only if the complete plan snapshot is unchanged; preserve an
   already-written receipt across a retry.
7. GREEN: For `compatible_earlier_allowed`, retain an independent
   `delivery-compatibility` acceptance. Generate a deterministic ignored Markdown
   request under `.safeword/state/reviews/requests/` containing the exact
   ticket, item, Proof ID, retained definition digest, delivery receipt, reason
   digest, producing revision, reviewed revision, and bounded Git diff. Start or
   find the matching integrity-protected review job from those request bytes;
   never accept a caller-supplied review ID. On retry, require an approved
   cross-agent result over that exact request, then atomically append a
   `delivery-compatibility:v1` event binding every request field plus the request
   digest and source review ID before updating the checklist row. Reject an
   oversized or unrepresentable diff with a concrete instruction to rerun the
   retained proof. Pass every generated request through Safeword's existing
   secret detector before dispatch and return
   `compatibility_sensitive_content` without egress when it finds a secret.
   Give the dedicated reviewer the exact judgment contract from the
   Implementation Plan in a generated rubric. Add
   `packages/cli/tests/review/delivery-compatibility-conformance.test.ts` and
   `packages/cli/tests/review/delivery-compatibility-rubric-generation.test.ts`.
   Extend `packages/cli/tests/cli-protocol/review-wiring.test.ts` to prove the
   real coordinator accepts and dispatches the new review kind. The ledger test
   may stub review status only after that public wiring is proven.
   Semantic conformance approves a supported documentation-only delta and
   rejects a plausible compatibility reason when the diff changes tested
   source, test/fixture, command input, configuration, or dependency material
   to the retained boundary. The generation test keeps the runtime rubric and
   its canonical source byte-identical.
   Preserve the acceptance across changes excluded by the same
   delivery-progress normalization used for delivery receipts;
   return `compatibility_review_stale` for any other revision change, mismatch,
   or later reason edit. Add a case that fails under exact-HEAD comparison.
   Map a running review to `compatibility_review_pending`, rejection to
   `compatibility_review_denied`, missing authentication to
   `compatibility_review_authentication_required`, exhausted routes to
   `compatibility_review_unavailable`, and disabled cross-agent review to
   `compatibility_review_disabled`. Each result keeps the item open and returns
   the single recovery action defined by the Implementation Plan. Drive every
   terminal condition through the coordinator boundary and assert its exact
   emitted code, including `compatibility_diff_unavailable` and
   `compatibility_sensitive_content`.
8. RED: Add `packages/cli/tests/integration/delivery-checklist-cli.test.ts` for
   `contributor_work_incomplete`, `contributor_work_complete`,
   `ready_for_human_review`, and
   `human_approval_satisfied_merge_pending`; prove contributor-editable text
   cannot manufacture approval or merge authority. Assert the envelope status
   and process exit for every state, and assert each fixture's distinct
   `data.readiness_state`: all four exit 2 because contributor work, a human
   dependency, or separate merge authorization remains. A satisfied design
   approval plus another pending human item remains `ready_for_human_review`.
   An open contributor item plus any pending human item remains
   `contributor_work_incomplete`.
   Prove an
   Implementation Plan edit
   returns to human review, and only Execution Plan re-review with the new digest
   lets a new matching approval satisfy the dependency. Cover `review_required`
   and `missing_execution_plan` mappings. Exercise the real ticket resolver,
   prove features use only `execution-plan.md`, and prove task and patch fixtures
   gain no feature artifact. Build every completed fixture through
   `record-delivery-proof`; a hand-written `complete` row with plausible evidence
   class and revision but no matching receipt must remain
   `contributor_work_incomplete`.
9. GREEN: Add `ticket delivery-checklist` and
   `ticket record-delivery-proof` to the typed catalogue and public handlers.
   The proof leaf accepts paired `--receipt` and `--compatible-reason` options
   for explicit earlier-revision reuse; without them it reruns or resolves the
   retained proof to produce current evidence, and one option without the other
   is an invalid invocation.
   Use the standard v1 envelope and fixed state/exit mapping from the approved
   Implementation Plan. Declare the readiness leaf local-only and the proof
   leaf's inherited network effect; prove `--offline` refuses proof recording,
   stdin is closed, no TTY or confirmation prompt is inherited, and a successful
   proof returns the next open obligation without a per-TDD-step hook. Document
   in command help and the public CLI reference that earlier-proof reuse sends
   the complete bounded contribution diff, not only Proof Specification paths,
   to the configured external reviewer. Assert that disclosure in catalogue,
   machine-contract, and
   `packages/cli/tests/cli-protocol/cli-documentation-contract.test.ts`.
   Document
   that scripted callers distinguish successful parse outcomes through
   `data.readiness_state`, not exit 2. Non-readiness outcomes omit that field
   and expose their reason through `findings[].code`; assert both shapes.
10. RED/GREEN: Add `packages/cli/tests/integration/delivery-checklist-update.test.ts`
    for reviewed `not_applicable`, human `pending_human`, contributor owner
    rejection, unreadable plan refusal, partial progress, `designApprovalGate`
    drift, empty Revision plus `missing` Evidence class for non-evidence
    dispositions, and empty Required proof for `pending_human`. Through every
    public consumer, mutate item ID, Category,
    Obligation, Owner, Required proof, item insertion/removal, every
    proof-specification field, reviewed applicability, and
    `designApprovalGate`. Define one exported closed
    `DeliveryChecklistRepairCode` union and a total
    `Record<DeliveryChecklistRepairCode, RecoveryAction>`. Across the CLI,
    ledger, and update suites, assert one concrete recovery action for every
    contributor-repairable code. Add
    `packages/cli/tests/integration/delivery-checklist-recovery.test.ts` to
    iterate the authoritative record, so a new code without recovery fails
    typecheck instead of relying on a hand-maintained test list. Include the
    forged-progress case: strong row text without a matching authenticated
    receipt stays incomplete and returns its named recovery.
11. REFACTOR: Centralize stable-definition and normalized-plan comparison plus
    ledger decoding; keep human-readable rendering at the CLI edge and avoid a
    JSON/YAML mirror.
12. Run:
   `node ./node_modules/vitest/vitest.mjs run tests/review/execution-plan-output.test.ts tests/review/packet.test.ts tests/review/execution-plan-conformance.test.ts tests/review/delivery-compatibility-conformance.test.ts tests/review/delivery-compatibility-rubric-generation.test.ts tests/cli-protocol/review-wiring.test.ts tests/integration/delivery-proof-ledger.test.ts tests/integration/delivery-checklist-cli.test.ts tests/integration/delivery-checklist-update.test.ts tests/integration/delivery-checklist-recovery.test.ts`.
13. Run:
    `node ./node_modules/vitest/vitest.mjs run tests/schema.test.ts tests/parity.test.ts tests/review/execution-plan-rubric-generation.test.ts tests/cli-protocol/catalog.test.ts tests/cli-protocol/machine-contract.test.ts tests/cli-protocol/cli-documentation-contract.test.ts`.
14. Run: `bun run typecheck`.
15. Run: `bun run test`.
16. Once the proof recorder is available, record the proofs already produced by
    PR 1 and PR 2 and inspect the next open obligation. At each later clean
    implementation-task boundary that produces a proof, record it before the
    next task; this rule also applies to one-pull-request plans.

## PR 3 — Expose the admitted-checklist execution prerequisite

- **Purpose:** Provide the checklist prerequisite helper that 7CAMAD composes
  with the live first-execution boundary, and ship its recovery guidance.
- **Boundary:** Include the shared prerequisite evaluator, its typed recovery
  output, and direct process proof. Exclude public CLI documentation, templates, and generated
  contract mirrors, which ship with PR 2; source-level composition and the
  broader phase-provenance contract, which 7CAMAD owns; and installed-host
  parity and lifecycle rollout, which YCFFNC owns.
- **Prerequisites:** Record proof and report contributor readiness
- **Proof:** A real helper process denies missing accepted scenarios, accepted
  approach, and checklist admission in deterministic order, permits a current
  admitted checklist, leaves task and patch edits untouched, exempts legacy
  tickets, and never authorizes an edit the phase gate denied. Targeted hook
  tests prove the helper boundary and recovery output.
- **Completion signal:** Given `plan-execution` provenance, the shared helper
  refuses execution until accepted scenarios, the accepted approach, and the
  Delivery Checklist exist; it permits admitted and legacy-exempt inputs.
  7CAMAD remains responsible for live first-edit composition. Helper-only proof
  does not complete A639WN's three R1 CLI-surface scenarios.
- **Relies on an unmerged successor:** no

### Tasks and tests

1. RED: Add focused cases to the hook integration suite for missing scenarios,
   present-but-unapproved scenarios, missing approach,
   present-but-unapproved approach, both findings in stable aggregate order, missing or
   stale checklist, admitted checklist, task and patch non-activation, legacy
   exemption, and a legacy ticket returned through `plan-execution`.
2. GREEN: Add one shared prerequisite evaluator whose parameter accepts the
   phase provenance 7CAMAD will produce and persist before calling it after the
   existing phase-access check. The provenance contains the persisted
   `executionPlanContractVersion: 1` marker written by 7CAMAD before phase
   advance; its absence is the computable legacy exemption. It may deny a
   permitted application/test edit
   but may never turn a denied edit into an allow. Do not add live source-level
   composition in this ticket. Its return type is
   `ChecklistDenial | undefined`; it cannot represent an allow decision.
3. RED/GREEN: Invoke the shared evaluator in a real process with a synthetic
   first-edit request. Assert each refusal names the reason, stopped boundary,
   and one concrete repair action; assert there is no checklist-originated
   objection after admission.
4. GREEN: Add the helper's fixed recovery messages and extend
   `packages/cli/tests/integration/delivery-checklist-recovery.test.ts` with
   `missing_accepted_scenarios` and `missing_accepted_approach`. Do not add a
   catalogue entry or public documentation for this internal library seam.
5. REFACTOR: Keep the helper independent of host adapters; do not add a second
   prerequisite implementation.
6. Run:
   `node ./node_modules/vitest/vitest.mjs run tests/integration/hooks.test.ts tests/hooks/plan-gate.test.ts`.
7. Run: `bun run typecheck`.
8. Record each proof when its implementation task first makes it available; a
   later source edit retains that receipt as earlier-revision evidence. At the
   final clean revision, rerun each `current_required` proof that became stale,
   in checklist order:
   `outcome-scope` (`plan-review`), `resolved-decisions` (`plan-review`),
   `review-admission` (`review-contract`), `semantic-plan` (`plan-conformance`),
   `pr-decomposition` (`plan-review`), `testing` (`full-verification`),
   `type-safety` (`typecheck`), `category-contract`
   (`checklist-contract`), `data-compatibility` (`delivery-cli`),
   `monitoring` (`failure-signals`),
   `security-privacy` (`proof-worker`), `rollout-rollback` (`first-execution`),
   `documentation` (`documentation-contract`), `ownership` (`plan-review`), and
   `completion-evidence` (`delivery-cli`). Then inspect final checklist
   readiness.

## Obligation ownership

| Accepted obligation                                                 | Owning PRs                                                                                                                                                                |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1 checklist-admission prerequisite helper                          | PR 3 builds the helper; scenario completion waits for 7CAMAD composition and YCFFNC installed dispatch                                                                     |
| R1 missing-scenarios and accepted-approach recovery from the helper | PR 3 builds the helper; scenario completion waits for 7CAMAD composition and YCFFNC installed dispatch                                                                     |
| R2 all eleven default categories and omission denial                | PR 1, PR 2                                                                                                                                                                |
| R3 complete, not-applicable, and pending-human dispositions         | PR 1, PR 2                                                                                                                                                                |
| R3 contributor-work owner enforcement and partial progress          | PR 2                                                                                                                                                                      |
| R3 unreadable Execution Plan refusal without regeneration           | PR 1, PR 2                                                                                                                                                                |
| R3 in-flight recording timing                                       | instruction-backed at clean task boundaries; later source edits retain earlier receipts but require final reruns for `current_required` completion, and final receipts do not prove timing, so this row alone cannot close the epic conjunct |
| R4 checklist lives only in the feature Execution Plan               | PR 2, PR 3                                                                                                                                                                |
| R4 task and patch work receive no feature artifacts                 | PR 2, PR 3                                                                                                                                                                |
| R5 one-versus-many slicing outcome and unresolved denial            | PR 2                                                                                                                                                                      |
| R6 contributor and human readiness without invented authority       | PR 2                                                                                                                                                                      |
| R7 current, reusable-earlier, partial, and missing evidence         | PR 1, PR 2                                                                                                                                                                |
| R7 earlier partial evidence keeps both gaps open                    | PR 2                                                                                                                                                                      |
| Safeword CLI shared workflow contract                               | PR 2, PR 3                                                                                                                                                                |
| Canonical authoring, command, and recovery documentation            | PR 2; PR 3 adds only private helper recovery text                                                                                                                         |
| Architecture record for retained checklist and proof evidence       | PR 2 updates the existing record; no slice creates a second record                                                                                                        |
| Migration                                                           | PR 2 inserts sections into unreviewed plans; 7CAMAD owns contract-version provenance and the re-entry rule for already-reviewed plans; PR 3 treats absent version markers as legacy-exempt |
| Rollout                                                             | PR 3 — source-level activation remains behind 7CAMAD provenance and YCFFNC host rollout                                                                                   |
| Rollback                                                            | PR 2 removes template and admission activation; PR 3 removes the unused prerequisite-helper export; unknown ledger events remain inert and readable                       |

## Deferred scope ownership

- 6XW8H7 owns the accepted PR-slicing contract that A639WN consumes.
- 7CAMAD owns the complete current-plan authorization boundary and phase
  provenance used by the first-execution consumer.
- 5F5ZZA owns invalidation for other plan context and authenticated host-user
  provenance.
- YCFFNC owns installed-host delivery, parity, activation, rollback, and the
  real-boundary proof that each host dispatches the shared guard.
- 3EG00H owns proportionate task and patch checklist behavior.
- K3EBHB owns final cross-host plain-language recovery copy.

## Decision accounting

- Keep one human-readable checklist source of truth: unchanged
- Separate reviewed obligations from delivery progress: unchanged
- Derive readiness without granting authority: unchanged
- Bind command proof to a clean contribution snapshot: unchanged
- Expose separate readiness and proof-recording operations: unchanged
- Require independent judgment before reusing earlier proof: unchanged
- Keep plan approval current across evidence progress: unchanged

## Proof specifications

| Proof ID               | Method         | Scope       | Boundary exercised                                                                                                                                                           | Qualifies as  | Currency         | Invocation                                                                                                                                                                                                                                                                                |
| ---------------------- | -------------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- | ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| checklist-contract     | command        | integration | Execution Plan proof and checklist parsing and validation                                                                                                                    | real_boundary | current_required | {"type":"command","cwd":"packages/cli","argv":["node","./node_modules/vitest/vitest.mjs","run","tests/execution-plan/delivery-checklist.test.ts"]}                                                                                                                                        |
| proof-worker           | command        | integration | Direct no-shell proof process and executable-RED compatibility                                                                                                               | real_boundary | current_required | {"type":"command","cwd":"packages/cli","argv":["node","./node_modules/vitest/vitest.mjs","run","tests/execution-plan/delivery-proof.test.ts","tests/review/red-execution.test.ts"]}                                                                                                       |
| review-contract        | command        | integration | Plan-execution schema, trusted packet definition, and generated planning and compatibility rubrics                                                                           | real_boundary | current_required | {"type":"command","cwd":"packages/cli","argv":["node","./node_modules/vitest/vitest.mjs","run","tests/review/execution-plan-output.test.ts","tests/review/packet.test.ts","tests/review/execution-plan-rubric-generation.test.ts","tests/review/delivery-compatibility-conformance.test.ts","tests/review/delivery-compatibility-rubric-generation.test.ts"]} |
| plan-conformance       | command        | eval        | Semantic scenario coverage and one-versus-many slicing judgment                                                                                                              | real_boundary | current_required | {"type":"command","cwd":"packages/cli","argv":["node","./node_modules/vitest/vitest.mjs","run","tests/review/execution-plan-conformance.test.ts"]}                                                                                                                                        |
| delivery-cli           | command        | E2E         | Public proof ledger, checklist update, and readiness commands                                                                                                                | real_boundary | current_required | {"type":"command","cwd":"packages/cli","argv":["node","./node_modules/vitest/vitest.mjs","run","tests/integration/delivery-proof-ledger.test.ts","tests/integration/delivery-checklist-cli.test.ts","tests/integration/delivery-checklist-update.test.ts"]}                               |
| failure-signals        | command        | E2E         | Closed typed checklist refusal-code and recovery-action mapping                                                                                                               | real_boundary | current_required | {"type":"command","cwd":"packages/cli","argv":["node","./node_modules/vitest/vitest.mjs","run","tests/integration/delivery-checklist-recovery.test.ts"]}                                                                                                                                  |
| documentation-contract | command        | integration | Execution Plan template, guidance, CLI discovery and effects, public command reference, and generated host mirrors                                                           | real_boundary | current_required | {"type":"command","cwd":"packages/cli","argv":["node","./node_modules/vitest/vitest.mjs","run","tests/schema.test.ts","tests/parity.test.ts","tests/review/execution-plan-rubric-generation.test.ts","tests/cli-protocol/catalog.test.ts","tests/cli-protocol/machine-contract.test.ts","tests/cli-protocol/cli-documentation-contract.test.ts"]} |
| first-execution        | command        | E2E         | Prerequisite helper admission, legacy exemption, and task/patch non-activation                                                                                               | real_boundary | current_required | {"type":"command","cwd":"packages/cli","argv":["node","./node_modules/vitest/vitest.mjs","run","tests/integration/hooks.test.ts","tests/hooks/plan-gate.test.ts"]}                                                                                                                        |
| full-verification      | command        | E2E         | Complete CLI-package Vitest regression suite                                                                                                                                 | real_boundary | current_required | {"type":"command","cwd":"packages/cli","argv":["bun","run","test"]}                                                                                                                                                                                                                       |
| typecheck              | command        | integration | TypeScript type correctness for the final contribution                                                                                                                       | real_boundary | current_required | {"type":"command","cwd":"packages/cli","argv":["bun","run","typecheck"]}                                                                                                                                                                                                                  |
| plan-review            | review_receipt | E2E         | Accepted outcome and deferred scope, resolved decisions and re-review rules, three independent PR slices, sibling ownership boundaries, and the complete delivery definition | real_boundary | current_required | {"type":"review_receipt","kind":"plan-execution","targets":[".project/tickets/A639WN-complete-contributions-with-a-default-delivery-checklist/execution-plan.md"]}                                                                                                                        |

## Delivery checklist

<!-- safeword:delivery-checklist:v1 -->

| ID                  | Category                                  | Obligation                                                                                                                                         | Owner       | Required proof         | Disposition    | Evidence class | Revision | Evidence, reason, or dependency                        |
| ------------------- | ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | ---------------------- | -------------- | -------------- | -------- | ------------------------------------------------------ |
| outcome-scope       | outcome and scope                         | Record A639WN's accepted outcome and deferred sibling scope in the approved Execution Plan.                                                        | contributor | plan-review            | open           | missing        |          |                                                        |
| resolved-decisions  | resolved decisions                        | Record every accepted Implementation Plan decision and its re-review rule in the approved Execution Plan.                                          | contributor | plan-review            | open           | missing        |          |                                                        |
| review-admission    | resolved decisions                        | Retain the exact checklist and proof definition in plan-execution review output and reject an incomplete definition.                               | contributor | review-contract        | open           | missing        |          |                                                        |
| semantic-plan       | resolved decisions                        | Reject a generic checklist unrelated to accepted scenarios and an incoherent pull-request slicing rationale.                                       | contributor | plan-conformance       | open           | missing        |          |                                                        |
| pr-decomposition    | dependency and pull-request decomposition | Record three independently reviewable slices with no reliance on an unmerged successor.                                                            | contributor | plan-review            | open           | missing        |          |                                                        |
| testing             | testing                                   | Keep the existing CLI behavior passing the complete package Vitest regression suite after this contribution.                                       | contributor | full-verification      | open           | missing        |          |                                                        |
| type-safety         | testing                                   | Keep the final contribution buildable under TypeScript typecheck.                                                                                  | contributor | typecheck              | open           | missing        |          |                                                        |
| category-contract   | data and compatibility                    | Reject a feature Execution Plan that omits any default Delivery Checklist category or violates an item invariant.                                  | contributor | checklist-contract     | open           | missing        |          |                                                        |
| data-compatibility  | data and compatibility                    | Preserve unknown review-ledger events, atomically append delivery proofs, and reject stable-definition drift.                                      | contributor | delivery-cli           | open           | missing        |          |                                                        |
| monitoring          | monitoring and failure signals            | Expose typed refusal codes, fixed exit states, and one concrete recovery action for every contributor-repairable checklist failure.                | contributor | failure-signals        | open           | missing        |          |                                                        |
| security-privacy    | security and privacy                      | Run retained proof argv from a project-contained working directory without Safeword interposing a shell, TTY, or caller substitution, and reject review targets outside the project. | contributor | proof-worker           | open           | missing        |          |                                                        |
| rollout-rollback    | rollout and rollback                      | Keep checklist enforcement behind one removable prerequisite helper and preserve the reviewed legacy exemption.                                    | contributor | first-execution        | open           | missing        |          |                                                        |
| documentation       | documentation                             | Ship the canonical template, Execution Planning guidance, command discovery, recovery copy, and generated host mirrors together.                   | contributor | documentation-contract | open           | missing        |          |                                                        |
| ownership           | ownership and human dependencies          | Record A639WN ownership and the 7CAMAD, 5F5ZZA, YCFFNC, 3EG00H, and K3EBHB boundaries in the approved Execution Plan.                              | contributor | plan-review            | open           | missing        |          |                                                        |
| design-approval     | ownership and human dependencies          | Obtain human design approval for this Implementation Plan.                                                                                         | human       |                        | not_applicable | missing        |          | Project configuration has designApprovalGate disabled. |
| completion-evidence | completion evidence                       | Persist item-bound delivery-proof receipts, derive checklist readiness, and never upgrade an evidence class silently.                              | contributor | delivery-cli           | open           | missing        |          |                                                        |
