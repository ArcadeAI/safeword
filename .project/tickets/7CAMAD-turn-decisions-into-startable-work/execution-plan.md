# Execution Plan: Turn accepted decisions into startable work

**Status:** planned
**Prepared on:** 2026-09-16

## Pull-request slicing

**Decision:** multiple pull requests

**Rationale:** The shared public authorization contract, its two enforcement
consumers, and the complete replanning/workflow proof are independently valuable
and independently provable. The command can merge inertly before any hook
consumes it; enforcement can then merge with its canonical guidance and host
derivatives; the final journey slice proves retained evidence, rollback, and
cold-start behavior without hiding those concerns inside the gate wiring. These
boundaries follow authority and proof, not line or file counts.

Dependency-owned contracts from G1C9PP, 5F5ZZA, 6XW8H7, and A639WN must be
present in the merge branch with their targeted tests green before PR 1 starts.
If one is absent or changes incompatibly, stop at that prerequisite; do not
copy, stub, or locally redefine the sibling contract.

## PR 1 — Expose one coding-authorization contract

- **Purpose:** Give builders and both later hook consumers one inspectable,
  read-only answer to whether coding is currently authorized.
- **Boundary:** Add `ticket coding-authorization <ticketId>` over the existing
  prerequisite service; include typed denial identities, complete
  authorization-input identity, catalogue/handler/reference wiring, and exact
  Product/Implementation/Execution Plan currentness. Exclude hook activation,
  RED ordering, workflow guidance, and host regeneration.
- **Prerequisites:** none
- **Proof:** A real CLI integration varies every authorization input and proves
  the closed result cannot claim implementation, verification, release
  approval, or merge authority. A source assertion proves this command is the
  only prerequisite-composition entry point intended for coding consumers.
- **Completion signal:** The installed CLI returns one deterministic
  authorization or denial identity, advertises no network/destructive effect,
  and no production edit or phase transition invokes it yet.
- **Relies on an unmerged successor:** no

### Tasks and tests

1. RED: Add
   `packages/cli/tests/integration/coding-authorization.test.ts`. Through the
   installed CLI, assert authorization for current scenario, implementation,
   design-approval, and execution receipts; then separately mutate `spec.md`,
   approved feature bytes, normalized ticket `scope`/`out_of_scope`/`done_when`,
   `impl-plan.md`, stable `execution-plan.md` definition, and ordinary Delivery
   Checklist progress. Assert every stable upstream mutation denies, ordinary
   progress does not, and a fresh affected review restores authorization.
2. RED: In the same file, cover absent artifact, missing receipt, stale receipt,
   rejected verdict, missing achieved independence, unearned assurance,
   permitted fallback with actual assurance retained, disregarded author-written
   independence, unreadable state, configured human approval changes, and an
   unavailable prerequisite service. Cover all three monotonic M1 markers and a
   legacy ticket with none. Assert removing or downgrading a prerequisite from
   a marked ticket denies rather than exempts it.
3. RED: Assert the result shape grants coding authorization only. Attempts to
   infer implementation completion, verification, human release approval, or
   merge authority must fail. Assert a complete authorization-input identity
   changes with configuration, human approval, validated provenance, or any
   stable plan identity.
4. GREEN: Add the smallest read-only authorization projection over
   `evaluateExecutionPrerequisite`; do not reimplement its three prerequisite
   checks. Register `ticket coding-authorization <ticketId>` in the typed
   catalogue and public handler with schema-v1 JSON, `--no-input`, local-only
   read effects, deterministic fixtures, standard exit mapping, CLI reference,
   and command discovery.
5. REFACTOR: Keep receipt parsing, plan normalization, and prerequisite
   composition in their existing owners. Add a source-level assertion in
   `coding-authorization.test.ts` that the public command has one
   prerequisite-composition owner; consumer wiring stays in PR 2. Do not create
   a general dependency linter.
6. Run:
   `bun run test tests/integration/coding-authorization.test.ts tests/integration/delivery-execution-prerequisite.test.ts tests/cli-protocol/catalog.test.ts tests/cli-protocol/cli-documentation-contract.test.ts`.
