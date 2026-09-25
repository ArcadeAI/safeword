# Execution Plan: Keep plan reviews current and trustworthy

**Status:** planned
**Prepared on:** 2026-09-20

## Pull-request slicing

**Decision:** multiple pull requests

**Rationale:** Approval truthfulness, canonical contract generation, review
identity, fallback routing, and semantic-scope judgment are separate authority
boundaries with separate failure modes. Each can be proved through its real
entry point and merged safely before the next is started. This gives a reviewer
one coherent claim per PR instead of simultaneously rewriting the contract,
provenance, routing, and judgment policy.

The sibling tickets remain authoritative for their concerns: 7CAMAD owns
Execution Plan content and coding authorization, K3EBHB owns final
Non-Technical Builder recovery language, YCFFNC owns installed-host migration
policy, and G1C9PP owns the 30–60 minute reviewability outcome. This ticket
integrates with those contracts without redefining them.

## Current state and diagnosed defect

The repository already has phase-specific reviewers, an authenticated review
coordinator and job store, an append-only review ledger, and phase admission.
It does not yet have one complete planning-context resolver, semantic review
identity, generated shared contract source, or authenticated reduced-
independence receipt path.

During this ticket's Implementation Plan approval, an approved cross-agent
review with warnings still failed `ticket approve-plan`. Phase admission
correctly accepted the authenticated exact-plan receipt, but a second
content-bound `impl-plan` self-stamp check rejected it. The error renderer then
reported findings from the latest approved review because it did not restrict
`latestReviewRejection` to `changes_requested`. A manually added redundant
stamp allowed the transition, confirming both defects. PR 1 fixes them before
the broader provenance changes.

## PR 1 — Make approved planning receipts advance truthfully

- **Purpose:** Ensure the canonical planning gate accepts one authenticated
  current approval and reports only actual rejection findings.
- **Boundary:** Consolidate `approve-plan` on phase admission, remove the
  redundant weaker artifact-stamp prerequisite, and make rejection rendering
  status-sensitive. Include canonical guidance for the one receipt path.
  Exclude new contract generation, semantic context identity, routing changes,
  and reviewer-rubric changes.
- **Prerequisites:** none
- **Proof:** Real CLI integration proves an approved review containing warnings
  advances without an extra artifact stamp, a `changes_requested` verdict
  blocks with its findings, and missing/stale evidence reports its actual typed
  failure rather than findings from an approved review.
- **Completion signal:** `ticket approve-plan` has one authenticated review
  authority path, approved warnings never masquerade as a rejection, and no
  broader review behavior has changed.
- **Relies on an unmerged successor:** no

### Tasks and tests

1. RED: Extend
   `packages/cli/tests/integration/plan-design-approval.test.ts` with the exact
   reproduced case: a current coordinator approval with warning findings and a
   phase review stamp, but no redundant artifact self-stamp. Run
   `bun run test tests/integration/plan-design-approval.test.ts`; before GREEN
   it must fail because approval still requires the second stamp.
2. RED: In the same real CLI harness, prove `changes_requested` returns only
   its rejection findings, while missing or stale evidence returns the typed
   admission failure and never concatenates findings from an approved review.
3. GREEN: Make `phaseReviewAdmission` the sole authenticated current-review
   decision used by plan approval. Remove the duplicate content-bound
   `currentReview` check rather than teaching users to mint a second weaker
   stamp. Restrict `latestReviewRejection` to actual `changes_requested`
   results.
4. GREEN: Update canonical Implementation Planning guidance and contract tests
   so the documented review/stamp/approve sequence matches executable authority.
5. REFACTOR: Keep digest calculation and receipt authentication in their
   existing owners. Assert that plan approval delegates to phase admission and
   does not independently interpret review currency.
6. Run:
   `bun run test tests/integration/plan-design-approval.test.ts tests/integration/plan-transition-gate.test.ts tests/integration/review-receipt-wiring.test.ts`.
7. Run: `bun run lint`.

## PR 2 — Generate one canonical planning-contract family

- **Purpose:** Give Product, Implementation, and Execution Planning the same
  explicit contract shape while preserving each phase's distinct decision.
- **Boundary:** Add one canonical shared-clause source, generate marked shared
  blocks into all three author contracts and reviewer rubrics, register every
  managed artifact, and check exact-copy conformance at authoring, dispatch,
  and admission. Preserve phase-only content in its owning contract. Exclude
  semantic project-context identity and fallback routing.
