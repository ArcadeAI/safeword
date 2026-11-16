# Execution Plan: Preserve disagreements without false approval

**Status:** planned
**Prepared on:** 2026-11-14

## Pull-request slicing

**Decision:** one pull request

**Rationale:** Recording a dispute, interpreting its gate effect and recovering
its pending question are one trust boundary. Shipping only the writer or only
admission would leave contradictory authority. Use incremental TDD commits
inside this slice; this plan does not authorize opening, promoting or merging a PR.

## PR 1 — Record and enforce disputed planning findings

- **Purpose:** Preserve actionable disagreements while keeping user scope and review approval honest.
- **Boundary:** The 27 accepted scenarios, existing disposition command, authenticated coordinator, planning identity/admission, shared host guidance and their proof; no provider installation, qualification, route changes, converter dependencies, OpenCode delivery or mixed-version enforcement.
- **Prerequisites:** Accepted Implementation Plan; matching isolated plugin; repair e20017aef / #7501 available in that installation. The old exhausted review remains historical. Actual cloud sessions require the human operator's access.
- **Proof:** CLI routing, persistence and admission integration suites, existing fallback and disposition regressions, generated/parity checks, and native-host runs described below.
- **Completion signal:** All 27 scenario obligations have current evidence, required native runs are recorded, and unresolved disputes cannot grant approval. Until then this slice remains incomplete.
- **Relies on an unmerged successor:** no; #7501 is a separately prepared prerequisite, not a future slice that makes an unsafe intermediate feature merge safe.

### Tasks and tests

1. **First RED — pending question survives the producer process.** Add
   `tests/integration/planning-dispute-persistence.test.ts`, reusing
   `createConfiguredProject`, `runCli`, `testCliPath` and the trusted external
   reviewer-process fixtures. Generate a real authenticated planning review
   through the CLI, then invoke the installed disposition entry point without
   input for an unaccepted scope proposal. A second OS process reads the same
   finding after the producer exits. Assert the saved finding/question/action,
   unchanged approval, no input wait and no exported integrity key. Before the
   production edit, run
   `../../scripts/dev bun run test tests/integration/planning-dispute-persistence.test.ts`
   from `packages/cli`. RED must name the missing durable pending disposition,
   not merely a missing fixture or crashed process. Preserve the output and
   commit reference in the ledger. This proves process survival, not reclaimed-cloud survival.

2. **First GREEN — minimal portable question.** Extend
   `src/commands/review-disposition.ts` and its existing CLI registration to
   accept explicit dispute class, reason and supporting requirement/plan text,
   preserving the legacy decline invocation. Reuse the authenticated job lookup,
   ticket lock, CAS and atomic rename. Save the versioned finding, origin,
   plan/boundary bindings, evidence, disposition and one action in the ticket.
   Repeating the same request displays the same question idempotently. A copied
   question may be displayed after local authority is lost but cannot authenticate
   a terminal resolution or approval. No new store or handoff service.
   Run the same test to GREEN; assess refactoring only after it passes.

3. **Attempt the actual handoff before broadening implementation.** Use this
   producer/consumer fixture through the installed CLI on each native host.
   For Claude Code Cloud and Cursor Cloud Agents, retain the producer's ordinary
   authorized branch/artifact handoff containing both ticket and exact reviewed
   plan, confirm it, reclaim the original runner, and invoke the consumer from a
   new session. Retain provider/session evidence and original output; never
   preseed the pending record in the consumer. Check that no private key traveled,
   the same question is recovered and approval is unchanged. A failed or
   unavailable native run stays explicitly missing and triggers the accepted
   Implementation Plan reassessment; it is not converted into a local passing
   test or a new deferral. Human access is pending, as recorded below. Tasks 4–8
   cannot begin until this checkpoint records native evidence or records the
   unavailable run and returns through the required design reassessment.