7. Run: `bun run lint`.

## PR 2 — Enforce authorization at both coding boundaries

- **Purpose:** Make the reviewed Execution Plan a real prerequisite at
  `plan-execution → implement` and at every later production-code edit.
- **Boundary:** Wire the public result into the transition and production-edit
  hooks; add phase/provenance hardening, `plan-execution` code freeze, planning
  denial before executable RED, canonical BDD/handbook/architecture guidance,
  and regenerated repository-owned host derivatives. Exclude installed-host
  migration and final progressive recovery wording.
- **Prerequisites:** Expose one coding-authorization contract.
- **Proof:** Real hook subprocess tests show both boundaries return the same
  authorization/denial identity. Combined stale-plan plus unmet-RED state
  surfaces plan repair first. Editable phase text alone cannot activate the
  gate, while loss of a durable new-flow prerequisite cannot deactivate it.
- **Completion signal:** A contracted feature cannot enter or continue coding
  under stale plans, a legacy feature without any M1 marker remains unchanged,
  and canonical plus generated workflow guidance describes that exact window.
- **Relies on an unmerged successor:** no

### Tasks and tests

1. RED: Extend
   `packages/cli/tests/integration/plan-transition-gate.test.ts` so implement
   entry requires the project-local `execution-plan.md` and the exact public
   authorization result. In that same real transition harness, bind
   `plan-implementation → plan-execution` to the absent, unreviewed, stale,
   rejected, and unearned-independence Implementation Plan partitions. Cover
   current authorization, each denial identity, fresh re-review, mutable phase
   without provenance, and authenticated new-flow provenance whose later
   prerequisite disappears.
2. RED: Add
   `packages/cli/tests/integration/coding-authorization-hook.test.ts`. Invoke the
   real pre-tool hook against a production-file edit and assert: current plans
   allow; a stable plan edit denies; fresh review restores; a stale plan plus
   unmet named RED reports plan repair first; after plan repair the same edit
   reports the named RED. Assert host-local scratch notes cannot authorize
   coding when the project-local Execution Plan is absent or stale, and that
   recovery names that project-local `execution-plan.md` as the artifact to
   create or repair. Assert one local CLI subprocess, no network/lifecycle work,
   and no recurring prompt injection.
3. GREEN: Update phase evidence, provenance anchors, planning code freeze, and
   the transition gate for `plan-execution`. Make both hook consumers delegate
   to the public authorization entry point. Activate production-edit checks for
   any authenticated phase provenance, admitted Execution Plan review, or
   project-local Execution Plan; never activate from mutable phase text alone.
4. GREEN: Update the canonical BDD skill, `PLAN_EXECUTION.md`, Safeword
   handbook, prompt/resume/stop guidance, and the accepted planning-gates
   architecture record. State clearly that the public command has no legacy
   exemption while per-edit M1 activation uses durable markers until YCFFNC
   completes migration.
5. GREEN: Regenerate Claude, Cursor, Codex, and OpenCode-owned derivatives with
   the repository generators and parity fixer. Never hand-edit a derivative.
6. REFACTOR: Keep the hook as a thin renderer/dispatcher. Add a source-level
   assertion in `coding-authorization-hook.test.ts` that both coding-boundary
   consumers import the public authorization entry point, and fail if either
   computes a prerequisite inline. Remove any duplicate authorization or
   plan-currentness calculation discovered during wiring; do not create a
   general dependency linter.
7. Run:
   `bun run test tests/integration/plan-transition-gate.test.ts tests/integration/coding-authorization-hook.test.ts tests/hooks/phase-provenance.test.ts tests/skills/implementation-plan-repair-loop.test.ts`.
8. Run:
   `bun run test tests/parity.test.ts tests/schema.test.ts tests/npm-package.test.ts`.
9. Run: `bun run lint`.

## PR 3 — Prove cold-start delivery and dependency-directed replanning