- **Prerequisites:** Make approved planning receipts advance truthfully.
- **Proof:** Generator and installed-project integration mutate the canonical
  source, phase-only clauses, and an installed copy to prove both shared
   propagation and exact-byte rejection through real reconciliation and phase
   entry points.
- **Completion signal:** There is one source for shared lifecycle, scope-
  authority, trust, and contract-shape clauses; every installed copy is exact;
  and each approval still claims only behavior, design, or startable delivery.
  No later slice depends on semantic review identity until PR 3 proves that
  identity through the real coordinator and admission path.
- **Relies on an unmerged successor:** no

### Tasks and tests

1. RED: Add
   `packages/cli/tests/integration/planning-contract-generation.test.ts` for R1,
   R5, and R10. Through real generators and a fresh installed project, assert a
   shared-clause edit changes every marked copy, phase-only clauses stay local,
   a missing or altered block fails reconciliation, and no phase approval can
   claim a downstream state. Run
   `bun run test tests/integration/planning-contract-generation.test.ts`;
   before GREEN it must fail because no canonical shared-clause source exists.
2. RED: Add exact-byte partitions for authoring, review dispatch, and phase
   admission. Each rejects an installed-copy mismatch and accepts canonical
   generated bytes; a missing marked clause returns
   `missing_generated_shared_clause` with its clause ID and affected planning
   phase, while an absent installed authoring or reviewer contract copy returns
   `missing_generated_contract_copy`. Semantic currency is deliberately absent
   from this slice.
3. GREEN: Add the smallest typed shared-clause source and generator. Generate
   the three author contracts and three reviewer-rubric blocks, register every
   canonical/generated asset, and wire one exact-copy conformance check into
   the three lifecycle boundaries.
4. GREEN: Make every phase contract declare purpose, entry criteria, required
   and prohibited content, review question, approval meaning, invalidation, and
   return path. Keep behavior/design/delivery judgment in its phase owner.
5. REFACTOR: Delete duplicated shared prose only after parity passes. Do not
   create a general documentation templating system.
6. Run:
   `bun run test tests/integration/planning-contract-generation.test.ts tests/review/plan-rubric-generation.test.ts tests/review/execution-plan-rubric-generation.test.ts tests/schema.test.ts tests/parity.test.ts`.
7. Run the applicable generators, then: `bun run format:check`.

## PR 3 — Bind review currency to complete semantic context

- **Purpose:** Make approval current only for the phase-specific target identity and every
  decision-bearing dependency its phase was required to review.
- **Boundary:** Add the closed phase-aware context resolver, role-specific
  semantic projector, versioned review identity, durable job-result field,
  user-owned ticket review dispositions, status/stamp/admission verification,
  and dependency-directed invalidation. Include project and milestone non-goals
  in parent/spec scope projection. Exclude fallback routing and semantic
  reviewer-quality policy.
- **Prerequisites:** Generate one canonical planning-contract family.
- **Proof:** Real packet preparation, coordinator status, stamp creation, and
  phase admission retain approval for cosmetic/unrelated edits but stale it for
  every named semantic dependency, exact Product/Implementation byte change,
  stable Execution definition change, ticket/kind mismatch, missing role, or
  broken configured override. Ordinary Execution checklist progress remains
  current under its existing normalized identity.
- **Completion signal:** One resolver supplies dispatch and admission; one
  integrity-protected job result records exact target and semantic dependencies;
  older readers treat the field as authority-inert; and no receipt crosses
  ticket, review kind, or dependency direction.
- **Relies on an unmerged successor:** no

### Tasks and tests

1. RED: Add `packages/cli/tests/review/planning-context.test.ts` for the closed
   `PlanningContextRole` model. Cover each phase's required-role matrix,
   including principles, personas, and affected surfaces for Execution review,
   justified absence, defaults versus stale/blank/unreadable overrides,
   duplicate/unknown shapes, the dedicated project-boundary role, full Rule ID/
   text projection, and retained project/milestone non-goals. A standalone
   Product Plan and a declared child parent must both stale when their owning
   project non-goals change; a declared missing parent must fail closed.
2. RED: Add
   `packages/cli/tests/integration/planning-review-identity.test.ts`. Through
   packet preparation, coordinator persistence, status, stamp, and admission,
   mutate whitespace/comments and unrelated inventory, then every decision-
   bearing role. The former retain approval; the latter stale only dependents.