4. **RED/GREEN routing and scope.** Add
   `tests/integration/planning-dispute-routing.test.ts` using the same real CLI
   fixture. Cover nonblocking advice, correctness/relevance blockers, unsupported
   classes, missing evidence/origin, optional classification, exhausted routes
   and user acceptance/decline. Obtain findings from both approved and
   changes-requested authenticated reviews. Refuse originating-family sole
   adjudication even through fallback. Only classification dispatch uses the
   existing configured routes; correctness disagreement never dispatches an
   arbitrator. With no eligible classifier, retain the user question.
   Originally nonblocking advice remains eligible; an unsupported optional label
   cannot clear an in-scope blocker. Scope proposals from any actor leave scope
   unchanged until the existing user-interaction boundary confirms the choice.
   Pending additions are not required work; pending removals/narrowings do not
   remove existing obligations. Pair real interactive confirmation with
   non-TTY/no-input refusal; never use an agent-supplied noninteractive answer as
   user authority. Confirm an in-scope omission repair needs no new scope choice.
   RED names the incorrect disposition or gate effect; GREEN is the minimum
   router/writer change. Run the suite after each behavior group.

5. **RED/GREEN freshness and admission.** Add
   `tests/integration/planning-dispute-admission.test.ts`. Exercise public
   review/status/approve-plan boundaries, with a second ticket as the isolation
   control. Reuse main 02a996e7c's `planning-context-identity.ts` (#5766):
   extend that owner's typed-record projection rather than introducing another
   freshness mechanism. Preserve existing per-kind decline invalidation.
   Pending/log-only records cannot stale a review or qualify a retry; material
   scope/classification changes invalidate the affected review and downstream
   dependencies. Pair current/stale provenance claims in both directions.
   Bind correction evidence to each unresolved finding and changed decision.
   Reject cosmetic or unrelated rerolls. Extend the existing planning packet,
   structured reviewer output validation and canonical reviewer guidance only
   as needed to carry the accepted per-finding correction judgment. Require
   every prior blocker to be explicitly addressed by the authenticated fresh
   verdict; a generic pass cannot silently clear it. The originating reviewer's
   unresolved correction judgment remains nonterminal and names the author and
   next action. Vary prior corrected passes, including counts above three,
   without adding a production pass counter. GREEN includes gate refusal for
   unaddressed findings and permission for a fresh exact-plan passing review.
   Run existing `planning-review-disposition.test.ts`,
   `planning-review-fallback.test.ts` and `plan-design-approval.test.ts` as
   regressions after the new suite passes. Include pending_human native-local,
   native-cloud and rollout-rollback rows in the execution fixture; after each
   real status/admission call, parse the persisted plan and assert those rows
   and their named dependencies remain pending and are never reported satisfied.

6. **RED/GREEN failure and recovery controls.** Within the persistence and
   routing suites, pair successful write with contention/CAS conflict, failed
   rename and crash boundaries; verify old-or-new state, no authority from
   failed writes, and identical retries without duplicate records or jobs.
   Preserve history on unknown versions, mismatched plan/boundary or a fresh
   review that no longer contains the saved finding. Return the exact pending
   question and its user-owned reconciliation action, not a replacement.
   Test offline recording/comparison separately from unavailable network effects.
   Check changed/healthy/action_required/failed CLI envelopes and exit codes.
   Use a five-second no-input process budget and 30-second handoff-confirmation
   proof budget, excluding separately running review jobs. Wire the accepted
   scope/dispute outcomes through the real CLI, not only pure helpers.

7. **REFACTOR and host/document integration.** Assess duplication after the
   behavior suites pass; skip new abstractions without a concrete repeated
   responsibility. Keep one writer/router and one identity owner. Update source
   workflow guidance and customer documentation in
   `packages/website/src/content/docs/reference/cli.mdx` and
   `packages/website/src/content/docs/getting-started/workflow.mdx` for the dispositions, user scope,
   nonblocking extras, unresolved blockers, reduced classification availability,
   durable handoff limits, advisory Codex Cloud status, and the coordinated-upgrade/no-rollback requirement.
   Messages lead with a plain reason and one action; IDs support the explanation.
   PR 1 also reconciles the existing “Disputed Planning Findings” entry in
   ARCHITECTURE.md against implemented behavior and retained proof, without
   changing the accepted ownership/trust decision. Preserve the prior proposal
   history and distinguish local implementation from unproven native behavior.
   Completion requires the documentation review to confirm that record matches
   the implementation and makes no unsupported approval or delivery claim.
   Native interactive runs cover Claude Code, local Codex and Cursor; native
   no-input runs cover those and the two cloud hosts, including both pending
   scope and unresolved correctness. Carry their dispute messages to the
   parent's NTB1.R4 walkthrough; do not claim comprehension from code tests.