- **Purpose:** Prove a fresh agent can move from an accepted Implementation Plan
  through a reviewed Execution Plan to the first RED, then recover from both
  implementation-time replan branches without losing or promoting evidence.
- **Boundary:** Add end-to-end journey, compatibility, rollback, resume-point,
  and remaining semantic-conformance proof plus any minimal adapter correction
  those tests expose. Exclude sibling review transport, evidence taxonomy, host
  migration, final NTB copy, and public rollout documentation.
- **Prerequisites:** Enforce authorization at both coding boundaries.
- **Proof:** Git-backed installed-CLI integration covers all R1–R17 partitions,
  the first executable RED, sequencing-only and design-changing replans,
  byte-identical retained evidence class without re-execution, invalidated proof
  becoming audit-only, resumption at the first reopened obligation, and rollback
  of a ticket parked at `plan-execution`.
- **Completion signal:** The cold-start journey reaches the named RED without an
  invented decision; both replan routes re-review only the affected plans and
  resume at the first invalidated obligation; the documented rollback returns
  in-flight tickets to `plan-implementation` before removing the phase.
- **Relies on an unmerged successor:** no

### Tasks and tests

1. RED: Add
   `packages/cli/tests/integration/plan-execution-journey.test.ts` using a real
   temporary Git repository and installed CLI. Start from approved scenario and
   Implementation Plan receipts, author/review a complete Execution Plan, enter
   implementation, run the named RED, and assert production code could not
   precede it.
2. RED: In the same journey, change only independent task order and assert only
   the Execution Plan review becomes stale. Re-review it, then assert work
   resumes from the first reordered task and the earlier proof retains its
   byte-identical A639WN class with no new proof-execution receipt.
3. RED: Change the accepted authorization approach and assert both plans become
   stale. Run the retained-boundary `delivery-compatibility` decision for proof
   that remains valid; demote proof invalidated by the changed contract to
   audit-only, reopen that obligation, and assert it is the first work item on
   resume.
4. RED: Cover the complete conformance partitions not owned by the two hook
   tests: missing/mismatched canonical contracts; fixture and test-command
   changes; first and later unstartable steps; empty plans; risk-first ordering;
   explicitly parallel-safe work; discovery routing; disguised unresolved data
   decisions; omitted, partially mapped, completely mapped, unowned rollback,
   and explicitly obligation-free work; one- and multi-purpose PR shapes;
   defect-versus-target; pending human authority; all four evidence classes;
   partial-proof rejection; measurement work; every downstream-authority
   rejection; and the structural gate's present-and-valid, absent, and
   present-but-unreadable artifact states. For every structural state, assert
   the report describes facts without calling the plan implementable, approved,
   or ready for coding.
5. RED/GREEN: Add a rollback fixture parked at `plan-execution`. Exercise the
   real backward ticket transition to `plan-implementation`, retain its plans,
   reviews, and ledger rows as inert history, then prove the reduced phase model
   can read and continue the ticket. Do not add a general migration framework.
6. RED/GREEN: Assert K3EBHB remains an epic release dependency for progressive
   NTB recovery and YCFFNC remains the installed-host migration owner. If either
   boundary is absent, fail the epic-completion proof rather than expanding this
   child.
7. REFACTOR: Keep the cold-start fixture declarative and reuse production
   commands. Do not encode a second execution-plan validator in test helpers.
8. Run:
   `bun run test tests/integration/plan-execution-journey.test.ts tests/review/execution-plan-conformance.test.ts tests/integration/delivery-checklist-cli.test.ts`.
9. Run: `bun run test`.
10. Run: `bun run lint`.

## Obligation ownership