3. RED: Change corrected Product/Implementation plan bytes, every stable
   Execution Plan field, canonical semantic contract bytes, ticket identity,
   and review kind. None may inherit the prior verdict; a fresh matching verdict
   restores admission. Then change only ordinary contributor-row Disposition,
   Evidence class, Revision, and final evidence cells and prove the accepted
   Execution review remains current. This deterministic proof remains required
   in addition to the later judged eval.
4. RED: In the same integration harness, authenticate a nonblocking optional
   finding, record the user's decline through a real pseudo-terminal, and assert
   `--no-input`, redirected input, and refusal record nothing. Assert the
   command serializes cooperating writers with an exclusive sibling lock,
   rejects an expected-digest mismatch observed under that lock, leaves no
   partial ticket after a crash, stales the prior receipt, and lets fresh review
   of unchanged plan bytes retain the decline. Prove the accepted-boundary
   digest excludes dispositions, covers ticket/project/parent/milestone
   boundaries, and supplies the matching decline to the fresh reviewer rubric
   without coordinator filtering. Do not claim protection from an out-of-band
   writer that ignores the lock.
   Run
   `bun run test tests/integration/planning-review-identity.test.ts`; before
   GREEN it must fail because no disposition command or ticket field exists.
5. GREEN: Implement the closed resolver and role-specific canonical projector.
   Callers provide ticket identity and review kind only. Fail closed on missing,
   duplicate, unknown, ambiguous, blank, unreadable, or stale required input.
6. GREEN: Add versioned `review_identity` to the existing integrity-protected
   job result under its lock and atomic replacement. Recompute it for status
   and admission; keep stamps as authenticated job references. Add no store or
   old-receipt backfill.
7. GREEN: Add `ticket record-review-disposition` over authenticated warning/info
   findings. Write the versioned disposition to ticket frontmatter with a
   digest compare-and-swap and adjacent atomic rename; include it in ticket
   semantic identity without treating it as scope expansion.
8. REFACTOR: Share one resolver/projector across packet construction and
   admission. Preserve meaningful order and sort only declared sets.
9. Run:
   `bun run test tests/review/planning-context.test.ts tests/integration/planning-review-identity.test.ts tests/review/packet.test.ts tests/review/job.test.ts tests/integration/phase-review-gate.test.ts`.
10. Run: `bun run lint`.

## PR 4 — Admit honest bounded fallback on every supported host

- **Purpose:** Keep planning usable after genuine independent-route exhaustion
  without pretending fallback review was independent.
- **Boundary:** Extend the coordinator with ordered same-agent headless,
  host-reported fresh-context, and bounded self-review tiers; issue tier-bound
  continuations over the immutable packet; authenticate permitted reduced-
  independence receipts; generate the versioned capability catalogue from a
  pinned release-gating corpus; enforce policy; and reconcile gated versus
  advisory guidance. Exclude the final semantic-scope rubric and its broader
  eval.
- **Prerequisites:** Bind review currency to complete semantic context.
- **Proof:** Coordinator and installed-host integrations vary route
  availability, typed failures, policy, reviewer identity/capability, and host
  boundary. The capability eval proves every packaged cross-provider ordering
  and release verification rejects unsupported default pairs. Every enforced
  host consumes the actual receipt; advisory hosts never claim a gate.
- **Completion signal:** Independent review is attempted first; no fallback
  skips an available stronger route; permitted fallback approval records actual
  reviewer and `reduced` independence; and every surface claims only what it
  enforces.
- **Relies on an unmerged successor:** no

### Tasks and tests

1. RED: Add
   `packages/cli/tests/integration/planning-review-fallback.test.ts` for R6.
   Prove independent-first routing, typed exhaustion before each next tier,
   refusal while an independent route remains, capability/identity checks,
   `require` policy denial, immutable packet binding, and authenticated reduced-
   independence admission. Cover packaged and configured exact-model capability
   ranks, equal/stronger acceptance, weaker refusal, coordinator-observed exact
   selectors, and fail-closed defaults, aliases, missing runtime confirmation,
   configured/launched/confirmed mismatch, unknown author capability, and
   reviewer-self-reported model IDs. A weaker verdict is discarded before the
   ordered ladder continues; under `prefer`, a successful different-agent review
   with unknown author capability is admitted immediately as `reduced` with its
   real reviewer and reason, while `require` retains findings but blocks.