8. **Complete proof and verification.** Bind all 27 scenario headings and every
   outline row to the new integration tests through the existing
   `@proof.vitest`/BDD-proof manifest mechanism where that lane is sufficient;
   do not use it to claim native-cloud evidence. Preserve unchecked R/G/R until
   real evidence exists. Edit source templates first, run
   `scripts/dev bun packages/cli/scripts/check-generated-surfaces.ts --fix`
   (catalogue before plugins; fixtures last), then
   `scripts/dev bun scripts/parity-check.ts --fix`. Run Gherkin and
   BDD-proof-registry checks. Run targeted suites serially through the test-lock
   wrapper; a waiting/timed-out run is not GREEN. Finally run package tests,
   typecheck and lint, independent quality review, verify and diff-scoped audit.
   Reconcile `impl-plan.md` to implemented only after its decisions and required
   evidence actually hold. Keep release/Ready/merge authority unchanged.

## Obligation ownership

Every row is owned by PR 1; proof groups name concrete suites or native runs.

| Accepted obligation | Owning PRs |
| --- | --- |
| R1 origin, missing provenance, fresh classifier and exhausted-origin fallback | PR 1 — routing suite |
| R2 supported classes, evidence and logged blocking/nonblocking effects | PR 1 — routing and admission suites |
| R2 scope choices from every actor; in-scope omission; unrelated ticket progress | PR 1 — routing and admission suites |
| R2 provenance normalization and both disputed-currency directions | PR 1 — admission suite, existing identity regressions |
| R3 nonblocking optional states, independently corrected blocking labels, no scope expansion or dismissed in-scope defects, accepted unfinished work | PR 1 — routing and admission suites |
| R4 prompt durable pending, real-run later recovery, available-user choice and headless unresolved correctness | PR 1 — persistence/routing suites plus every named native-host run |
| R5 disposition/action matrix, fresh correction verdict, retry refusal and variable corrected-pass counts | PR 1 — admission/routing suites |
| Atomic writes, CAS/crash/idempotency, compatibility, private-key containment, offline/error behavior | PR 1 — persistence/routing suites |
| Source/installed parity, documentation, NTB walkthrough inputs, coordinated activation and no rollback over unresolved records | PR 1 — generated/document checks and human evidence |
| Reconcile the existing Disputed Planning Findings architecture record to actual implementation and proof while preserving accepted ownership/trust decisions | PR 1 — Task 7 and docs-review; record matches implementation without unsupported completion claims |

## Deferred scope ownership

- Historical missing RED, failed runs and all 33 deferred cases remain exactly
  as recorded; this slice neither completes nor rewrites them.
- OpenCode delivery/proof is excluded by the user; #7491 owns later consideration.
- #7481 owns author-model assurance work, #7438 the underlying planning-loop
  investigation, and #7501 the separately prepared installation repair.
- General YCFFNC activation work remains owned there; this slice still owns
  proving its accepted behavior on every in-scope host.
- No accepted local scenario is discharged by naming another ticket.

## Decision accounting

- Extend existing disposition and admission: unchanged.
- Portable question, current local authority: unchanged.
- Atomic history and stable admission: unchanged; #5766 is reused in its existing owner.
- User-updated scope: OpenCode excluded, updated participating hosts required,
  automatic mixed-version protection excluded; unchanged.

## Proof specifications