| Accepted obligation | Owning PRs |
| ------------------- | ---------- |
| R1 reviewed current approach controls Execution Planning | PR 1, PR 2 |
| R2 every step is startable and risk-first | PR 3 |
| R3 canonical author/reviewer contract identity | PR 3 |
| R4 discoveries return to the owning phase | PR 3 |
| R5 project-local Execution Plan lifecycle | PR 2, PR 3 |
| R6 disguised unresolved data decisions are rejected | PR 3 |
| R7 structural gates report facts only | PR 1, PR 3 |
| R8 accepted proof becomes exact test work | PR 3 |
| R9 current Execution Plan authorizes coding | PR 1, PR 2 |
| R10 every accepted obligation maps to startable work | PR 3 |
| R11 Execution Planning supplies rather than replaces TDD | PR 2, PR 3 |
| R12 current/target state and A639WN evidence currency | PR 3 |
| R13 Delivery Checklist and independently reviewable slices | PR 3 |
| R14 approval claims only startable, provable delivery | PR 1, PR 3 |
| R15 measurement decisions become execution work | PR 3 |
| R16 invalidation follows Product → Implementation → Execution | PR 1, PR 3 |
| R17 replanning preserves valid proof and resumes at first invalidated obligation | PR 3 |
| Safeword CLI command and local hook surface | PR 1, PR 2, PR 3 |
| M1 migration window and monotonic new-flow markers | PR 1, PR 2 |
| Rollback of persisted `plan-execution` tickets | PR 3 |
| Canonical workflow and architecture documentation | PR 2 |

## Deferred scope ownership

- G1C9PP owns Implementation Plan approval and the schema-owned Execution Plan
  scaffold.
- 5F5ZZA owns review transport, achieved-independence provenance, and fallback
  policy.
- 6XW8H7 owns the canonical Execution Planning semantic/slicing contract and
  reviewer admission.
- A639WN owns Delivery Checklist parsing, proof currency, and
  `delivery-compatibility:v1`.
- K3EBHB owns progressive plain-language recovery and must complete before the
  epic ships; this child proves only typed identities and ordering.
- YCFFNC owns installed-host migration/activation and public rollout guidance.

## Decision accounting

- Derive coding authorization once and consume it at both coding boundaries: unchanged
- Expose `ticket coding-authorization <ticketId>` through the public typed CLI: unchanged
- Keep semantic and structural responsibilities separate: unchanged
- Reuse content-bound review identity for dependency-directed replanning: unchanged
- Preserve TDD as a separate implementation contract: unchanged
- Surface planning repair before executable RED: unchanged
- Activate M1 enforcement without a provenance bypass: unchanged

## Proof specifications

| Proof ID | Method | Scope | Boundary exercised | Qualifies as | Currency | Invocation |
| -------- | ------ | ----- | ------------------ | ------------ | -------- | ---------- |
| authorization-cli | command | integration | Installed public CLI computes the closed coding-authorization result from real project artifacts and receipts | real_boundary | current_required | {"type":"command","cwd":"packages/cli","argv":["bun","run","test","tests/integration/coding-authorization.test.ts","tests/integration/delivery-execution-prerequisite.test.ts","tests/cli-protocol/catalog.test.ts","tests/cli-protocol/cli-documentation-contract.test.ts"]} |
| authorization-hooks | command | E2E | Real transition and production-edit hook subprocesses consume the same public authorization contract | real_boundary | current_required | {"type":"command","cwd":"packages/cli","argv":["bun","run","test","tests/integration/plan-transition-gate.test.ts","tests/integration/coding-authorization-hook.test.ts","tests/hooks/phase-provenance.test.ts"]} |
| semantic-conformance | command | integration | Installed plan-execution review admits the canonical contract and rejects every representative incomplete or decision-changing plan | real_boundary | current_required | {"type":"command","cwd":"packages/cli","argv":["bun","run","test","tests/review/execution-plan-conformance.test.ts","tests/review/execution-plan-output.test.ts","tests/review/packet.test.ts"]} |
| replan-journey | command | E2E | Git-backed installed CLI completes cold start, RED handoff, both replan routes, evidence preservation/demotion, resume, and rollback | real_boundary | current_required | {"type":"command","cwd":"packages/cli","argv":["bun","run","test","tests/integration/plan-execution-journey.test.ts","tests/integration/delivery-checklist-cli.test.ts"]} |
| workflow-parity | command | integration | Canonical phase guidance, templates, schema, and every registered generated host derivative remain synchronized | real_boundary | current_required | {"type":"command","cwd":"packages/cli","argv":["bun","run","test","tests/parity.test.ts","tests/schema.test.ts","tests/npm-package.test.ts","tests/skills/implementation-plan-repair-loop.test.ts"]} |
| full-verification | command | E2E | Complete CLI test suite exercises all supported boundaries without regression | real_boundary | current_required | {"type":"command","cwd":"packages/cli","argv":["bun","run","test"]} |
| lint-typecheck | command | integration | The repository's aggregate lint script runs ESLint, Gherkin validation, and TypeScript compilation against the final change | partial_or_structural | current_required | {"type":"command","cwd":"packages/cli","argv":["bun","run","lint"]} |
| plan-review | review_receipt | eval | Independent plan-execution review preserves scenarios, decisions, slices, owners, proof definitions, and checklist definition | real_boundary | current_required | {"type":"review_receipt","kind":"plan-execution","targets":[".project/tickets/7CAMAD-turn-decisions-into-startable-work/execution-plan.md"]} |