2. RED: Add
   `packages/cli/tests/integration/planning-review-host-gates.test.ts` with
   installed lifecycle fixtures for Claude Code, OpenAI Codex, Cursor,
   OpenCode CLI/TUI, Claude Code Cloud, and Cursor Cloud Agents. Mock only the
   reviewer process, not lifecycle metadata. Prove Claude's exact SessionStart
   author model, fail-closed Codex/Cursor/OpenCode absence, preserved runtime-
   default route order, precise unknown-author versus unknown-reviewer recovery,
   Claude canonical `modelUsage` confirmation, Codex exact-selector launch proof,
   unverified OpenCode behavior, `prefer` reduced admission, and `require`
   denial. Pending blocks, current
   approval proceeds, and every configured host rejects an R9-invalidated
   receipt before phase admission.
3. RED: Add
   `packages/cli/tests/integration/planning-documentation.test.ts`. Assert the
   older coordinator ADR carries the reciprocal supersession marker, generated
   Codex Cloud and OpenCode Desktop guidance is advisory only, and every gated
   surface names its actual enforcement boundary.
4. RED: Add the pinned reviewer-capability manifest and human-labelled Product,
   Implementation, and Execution Plan corpus. Add
   `bun run test:eval:reviewer-capability` for three deterministic runs per
   exact model. A run passes only with the expected verdict, every required
   finding, and no forbidden finding. Require every fixture to pass in at least
   2 of 3 runs, at least 90% of all runs to pass, and the candidate's passing-run
   count to equal or exceed the author's on every fixture the author passes at
   least 2 of 3 times. The release-maintainer-owned manifest predeclares the
   floor; changing its floor, corpus, rubric, or settings digest invalidates all
   compared results. Its calibration fixtures must reject a known weaker result.
   Release verification fails when a shipped default cross-vendor pair lacks
   supported ordering or the live adapter confirmation proof required for its
   claimed independence.
5. GREEN: Generate packaged ranks only from admitted eval results; retain exact
   model, corpus/rubric/settings digests, evidence date, and results digest.
   Provider-documented within-family order may supplement the catalogue, but
   cannot create a cross-provider comparison. Project/user overlays remain
   explicit policy rather than packaged evidence.
6. GREEN: Make coordinator-observed launch provenance the only reviewer-model
   authority and trusted host lifecycle metadata the only author-model
   authority. Require an exact non-alias selector plus the adapter-specific
   launch proof: Claude canonical model metadata, or Codex coordinator-owned
   exact argv plus successful completion after a selector-contract probe. Keep
   reviewer verdict fields authority-inert and OpenCode unverified until its live
   proof establishes trusted provider/model metadata. Return
   `reviewer_capability_unknown` for an unverified reviewer and
   `author_capability_unknown` for a host without verified author metadata.
   Preserve and attempt existing runtime-default routes without rewriting them;
   they earn independence only when the adapter-specific proof resolves an
   exact ranked model.
7. GREEN: Add the three ordered continuation adapters beneath the coordinator.
   Seal terminal results in the existing job record, reuse ledger/admission,
   and reject ungated origins, unattempted stronger routes, or zero attempted
   independent routes.
8. GREEN: Reconcile canonical guidance and generated host assets. Add the
   reciprocal “superseded in part by” marker to the older coordinator ADR
   without rewriting its historical decision. The marker covers its degraded
   label, stamp prohibition, and live-worktree/no-revalidated-integrity clause;
   every fallback tier receives the same immutable coordinator packet.
   Document the intentional compatibility boundary: existing `off` projects
   must select `prefer` or `require`; non-Claude `require` projects block until
   host author metadata is verified; `prefer` continues with honestly reduced
   assurance. Preserve route lists and history without rewrite.
9. REFACTOR: Keep host adapters thin and tier-bound. Remove adapter-local
   fallback or independence inference exposed by real-host tests.
10. Run:
   `bun run test tests/integration/planning-review-fallback.test.ts tests/integration/planning-review-host-gates.test.ts tests/integration/planning-documentation.test.ts tests/review/policy.test.ts tests/review/degraded-explanation.test.ts tests/review/surface-parity.test.ts tests/integration/phase-review-gate.test.ts`.
11. Run: `bun run test:eval:reviewer-capability`.
12. Run host generators/parity fixer, then:
   `bun run test tests/schema.test.ts tests/parity.test.ts tests/npm-package.test.ts`.
