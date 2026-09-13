# Execution Plan: Complete contributions with a default Delivery Checklist

**Status:** planned
**Prepared on:** 2026-09-12

## Pull-request slicing

**Decision:** multiple pull requests

**Rationale:** The contribution has three independently valuable and provable
outcomes: an inert checklist and proof contract, user-reachable evidence and
readiness operations, and execution-boundary activation. Keeping those outcomes
separate lets a reviewer validate the trust model before any gate consumes it.
Each merge is supported on its own: PR 1 is unused contract code, PR 2 adds
explicit CLI operations without changing execution authorization, and PR 3
activates the prerequisite check only after the complete contract exists.

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
- **Completion signal:** The new modules are unused by production entry points,
  every contract test passes, and the existing CLI behavior is unchanged.
- **Relies on an unmerged successor:** no

### Tasks and tests

1. RED: Add `packages/cli/tests/execution-plan/delivery-checklist.test.ts`
   cases for the eleven ordered categories, unique IDs, disposition-specific
   fields, owner/proof constraints, missing categories, and full-definition
   owner/row/proof mutations. Run:
   `node ./node_modules/vitest/vitest.mjs run tests/execution-plan/delivery-checklist.test.ts`.
2. GREEN: Add the typed proof-specification and Delivery Checklist parser and
   validator under `packages/cli/src/execution-plan/`. Return typed defects;
   never drop, default, repair, or rewrite an invalid row.
3. RED: Add `packages/cli/tests/execution-plan/delivery-proof.test.ts` proving
   command proofs execute the retained project-contained `cwd` and `argv`
   directly, close stdin, inherit no TTY, and cannot accept a caller substitute.
4. GREEN: Extract the narrow reusable no-shell execution seam from the existing
   executable-RED worker without changing executable-RED behavior. Return the
   observed termination and output hashes; do not write a receipt yet.
5. REFACTOR: Keep parsing, validation, execution, and readiness derivation as
   separate functions. Delete any abstraction used once and retain the existing
   executable-RED entry point as a compatibility wrapper.
6. Run:
   `node ./node_modules/vitest/vitest.mjs run tests/execution-plan/delivery-checklist.test.ts tests/execution-plan/delivery-proof.test.ts tests/review/red-execution.test.ts`.
7. Run: `bun run typecheck`.

## PR 2 — Record proof and report contributor readiness

- **Purpose:** Make the reviewed checklist usable throughout execution through
  explicit proof recording and read-only readiness reporting.
- **Boundary:** Include the Execution Plan template, review-output record,
  stable-definition retention, ledger receipts, evidence currency, public CLI
  leaves, fixed readiness projections, canonical Execution Planning guidance,
  and generated contract mirrors. Exclude automatic first-edit denial and
  installed-host dispatch.
- **Prerequisites:** Define trustworthy checklist and proof contracts
- **Proof:** Real-process CLI tests exercise both leaves, receipt identity and
  idempotency, current and earlier revisions, review-receipt currency,
  compatibility review, concurrent ledger appends, stable-definition mutations,
  PR-slicing admission, and all four readiness states.
- **Completion signal:** A contributor can inspect and complete an admitted
  checklist through public commands, but ordinary code edits remain governed by
  the pre-existing execution boundary.
- **Relies on an unmerged successor:** no

### Tasks and tests

1. RED: Extend `packages/cli/tests/review/execution-plan-output.test.ts` and
   `packages/cli/tests/cli-protocol/review-wiring.test.ts` so an approving
   plan-execution result must retain scenario-and-approach coverage, the exact
   ordered proof specs and stable checklist definition, reviewed applicability,
   `designApprovalGate`, and the existing slicing record.
2. GREEN: Extend the plan-execution reviewer schema, validator, persistence,
   conformance corpus, and generated rubric/admission assets. Preserve the
   current slicing contract and reject omitted categories or a contributor
   Required proof that is not reviewed as `real_boundary`.
3. GREEN: In the same change that activates those admission rules, replace the
   provisional Execution Plan checklist template with the reviewed
   proof-specification and versioned checklist sections. Update the canonical
   Execution Planning guidance, regenerate every host mirror from canonical
   sources, and run schema and parity tests. The repository must never enforce
   a plan shape its own template cannot produce.