## Delivery checklist

<!-- safeword:delivery-checklist:v1 -->

| ID | Category | Obligation | Owner | Required proof | Disposition | Evidence class | Revision | Evidence, reason, or dependency |
| --- | -------- | ---------- | ----- | -------------- | ----------- | -------------- | -------- | ------------------------------- |
| outcome-scope | outcome and scope | Authorize coding only from current reviewed Product, Implementation, and Execution Plans without granting downstream authority. | contributor | authorization-cli | open | missing | | |
| resolved-decisions | resolved decisions | Preserve every recorded implementation decision, including the public leaf, denial order, and monotonic M1 activation markers. | contributor | plan-review | open | missing | | |
| resolved-contract | resolved decisions | Admit only Execution Plans that preserve the canonical slicing, obligation, evidence, measurement, and startability contract. | contributor | semantic-conformance | open | missing | | |
| pr-decomposition | dependency and pull-request decomposition | Deliver the shared contract, enforcement consumers, and complete journey in three dependency-ordered independently safe PRs. | contributor | plan-review | open | missing | | |
| testing | testing | Complete outside-in RED/GREEN/REFACTOR work and full regression proof through the installed CLI and real hook boundaries. | contributor | full-verification | open | missing | | |
| data-compatibility | data and compatibility | Preserve exact upstream identities, normalized checklist progress, evidence classes, and rollback of persisted phase state. | contributor | replan-journey | open | missing | | |
| monitoring | monitoring and failure signals | Keep authorization local, read-only, no-network, single-subprocess, and synchronously observable through typed denial identities; no production service or SLO is introduced. | contributor | authorization-hooks | open | missing | | |
| security-privacy | security and privacy | Reject editable authority claims, stale receipts, lost new-flow prerequisites, and duplicate prerequisite evaluators without external data egress. | contributor | authorization-cli | open | missing | | |
| rollout-activation | rollout and rollback | Gate new-flow tickets through durable markers while preserving legacy M1 behavior until YCFFNC migration. | contributor | authorization-hooks | open | missing | | |
| rollout-rollback | rollout and rollback | Return parked tickets to Implementation Planning before removing the phase. | contributor | replan-journey | open | missing | | |
| documentation | documentation | Update canonical workflow, architecture, command reference, and every registered host derivative without hand-editing generated copies. | contributor | workflow-parity | open | missing | | |
| ownership-dependencies | ownership and human dependencies | Keep G1C9PP, 5F5ZZA, 6XW8H7, A639WN, K3EBHB, and YCFFNC obligations in their named tickets and block epic completion if required downstream work is absent. | contributor | plan-review | open | missing | | |
| completion-journey | completion evidence | Prove the complete cold-start and replan journeys on final bytes. | contributor | replan-journey | open | missing | | |
| completion-suite | completion evidence | Prove the complete CLI test suite on final bytes. | contributor | full-verification | open | missing | | |
| completion-review | completion evidence | Prove the current Execution Plan passed its required review. | contributor | plan-review | open | missing | | |