13. Run: `bun run lint`.

## PR 5 — Enforce scope-safe semantic planning review

- **Purpose:** Judge plans against accepted authority without executing
  evidence, leaking private context, or turning reviewer suggestions into scope.
- **Boundary:** Carry structured untrusted-evidence metadata through planning
  and review; enforce accepted-boundary, finding-authority, persona-outcome, and
  epistemic-status rubrics; add the pinned repeated judged eval; update customer
  docs; and prove the complete feature. Exclude sibling-owned content,
  migration, final NTB copy, and merge/release authority.
- **Prerequisites:** Admit honest bounded fallback on every supported host.
- **Proof:** Deterministic integrations prove quarantine, durable evidence
  metadata, scope resolution, installed dispatch, and receipt behavior. A
  versioned fixed-rubric eval runs three deterministic repetitions and requires
  at least two agreeing correct verdicts per fixture; below threshold is
  inconclusive, never passing. The complete feature runs through Cucumber.
- **Completion signal:** All 54 scenarios are GREEN/REFACTOR, the pinned eval
  passes 2-of-3, customer docs explain the bounded planning approvals and host
  matrix, and the contributor checklist has current evidence.
- **Relies on an unmerged successor:** no

### Tasks and tests

1. RED: Add
   `packages/cli/tests/integration/planning-evidence-boundary.test.ts`. Through
   real planning/review packet preparation, prove retrieved instructions cannot
   alter scope, code snippets are not run, public evidence remains usable
   without sending private context, and absent reuse limits are not invented.
   Cover both `PlanEvidenceRecordV1` in Implementation Inspiration and the
   reviewer verdict's durable evidence record.
2. RED: Add a versioned `evidence_record` field to new job-result fixtures with
   source identity, claims, license, attribution, redistribution, security,
   privacy, and reuse limits. Prove persistence in the existing job record,
   integrity coverage, authority-inert older-schema reading, and no backfill.
3. RED: Add
   `packages/cli/tests/integration/planning-scope-review.test.ts`. Through the
   installed three phase entry points, cover all binding ticket/project/
   milestone/parent boundaries, omission and overreach, optional strengthening,
   reviewer non-authority, architecture/data/testing/domain/research guidance,
   every accepted persona outcome, and honest epistemic status. Assert a user-
   accepted expansion edits authoritative ticket or parent scope before plan
   bytes change, while a decline uses the versioned ticket disposition. Prove
   the Product Plan review blocks the `intake → define-behavior` handoff before
   scenario review when persona outcomes or epistemic status are incomplete.
   Extend `packages/cli/tests/integration/planning-documentation.test.ts` before
   editing customer docs; its new cases must fail until README and website
   content state exact plan/context currency, bounded phase authority, fallback
   assurance, recovery, and the enforced/advisory host split.
4. RED: Add a versioned judged-eval manifest/corpus for R7 and R10–R16. Pin
   judge identity, rubric digest, deterministic settings, repetitions `3`,
   agreement threshold `2`, expected verdict, allowed finding authority, and
   forbidden scope expansion. Run `bun run test:eval:planning-contracts`;
   before GREEN it must fail adversarial omissions, overreach, instruction
   injection, and corrected-byte cases.
5. GREEN: Reuse the existing quarantine/parser, emit `PlanEvidenceRecordV1` in
   Implementation Inspiration entries, and persist reviewer evidence records in
   the existing protected job result. Rubrics cite accepted authority, surface
   unresolved user choices, and keep optional strengthening nonblocking.
6. GREEN: Wire Product Plan persona/epistemic checks plus shared bidirectional
   scope and finding-authority rules into every installed entry point. Keep
   scenario coverage and phase content judgment in their existing owners.
7. GREEN: Update `README.md` and `packages/website/src/content/docs` with exact
   currency, three bounded approval meanings, fallback assurance, recovery, and
   enforced/advisory surfaces. Regenerate owned assets; do not hand-edit them.
8. REFACTOR: Remove redundant rubric prose after parity. Keep deterministic
   boundary tests separate from model evals and evals out of default fast tests.
9. Run:
   `bun run test tests/integration/planning-evidence-boundary.test.ts tests/integration/planning-scope-review.test.ts tests/integration/planning-documentation.test.ts tests/hooks/product-plan-contract.test.ts tests/review/plan-state-truthfulness.test.ts`.