| Proof ID | Method | Scope | Boundary exercised | Qualifies as | Currency | Invocation |
| --- | --- | --- | --- | --- | --- | --- |
| dispute-cli | command | integration | Real public disposition/admission CLI with real ticket writer and authenticated coordinator; reviewer process alone is simulated | real_boundary | current_required | {"type":"command","cwd":"packages/cli","argv":["../../scripts/dev","bun","run","test","tests/integration/planning-dispute-routing.test.ts","tests/integration/planning-dispute-admission.test.ts","tests/integration/planning-dispute-persistence.test.ts"]} |
| existing-regressions | command | integration | Existing public disposition, fallback and design-approval flows | real_boundary | current_required | {"type":"command","cwd":"packages/cli","argv":["../../scripts/dev","bun","run","test","tests/integration/planning-review-disposition.test.ts","tests/integration/planning-review-fallback.test.ts","tests/integration/plan-design-approval.test.ts"]} |
| generated-parity | command | integration | Generated/install contract and registered surfaces | real_boundary | current_required | {"type":"command","cwd":".","argv":["scripts/dev","bun","packages/cli/scripts/check-generated-surfaces.ts"]} |
| full-package | command | integration | CLI package behavior and regressions | real_boundary | current_required | {"type":"command","cwd":"packages/cli","argv":["../../scripts/dev","bun","run","test"]} |
| docs-review | review_receipt | integration | User-visible workflow and recovery instructions, judged against accepted behavior | real_boundary | current_required | {"type":"review_receipt","kind":"quality-review","targets":["packages/cli/templates/skills/bdd/PLAN_IMPLEMENTATION.md","packages/cli/templates/skills/bdd/PLAN_EXECUTION.md","packages/website/src/content/docs/reference/cli.mdx","packages/website/src/content/docs/getting-started/workflow.mdx","ARCHITECTURE.md"]} |
| sequence-review | review_receipt | eval | Accepted slice cohesion and dependency safety | real_boundary | current_required | {"type":"review_receipt","kind":"plan-execution","targets":[".project/tickets/26FK42-resolve-disputed-plan-findings/execution-plan.md"]} |
| completion-review | review_receipt | eval | Truthfulness of retained verification and outstanding evidence | real_boundary | current_required | {"type":"review_receipt","kind":"quality-review","targets":[".project/tickets/26FK42-resolve-disputed-plan-findings/verify.md"]} |
| source-parity | command | integration | Source and dogfood reference parity | real_boundary | current_required | {"type":"command","cwd":".","argv":["scripts/dev","bun","scripts/parity-check.ts"]} |

## Delivery checklist

<!-- safeword:delivery-checklist:v1 -->

| ID | Category | Obligation | Owner | Required proof | Disposition | Evidence class | Revision | Evidence, reason, or dependency |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| outcome-scope | outcome and scope | Local CLI mechanics and non-native scenario partitions only; native R4 partitions additionally require native-cloud and native-local | contributor | dispute-cli | open | missing | | |
| resolved-decisions | resolved decisions | Existing writer/router and identity owner implement the approved decisions | contributor | dispute-cli | open | missing | | |
| pr-decomposition | dependency and pull-request decomposition | Reviewed sequence has one coherent slice with no unsafe writer-only delivery | contributor | sequence-review | open | missing | | |
| testing | testing | CLI integration and existing regression suite pass | contributor | full-package | open | missing | | |
| native-cloud | testing | Real producer/handoff/reclaimed-runner/consumer on Claude Code Cloud and Cursor Cloud Agents | human | | pending_human | missing | | Human operator supplies authenticated native sessions and retains provider output; cannot be replaced with seeded/local proof |
| native-local | testing | Interactive and no-input dispute flows on Claude Code, local Codex and Cursor | human | | pending_human | missing | | Human operator runs installed workflows in each native host; CLI simulation is supporting evidence only |
| data-compatibility | data and compatibility | Portable versioned questions, atomic writes and honest old-record handling | contributor | dispute-cli | open | missing | | |
| generated-delivery | data and compatibility | All five generated delivery surfaces match their sources | contributor | generated-parity | open | missing | | |
| source-installed | data and compatibility | Source and installed dogfood references agree | contributor | source-parity | open | missing | | |
| monitoring | monitoring and failure signals | Every unresolved/error result names disposition and one recovery action | contributor | dispute-cli | open | missing | | |
| security-privacy | security and privacy | Origin provenance enforced; exported question contains no integrity key or approval authority | contributor | dispute-cli | open | missing | | |
| rollout-rollback | rollout and rollback | Coordinated updated hosts; no rollback over unresolved disputes | human | | pending_human | missing | | YCFFNC activation owner confirms participating installations before use |
| documentation | documentation | Plain-language scope, blockers, recovery and limits match behavior | contributor | docs-review | open | missing | | |
| ntb-walkthrough | documentation | Distinct dispute/pending messages support the parent's NTB walkthrough | human | | pending_human | missing | | Parent NTB1.R4 owner retains comprehension evidence |
| ownership-dependencies | ownership and human dependencies | Public status/admission leaves native-host and activation rows pending_human with their named dependencies unchanged | contributor | dispute-cli | open | missing | | |
| completion-evidence | completion evidence | Verify report accurately records tests, audit and outstanding native/human evidence; it does not discharge those separate obligations | contributor | completion-review | open | missing | | |