4. MIGRATE: Before any later slice can activate the first-execution consumer,
   update this ticket's own in-flight `execution-plan.md` to the new versioned
   checklist shape and obtain a fresh plan-execution review. Preserve the
   accepted slicing and decision records; this is execution-plan migration, not
   a new implementation decision.
5. RED: Add `packages/cli/tests/integration/delivery-proof-ledger.test.ts` for
   command and review methods, foreign ticket/item/Proof ID, failed and stale
   proof, same-item supporting proof, partial-plus-earlier combined gaps,
   compatible-earlier independent review, stale compatibility reasons,
   idempotent retry, write conflict, and concurrent proof/approval appends.
6. GREEN: Append `delivery-proof:v1` only after a successful retained command or
   admitted current review. Bind the event to ticket, item, Proof ID, method,
   reviewed boundary, revision, invocation, output, outcome, and idempotency key.
   Atomically update the Markdown row only if the complete plan snapshot is
   unchanged; preserve an already-written receipt across a retry.
7. RED: Add `packages/cli/tests/integration/delivery-checklist-cli.test.ts` for
   `contributor_work_incomplete`, `contributor_work_complete`,
   `ready_for_human_review`, and
   `human_approval_satisfied_merge_pending`; prove contributor-editable text
   cannot manufacture approval or merge authority.
8. GREEN: Add `ticket delivery-checklist` and
   `ticket record-delivery-proof` to the typed catalogue and public handlers.
   Use the standard v1 envelope and fixed state/exit mapping from the approved
   Implementation Plan. After a successful proof, return the next open
   obligation without introducing a per-TDD-step hook.
9. RED/GREEN: Add `packages/cli/tests/integration/delivery-checklist-update.test.ts`
   for reviewed `not_applicable`, human `pending_human`, contributor owner
   rejection, unreadable plan refusal, partial progress, `designApprovalGate`
   drift, and every stable-definition mutation through every public consumer.
10. REFACTOR: Centralize stable-definition comparison and ledger decoding; keep
   human-readable rendering at the CLI edge and avoid a JSON/YAML mirror.
11. Run:
   `node ./node_modules/vitest/vitest.mjs run tests/review/execution-plan-output.test.ts tests/cli-protocol/review-wiring.test.ts tests/integration/delivery-proof-ledger.test.ts tests/integration/delivery-checklist-cli.test.ts tests/integration/delivery-checklist-update.test.ts`.
12. Run:
    `node ./node_modules/vitest/vitest.mjs run tests/schema.test.ts tests/parity.test.ts tests/review/execution-plan-rubric-generation.test.ts`.
13. Run: `bun run typecheck`.

## PR 3 — Require the admitted checklist before feature execution

- **Purpose:** Compose the checklist with the first execution boundary and ship
  the canonical authoring and recovery guidance.
- **Boundary:** Include the shared prerequisite evaluator, source-level pre-tool
  composition, public CLI recovery documentation, and direct process proof.
  Exclude templates and generated contract mirrors, which ship with PR 2;
  installed-host parity and lifecycle rollout, which YCFFNC owns; and the
  broader phase-provenance contract, which 7CAMAD owns.
- **Prerequisites:** Record proof and report contributor readiness
- **Proof:** A real helper process denies missing accepted scenarios, accepted
  approach, and checklist admission in deterministic order, permits a current
  admitted checklist, leaves task and patch edits untouched, exempts legacy
  tickets, and never authorizes an edit the phase gate denied. Machine-contract
  and targeted hook tests prove the activated boundary and recovery output.
- **Completion signal:** The shared CLI-owned boundary refuses new-flow feature
  execution until the accepted prerequisites and Delivery Checklist exist;
  legacy work stays unblocked and all packaged derivatives are current.
- **Relies on an unmerged successor:** no

### Tasks and tests

1. RED: Add focused cases to the hook integration suite for missing scenarios,
   missing approach, both missing in stable order, missing or stale checklist,
   admitted checklist, task and patch non-activation, legacy exemption, and a
   legacy ticket returned through `plan-execution`.
2. GREEN: Add one shared prerequisite evaluator after the existing phase-access
   check. It may deny a permitted application/test edit but may never turn a
   denied edit into an allow. Use the phase-provenance input defined by 7CAMAD.
3. RED/GREEN: Invoke the shared evaluator in a real process with a synthetic
   first-edit request. Assert each refusal names the reason, stopped boundary,
   and one concrete repair action; assert there is no checklist-originated
   objection after admission.