10. Add the aggregate `test:eval:planning-reviews` script, then run it to prove
    both the reviewer-capability catalogue and semantic planning contracts.
11. Run:
    `bun run test:bdd:acceptance -- features/keep-plan-reviews-current-and-trustworthy.feature`.
12. Run: `bun run test:bdd:proof`.
13. Run: `bun run lint` and `bun run format:check`.
14. Run: `bun run test:smoke`.

## Obligation ownership

| Accepted obligation | Owning PRs |
| --- | --- |
| R1 shared clauses are authored once and generated into every planning contract | PR 2 |
| R2 every review receives complete phase context | PR 3 |
| R3 required context resolves or fails closed | PR 3 |
| R4 currency changes only for semantic dependencies | PR 3 |
| R5 exact canonical generated bytes control installed contract use | PR 2, PR 3 |
| R6 fallback is independent-first, bounded, authenticated, and honestly labeled | PR 4 |
| R7 research and reviewed context remain untrusted evidence with durable reuse limits | PR 5 |
| R8 ungated surfaces receive advisory guidance only | PR 4 |
| R9 invalidation follows established dependency direction and cannot cross ticket/kind | PR 3 |
| R10 all three phases share contract shape but retain bounded approval meanings | PR 2, PR 5 |
| R11 finding authority, corrected-byte invalidation, and truthful gate errors | PR 1, PR 3, PR 5 |
| R12 scope includes ticket, project, milestone, and parent boundaries and non-goals | PR 3, PR 5 |
| R13 completeness rejects both omission and overreach | PR 5 |
| R14 reviewer corrections cannot silently expand scope and a user decline remains recorded | PR 3, PR 5 |
| R15 architecture, data, testing, domain, research, and reviewer guidance cannot expand scope | PR 5 |
| R16 Product Plan review covers every accepted persona outcome and epistemic state | PR 5 |
| Existing review history stays preserved and authority-inert when unreadable by active schema | PR 3, PR 5 |
| Customer docs explain currency, authority, fallback, recovery, and host enforcement | PR 4, PR 5 |

## Deferred scope ownership

- 7CAMAD owns Execution Plan decomposition/content, coding authorization, and
  repair loop; this ticket owns review identity and quality.
- K3EBHB owns final Non-Technical Builder recovery wording and installed-
  surface comprehension proof; this ticket supplies typed reason/recovery data.
- YCFFNC owns migration and coordinated cutover; this ticket adds no migration
  or backfill and keeps older records authority-inert.
- G1C9PP owns 30–60 minute focused reviewability and its receipt judgment; this
  ticket preserves the bounded contract that judgment consumes.
- `skip: no other behavior, design, proof, rollout, or documentation obligation
  is deferred outside the five PRs above.`

## Decision accounting

- Bind each verdict to exact plan bytes plus semantic canonical-contract and
  context projections, while gating generated copies by exact bytes separately:
  unchanged.
- Extend the existing coordinator and review ledger instead of creating a
  second planning-review subsystem: unchanged.
- Author shared planning clauses once and generate exact marked copies while
  keeping phase-only judgment separate: unchanged.
- Treat semantic projection as a closed domain model, not generic Markdown
  normalization: unchanged.
- Record a user-declined optional strengthening in ticket context: unchanged.
- Classify reviewer capability from explicit versioned ranks and fail closed
  when comparison is unavailable: unchanged.
- Permit authenticated reduced-independence receipts only after stronger routes
  are exhausted: unchanged.

The judged eval below proves semantic judgment only. Deterministic integration
remains required for structure, wiring, receipt identity, and corrected bytes.

## Proof specifications