4. GREEN: Update public CLI recovery documentation and command discovery for
   the active prerequisite boundary. Do not duplicate the authoring contract
   already shipped by PR 2.
5. REFACTOR: Keep host adapters thin around the shared evaluator; do not add a
   second prerequisite implementation.
6. Run:
   `node ./node_modules/vitest/vitest.mjs run tests/integration/hooks.test.ts tests/hooks/plan-gate.test.ts tests/cli-protocol/catalog.test.ts tests/cli-protocol/machine-contract.test.ts`.
7. Run: `bun run typecheck`.
8. Run the repository's final targeted verification for every A639WN-owned test,
   then the full suite once before completion.

## Obligation ownership

| Accepted obligation | Owning PRs |
| --- | --- |
| R1 checklist admission before execution | PR 3 |
| R1 missing scenarios and approach recovery | PR 3 |
| R2 all eleven default categories and omission denial | PR 1, PR 2 |
| R3 complete, not-applicable, and pending-human dispositions | PR 1, PR 2 |
| R3 contributor-work owner enforcement and partial progress | PR 2 |
| R3 unreadable Execution Plan refusal without regeneration | PR 1, PR 2 |
| R4 checklist lives only in the feature Execution Plan | PR 2, PR 3 |
| R4 task and patch work receive no feature artifacts | PR 3 |
| R5 one-versus-many slicing outcome and unresolved denial | PR 2 |
| R6 contributor and human readiness without invented authority | PR 2 |
| R7 current, reusable-earlier, partial, and missing evidence | PR 1, PR 2 |
| R7 earlier partial evidence keeps both gaps open | PR 2 |
| Safeword CLI shared workflow contract | PR 2, PR 3 |
| Canonical authoring, command, and recovery documentation | PR 2, PR 3 |
| Architecture record for retained checklist and proof evidence | completed before this plan; verified in PR 1 |
| Migration | PR 3 — new-flow activation only; existing implement/verify tickets remain exempt |
| Rollout | PR 3 — source-level activation remains behind 7CAMAD provenance and YCFFNC host rollout |
| Rollback | PR 3 — remove the prerequisite composition; unknown ledger events remain inert and readable |

## Deferred scope ownership

- 7CAMAD owns the complete current-plan authorization boundary and phase
  provenance used by the first-execution consumer.
- 5F5ZZA owns invalidation for other plan context and authenticated host-user
  provenance.
- YCFFNC owns installed-host delivery, parity, activation, rollback, and the
  real-boundary proof that each host dispatches the shared guard.
- 3EG00H owns proportionate task and patch checklist behavior.
- K3EBHB owns final cross-host plain-language recovery copy.

## Decision accounting

- Use one typed, human-readable Delivery Checklist section as the only checklist source of truth: unchanged
- Separate stable checklist obligations from mutable progress: unchanged
- Derive readiness from checklist state without granting authority: unchanged
- Bind current proof to repository HEAD until narrower relevance can be proven safely: unchanged
- Expose readiness and proof recording as separate public ticket leaves while reusing the executable-attestation worker and review ledger: unchanged
- Require independent quality review before earlier proof becomes reusable completion evidence: unchanged

## Delivery checklist

- Tests: Each PR has targeted RED/GREEN proof above; PR 3 runs all A639WN tests,
  typecheck, and one final full suite before completion.
- Monitoring: CLI outcomes expose typed refusal codes and fixed exit statuses;
  runtime performance monitoring is `skip: local CLI workflow adds no service or production telemetry boundary`.
- Migration: Preserve already-implementing tickets through the documented
  provenance exemption; returning through `plan-execution` opts into the new
  checklist contract.
- Documentation: Update the Execution Plan template, canonical Execution
  Planning guidance, public command discovery, and generated host mirrors.
- Rollout: Land inert contracts, then explicit public operations, then boundary
  composition. YCFFNC owns installed-host activation.
- Rollback: Remove boundary composition first; retain unknown
  `delivery-proof:v1` events as authority-inert ledger history, then remove
  unused public leaves and contracts if activation is withdrawn.
- Ownership: A639WN owns the checklist, evidence, readiness, and shared
  prerequisite contracts. 7CAMAD, 5F5ZZA, YCFFNC, 3EG00H, and K3EBHB own the
  explicitly deferred integration work listed above.