| Proof ID | Method | Scope | Boundary exercised | Qualifies as | Currency | Invocation |
| --- | --- | --- | --- | --- | --- | --- |
| phase-approval-proof | command | integration | Installed CLI plan approval through authenticated phase admission and typed rejection rendering | real_boundary | current_required | {"type":"command","cwd":"packages/cli","argv":["bun","run","test","tests/integration/plan-design-approval.test.ts","tests/integration/plan-transition-gate.test.ts","tests/integration/review-receipt-wiring.test.ts"]} |
| contract-proof | command | integration | Canonical generator through schema reconciliation, installed copies, and lifecycle copy checks | real_boundary | current_required | {"type":"command","cwd":"packages/cli","argv":["bun","run","test","tests/integration/planning-contract-generation.test.ts","tests/review/plan-rubric-generation.test.ts","tests/review/execution-plan-rubric-generation.test.ts","tests/schema.test.ts","tests/parity.test.ts"]} |
| identity-proof | command | integration | Filesystem context resolution through coordinator job, ledger stamp, and phase admission | real_boundary | current_required | {"type":"command","cwd":"packages/cli","argv":["bun","run","test","tests/review/planning-context.test.ts","tests/integration/planning-review-identity.test.ts","tests/integration/phase-review-gate.test.ts"]} |
| fallback-proof | command | integration | Coordinator exhaustion through authenticated fallback receipt and installed host gates | real_boundary | current_required | {"type":"command","cwd":"packages/cli","argv":["bun","run","test","tests/integration/planning-review-fallback.test.ts","tests/integration/planning-review-host-gates.test.ts","tests/review/policy.test.ts","tests/review/surface-parity.test.ts"]} |
| evidence-proof | command | integration | Retrieval quarantine through durable evidence record and installed planning/review entry points | real_boundary | current_required | {"type":"command","cwd":"packages/cli","argv":["bun","run","test","tests/integration/planning-evidence-boundary.test.ts","tests/integration/planning-scope-review.test.ts","tests/hooks/product-plan-contract.test.ts"]} |
| documentation-proof | command | integration | ADR supersession, customer-facing README/website content, and generated host guidance through exact assertions | real_boundary | current_required | {"type":"command","cwd":"packages/cli","argv":["bun","run","test","tests/integration/planning-documentation.test.ts"]} |
| planning-evals-proof | command | eval | Pinned repeated capability-catalogue and semantic-contract corpora exercise exact planning rubrics and default cross-provider comparisons | real_boundary | current_required | {"type":"command","cwd":"packages/cli","argv":["bun","run","test:eval:planning-reviews"]} |
| feature-proof | command | E2E | Complete feature through real Cucumber entry point and step wiring | real_boundary | current_required | {"type":"command","cwd":".","argv":["bun","run","test:bdd:acceptance","--","features/keep-plan-reviews-current-and-trustworthy.feature"]} |
| release-proof | command | E2E | Repository smoke boundary after integrated feature changes | real_boundary | current_required | {"type":"command","cwd":".","argv":["bun","run","test:smoke"]} |

## Delivery checklist

<!-- safeword:delivery-checklist:v1 -->

| ID | Category | Obligation | Owner | Required proof | Disposition | Evidence class | Revision | Evidence, reason, or dependency |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| outcome-scope | outcome and scope | Deliver R1–R16 without redefining sibling-owned plan content, migration, recovery copy, or release authority | contributor | feature-proof | open | missing | | |
| resolved-decisions | resolved decisions | Preserve all seven recorded decisions and exact/fallback/capability/user-authority boundaries | contributor | feature-proof | open | missing | | |
| pr-decomposition | dependency and pull-request decomposition | Land five ordered independently reviewable slices, each safe without a successor | contributor | phase-approval-proof | open | missing | | |
| testing | testing | Complete deterministic boundary proof, 44 scenario ledgers, the capability-catalogue eval, and the pinned 2-of-3 semantic contract eval | contributor | planning-evals-proof | open | missing | | |
| data-compatibility | data and compatibility | Add versioned identity/evidence to existing job results and user dispositions to tickets; preserve history with no new store, migration, or backfill | contributor | identity-proof | open | missing | | |
| monitoring | monitoring and failure signals | Expose typed context, copy, route, identity, and origin failures with one recovery action | contributor | fallback-proof | open | missing | | |
| security-privacy | security and privacy | Preserve credential/privacy boundaries and deny execution or instruction authority to evidence | contributor | evidence-proof | open | missing | | |
| rollout-rollback | rollout and rollback | Activate coherent slices; rollback preserves inert records and ledger history | contributor | identity-proof | open | missing | | |
| documentation | documentation | Update guidance, README, website, ADR marker, and generated host copies | contributor | documentation-proof | open | missing | | |
| ownership-dependencies | ownership and human dependencies | Keep sibling obligations deferred to named owners and invent no human authority | contributor | feature-proof | open | missing | | |
| design-approval | ownership and human dependencies | Obtain configured human design approval | human | | not_applicable | missing | | Project `designApprovalGate` is disabled; review is not human design approval. |
| completion-evidence | completion evidence | Produce current receipts for all boundaries, complete feature, eval, and verification | contributor | release-proof | open | missing | | |
