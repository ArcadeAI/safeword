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
The stacked branches now implement the planning-context resolver, semantic
review identity, generated shared contracts, and authenticated reduced-
independence receipt path. Implementation does not establish current acceptance:
R4 exact-contract and R8 guidance corrections are uncommitted and need fresh
RED evidence after fixture changes before GREEN can be claimed. R9's
unsupported-direction rejection and semantic upstream correction are committed
at bf758b53f52d40f3d7288f285937dcb717554a26, with current-main verification and
owning-slice placement pending. R9's upstream canonical-contract dependency
correction is not implemented. The checklist stays open until current proof is
recorded.

During this ticket's Implementation Plan approval, an approved cross-agent
review with warnings still failed `ticket approve-plan`. Phase admission
correctly accepted the authenticated exact-plan receipt, but a second
content-bound `impl-plan` self-stamp check rejected it. The error renderer then
reported findings from the latest approved review because it did not restrict
`latestReviewRejection` to `changes_requested`. A manually added redundant
stamp allowed the transition, confirming both defects. PR 1 fixes them before
the broader provenance changes.

### Resume execution status

The tasks below preserve the original build sequence; they are not instructions
to manufacture fresh REDs for implemented behavior. Their current status is:

| Slice | Implemented behavior to characterize and verify | Open corrective work |
| --- | --- | --- |
| PR 1 | Both approval/rejection tasks and their production fix | Exact-head final review and current validation |
| PR 2 | Shared generation and installed-copy integrity; unsupported-direction rejection committed on the stack | Task 2: place the correction in its owning slice and verify current main |
| PR 3 | Context resolution, semantic currency, disposition recording; semantic upstream correction committed on the stack | Tasks 2–3: place existing corrections, refresh exact-contract proof, and implement upstream canonical-contract dependency |
| PR 4 | Fallback routing, installed gates, capability corpus | Task 3: installed advisory guidance; live model confirmation and release proof |
| PR 5 | Evidence records and scope judgment | Current nondeferred acceptance, evals, and exact-head review; R7 host retrieval remains deferred |

For implemented tasks, run the named command as characterization; passing is
the expected outcome. Historical RED/GREEN evidence stays in the ledger. A new
failure is investigated rather than relabeled as the original RED. Only the
corrective partitions above enter a new RED/GREEN/REFACTOR loop. Characterize
PR 2's implemented R9 rejection: `scripts/dev bun run --cwd packages/cli test
 tests/integration/planning-contract-generation.test.ts -t "unsupported own-review-only"`
must reject the invalid contract. PR 3's implemented semantic upstream correction
must change identity after a semantic upstream edit in
`tests/review/execution-role-context.test.ts`. These are characterization runs,
not new RED claims. The unimplemented upstream contract-byte dependency enters
the new paired R9 RED loop.

R4's primary corrective RED runs from the root:

```bash
scripts/dev node --import tsx node_modules/.bin/cucumber-js features/keep-plan-reviews-current-and-trustworthy.feature --name '^Context identity ignores cosmetic and unrelated edits$' --tags 'not @wip and not @proof.vitest and not @manual and not @live'
```

Its missing behavior is the cosmetic bounded-contract example retaining approval;
the semantic mutation is the passing control. R8's primary corrective RED runs:

```bash
scripts/dev node --import tsx node_modules/.bin/cucumber-js features/keep-plan-reviews-current-and-trustworthy.feature --name '^(Generated Codex Cloud instructions cannot claim a gated approval|OpenCode Desktop guidance cannot claim a gated approval|Generated guidance identifies gated surfaces as enforced)$' --tags 'not @wip and not @proof.vitest and not @manual and not @live'
```

Its missing behavior is installed guidance omitting the supported/advisory
boundary and supported redirect. These commands are the first corrective proofs,
not a claim that the existing lower-level documentation tests currently fail.
PR 3 context characterization includes an Execution Plan with no data declaration
whose accepted Implementation Plan triggers current data guidance; installed
Claude dispatch must enforce the same completeness boundary.

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

1. Proof: Extend
   `packages/cli/tests/integration/plan-design-approval.test.ts` with the exact
   reproduced case: a current coordinator approval with warning findings and a
   phase review stamp, but no redundant artifact self-stamp. Run
   `bun run test tests/integration/plan-design-approval.test.ts`; in the original RED
   it must fail because approval still requires the second stamp.
2. Proof: In the same real CLI harness, prove `changes_requested` returns only
   its rejection findings, while missing or stale evidence returns the typed
   admission failure and never concatenates findings from an approved review.
   Run `bun run test tests/integration/plan-design-approval.test.ts` through `scripts/dev`; in the original RED, assert the
   new case fails because approved warning findings appear in a refusal or actual rejection findings are omitted.

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
  Do not cut a release between PR 2 and PR 4; the merged intermediate slices
  are development states, not supported published packages.
  No later slice depends on semantic review identity until PR 3 proves that
  identity through the real coordinator and admission path.
- **Relies on an unmerged successor:** no

### Tasks and tests

1. Proof: Add
   `packages/cli/tests/integration/planning-contract-generation.test.ts` for R1,
   R5, and R10. Through real generators and a fresh installed project, assert a
   shared-clause edit changes every marked copy, phase-only clauses stay local,
   a missing or altered block fails reconciliation, and no phase approval can
   claim a downstream state. Run
   `bun run test tests/integration/planning-contract-generation.test.ts`;
   in the original RED, the new shared-source propagation assertion must fail because
   no single source updates every marked contract. Historical passing source
   generation remains checked; corrective missing-copy cases have their own RED.
2. Proof: Add exact-byte partitions for authoring, review dispatch, and phase
   admission. Each rejects an installed-copy mismatch and accepts canonical
   generated bytes; a missing marked clause returns
   `missing_generated_shared_clause` with its clause ID and affected planning
   phase, while an absent installed authoring or reviewer contract copy returns
   `missing_generated_contract_copy`. Semantic currency is deliberately absent
   from this slice. Also prove the accepted typed declaration boundary through
   a fresh installed project and real CLI upgrade: an undecidable canonical
   Execution invalidation direction returns `invalid_invalidation_contract`
   with the phase and canonical contract path before installed contract bytes
   change. Keep missing, unknown, unknown-suffix, duplicate, and contradictory
   values in `planning-contract-generation.test.ts` as variations of that one
   outcome.
   Run `bun run test tests/integration/planning-contract-generation.test.ts tests/integration/installed-planning-copy-admission.test.ts` through `scripts/dev`; in the original RED, assert the
   new case fails because an altered or missing installed contract advances, or an undecidable invalidation declaration writes installed bytes.

3. GREEN: Add the smallest typed shared-clause source and generator. Generate
   the three author contracts and three reviewer-rubric blocks, register every
   canonical/generated asset, and wire one exact-copy conformance check into
   the three lifecycle boundaries. Keep the installed public approval/shared-hook
   and Cursor adapter admission partitions in
   `packages/cli/tests/integration/installed-planning-copy-admission.test.ts`,
   included in the required `contract-proof` invocation.
4. GREEN: Make every phase contract declare purpose, entry criteria, required
   and prohibited content, review question, approval meaning, invalidation, and
   return path. Emit the eight fields from each owner's bounded contract, plus
   the closed owner-decided Execution dependency mode. Reject an undecidable
   canonical dependency declaration during reconciliation before writes, rather
   than selecting a permissive default. Return that decision to 7CAMAD;
   dependency invalidation at review status/admission remains PR 3.
   Keep behavior/design/delivery judgment in its phase owner.
5. REFACTOR: Delete duplicated shared prose only after parity passes. Do not
   create a general documentation templating system.
6. Run:
   `bun run test tests/integration/planning-contract-generation.test.ts tests/integration/installed-planning-copy-admission.test.ts tests/review/plan-rubric-generation.test.ts tests/review/execution-plan-rubric-generation.test.ts tests/schema.test.ts tests/parity.test.ts`.
7. Run the applicable generators, then: `bun run format:check`.

## PR 3 — Bind review currency to complete semantic context

Both Implementation and Execution review resolve current dimensions when present,
configured architecture records, and triggered data guidance directly, as required
by inherited TBU4.R3/R4; Execution also resolves the accepted Implementation Plan.
Prove each direct role's omission and semantic mutation through actual packet,
status, and admission boundaries. Context constrains the accepted design without
reopening its authority.

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

1. Proof: Add `packages/cli/tests/review/planning-context.test.ts` for the closed
   `PlanningContextRole` model. Cover each phase's required-role matrix,
   including principles, personas, and affected surfaces for Execution review,
   justified absence, defaults versus stale/blank/unreadable overrides,
   duplicate/unknown shapes, the project role for global behavior and boundaries, full Rule ID/
   text projection, and retained project/milestone non-goals. The project role
   resolves the owning Product Plan's Expected outcome, Persona outcome inventory,
   Known facts, Assumptions, Unresolved product decisions, and Success threshold;
   the parent role retains the complete selected parent job. Cover standalone
   and child layouts: every retained behavioral/epistemic field change must stale
   dependent scenario-gate, Implementation, and Execution reviews, while cosmetic edits and
   unrelated parent-job edits retain approval. A child Product Plan review must
   receive inherited epistemic fields through the real resolver. A declared
   missing parent or required blank/missing/ambiguous framing fails closed.
   Run `bun run test tests/review/planning-context.test.ts` through `scripts/dev`; in the original RED, assert the
   new case fails because required context is absent from the packet or an invalid override resolves permissively.

2. Proof: Add
   `packages/cli/tests/integration/planning-review-identity.test.ts`. Through
   packet preparation, coordinator persistence, status, stamp, and admission,
   mutate whitespace/comments and unrelated inventory, then every decision-
   bearing role. The former retain approval; the latter stale only dependents.
   Include scenario-gate as a consumer of the same identity path: its exact
   scenario target, existing rubric, accepted Product inventory/project frame,
   Rules and boundary context are bound. After approved coverage, adding an
   applicable outcome or changing applicability stales status and denies phase
   admission; fresh coverage review restores it. Cosmetic inventory formatting
   and unreferenced persona edits retain approval. No fourth planning contract
   or new inventory authority is introduced.
   Exercise the canonical R9 dependency direction with the same mechanics.
   Add paired canonical-contract mutations through the real coordinator,
   status, stamp, and admission entry points: changing Implementation contract
   bytes stales both receipts; changing only Execution contract bytes stales
   only Execution. Capture an authentic failing RED before adding the upstream
   canonical contract to the existing accepted-upstream dependency projection.
   Packet-level paired mutation checks in
   `tests/review/execution-role-context.test.ts` support this integration proof;
   they do not replace it. Retain outside-marker cosmetic stability and reject
   missing upstream canonical identity. This correction belongs to PR 3's
   existing context/currency task, with no new approval store or schema version.
   A semantic upstream Implementation change must stale both reviews under
   `both_plan_reviews`; the upstream role remains required and currency-bearing.
   Reconciliation must reject `implementation_review_only` before changing
   installed contract bytes. Missing, unknown, duplicate, and contradictory
   declarations also fail closed. Do not use mocked status or a separate
   configurable dependency path.
   Run `bun run test tests/integration/planning-review-identity.test.ts` through `scripts/dev`; in the original RED, assert the
   new case fails because a changed required dependency retains approval or a cosmetic dependency loses it.

3. Proof: Change corrected Product/Implementation plan bytes, every stable
   Execution Plan field, exact bounded canonical contract bytes, ticket identity,
   and review kind. None may inherit the prior verdict; a fresh matching verdict
   restores admission. Then change only ordinary contributor-row Disposition,
   Evidence class, Revision, and final evidence cells and prove the accepted
   Execution review remains current. This deterministic proof remains required
   in addition to the later judged eval.
   Run `bun run test tests/integration/planning-review-identity.test.ts tests/integration/planning-context-currency.test.ts` through `scripts/dev`; in the original RED, assert the
   new case fails because changed bounded canonical bytes or stable plan definition retains approval.
   In the authenticated job fixture, retain a pre-feature receipt with no
   review identity and sealed records with malformed or unsupported-version
   identities. Real status/stamp/admission must deny them without rewriting
   history. An older-schema reader must ignore unknown identity fields rather
   than grant authority; a fresh supported receipt restores admission.

4. Proof: In the same integration harness, authenticate a nonblocking optional
   finding, record the user's decline through a real pseudo-terminal, and assert
   `--no-input`, redirected input, and refusal record nothing. Assert the
   command serializes cooperating writers with an exclusive sibling lock,
   rejects an expected-digest mismatch observed under that lock, leaves no
   partial ticket after a crash, stales the prior receipt, and lets fresh review
   of unchanged plan bytes retain the decline. Prove the accepted-boundary
   digest excludes dispositions, covers ticket/project/parent/milestone
   boundaries, and supplies the matching decline to the fresh reviewer rubric
   without coordinator filtering. The public
   `tests/integration/planning-review-disposition.test.ts` harness must also
   recover a dead writer's lock on retry and record the complete disposition;
   a live owner must return `REVIEW_DISPOSITION_WRITE_UNAVAILABLE`, preserve
   both ticket bytes and the owner's lock, and never force removal.
   Do not claim protection from an out-of-band
   writer that ignores the lock.
   Run
   `scripts/dev bun run --cwd packages/cli test tests/integration/planning-review-identity.test.ts tests/integration/planning-review-disposition.test.ts`.
   Existing command behavior is characterization and must pass; a missing
   lock partition is added as a characterization proof, not a fabricated RED.
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

1. Proof: Add
   `packages/cli/tests/integration/planning-review-fallback.test.ts` and
   `packages/cli/tests/integration/planning-review-zero-independent.test.ts`, and
   `packages/cli/tests/integration/planning-review-route-order.test.ts` for R6.
   Prove independent-first routing, typed exhaustion before each next tier,
   refusal while an independent route remains, capability/identity checks,
   `require` policy denial, immutable packet binding, and authenticated reduced-
   independence admission. Cover packaged and configured exact-model capability
   ordered-pair comparisons, qualified not-weaker acceptance, weaker refusal, coordinator-observed exact
   selectors, and fail-closed defaults, aliases, missing runtime confirmation,
   configured/launched/confirmed mismatch, unknown author capability, and
   reviewer-self-reported model IDs. A weaker verdict is discarded before the
   ordered ladder continues; under `prefer`, a successful different-agent review
   with unknown author capability is admitted immediately as `reduced` with its
   real reviewer and reason, while `require` retains findings but blocks.
   This is the named lower-level proof for the complete R6 capability matrix in
   `dimensions.md`. Exercise each unavailable author identity, unavailable
   reviewer identity, and unqualified exact ordered pair independently through
   the public coordinator, status, stamp, and admission path, crossing `prefer`
   and `require`. The representative capability-outline rows do not replace
   these required partitions; unknown comparison must never mean “not weaker.”
   Run `bun run test tests/integration/planning-review-fallback.test.ts tests/integration/planning-review-zero-independent.test.ts tests/integration/planning-review-route-order.test.ts` through `scripts/dev`; in the original RED, assert the
   new case fails because an unattempted stronger route or unqualified comparison authorizes a fallback.

2. Proof: Add
   `packages/cli/tests/integration/planning-review-host-gates.test.ts` with
   installed lifecycle fixtures for Claude Code, OpenAI Codex, Cursor,
   OpenCode CLI/TUI, Claude Code Cloud, and Cursor Cloud Agents. Mock only the
   reviewer process, not lifecycle metadata. Prove Claude's exact SessionStart
   author model, fail-closed Codex/Cursor/OpenCode absence, preserved runtime-
   default route order, precise unknown-author versus unknown-reviewer recovery,
   Claude canonical `modelUsage` confirmation, Codex app-server effective-model and correlated-reroute proof,
   unverified OpenCode behavior, `prefer` reduced admission, and `require`
   denial. Pending blocks, current
   approval proceeds, and every configured host rejects an R9-invalidated
   receipt before phase admission.
   Pair-qualification partitions: both models pass the absolute corpus floor
   but their exact ordered pair is unqualified; that returns
   `reviewer_capability_unknown`, even with equal or higher scalar ranks or an
   admitted transitive path. A current qualified not-weaker pair is eligible;
   a qualified weaker pair is refused even after project/user rank overlays.
   Reversing a pair or changing its evidence/corpus/rubric/settings revision
   cannot inherit qualification. Exercise public routing, stamp, and admission.
   Run `bun run test tests/integration/planning-review-host-gates.test.ts` through `scripts/dev`; in the original RED, assert the
   new case fails because unverified model metadata grants independence or a stale receipt advances.

3. Proof: Add
   `packages/cli/tests/integration/planning-documentation.test.ts`. Assert the
   older coordinator ADR carries the reciprocal supersession marker, generated
   Codex Cloud and OpenCode Desktop guidance is advisory only, and every gated
   surface names its actual enforcement boundary.
   Run `bun run test tests/integration/planning-documentation.test.ts` through `scripts/dev`; in the original RED, assert the
   new case fails because installed advisory guidance claims authoritative approval or omits its supported redirect.

4. Proof: Add the pinned reviewer-capability manifest and human-labelled Product,
   Implementation, and Execution Plan corpus. Add
   `bun run test:eval:reviewer-capability` for three deterministic runs per
   exact model. A run passes only with the expected verdict, every required
   finding, and no forbidden finding. Require every fixture to pass in at least
   2 of 3 runs, at least 90% of all runs to pass, and the candidate's passing-run
   count to equal or exceed the author's on every fixture the author passes at
   least 2 of 3 times. The release-maintainer-owned manifest predeclares the
   floor; changing its floor, corpus, rubric, or settings digest invalidates all
   compared results. Its calibration fixtures must reject a known weaker result.
   Store qualified ordered-pair records with exact model IDs, the directional
   result, qualification method and evidence/date/digest references; scalar ranks
   affect preference only and cannot grant qualification. Release verification
   fails when a shipped default cross-vendor pair lacks
   supported ordering or the live adapter confirmation proof required for its
   claimed independence.
   Run `bun run test:eval:reviewer-capability` through `scripts/dev`; in the original RED, assert the
   new case fails because an unsupported ordered pair qualifies or a pinned required finding is absent.

   Add `tests/smoke/planning-review-model-confirmation.live.test.ts` before
   changing adapter behavior. Install the packaged runtime in a fresh project;
   invoke real Claude and Codex through the public coordinator with each exact
   packaged default selector. Assert the recorded provider/model equals the
   launched exact selector, with a completed matching Codex thread/turn and
   Claude assistant/result agreement. A reroute, unavailable selector, missing
   metadata, timeout, or skipped route cannot pass. Run
   `../../scripts/dev env SAFEWORD_RUN_PLANNING_MODEL_LIVE=1 bun run test:smoke:live tests/smoke/planning-review-model-confirmation.live.test.ts`
   from `packages/cli`; before GREEN, a missing or mismatched confirmed model
   must fail its exact identity assertion. Process-boundary fixtures retain the
   adversarial wrong-thread/turn and reroute cases; a live success proves the
   actual supported protocol, not the absence of every possible reroute.
   Run `../../scripts/dev bun run test:release` from `packages/cli`; packaged
   capability and plugin release cases must fail a missing comparison, stale
   corpus/rubric/settings digest, or unsupported default pair. No skipped live
   route or historic model confirmation satisfies the current live proof.

5. GREEN: Generate packaged ordered-pair comparisons only from admitted evidence; retain exact
   model, corpus/rubric/settings digests, evidence date, and results digest.
   Provider-documented within-family order may supplement the catalogue, but
   cannot create a cross-provider comparison. Project/user rank overlays order routes only and cannot establish comparison evidence.
6. GREEN: Make coordinator-observed launch provenance the only reviewer-model
   authority and trusted host lifecycle metadata the only author-model
   authority. Require an exact non-alias selector plus the adapter-specific
   launch proof: Claude canonical model metadata and Codex app-server stdio
   `thread/start` model/provider acknowledgement plus the matching completed
   turn and `model/rerouted` notifications. Exercise actual supported CLI
   schema and a live ephemeral turn; paired process-boundary fixtures cover
   mismatched supported IDs, rerouting, missing metadata, unsupported protocol
   and wrong-thread/turn responses. Keep legacy exec review readable as
   best-available evidence, never as model confirmation. Preserve actual
   findings through the accepted reduced/fail-closed policy. Keep
   reviewer verdict fields authority-inert and OpenCode unverified until its live
   proof establishes trusted provider/model metadata. Return
   `reviewer_capability_unknown` for an unverified reviewer and
   `author_capability_unknown` for a host without verified author metadata.
   Preserve and attempt existing runtime-default routes without rewriting them;
   they earn independence only when the adapter-specific proof resolves an
   exact model with a qualified comparison to the verified author.
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
    `bun run test tests/integration/planning-review-fallback.test.ts tests/integration/planning-review-zero-independent.test.ts tests/integration/planning-review-route-order.test.ts tests/integration/planning-review-host-gates.test.ts tests/integration/planning-documentation.test.ts tests/review/policy.test.ts tests/review/degraded-explanation.test.ts tests/review/surface-parity.test.ts tests/integration/phase-review-gate.test.ts`.
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
- **Completion signal:** The nondeferred scenario boundaries have current
  GREEN/REFACTOR evidence, the pinned eval passes 2-of-3, and customer docs and
  contributor proofs are current. R7's planning-agent retrieval boundary remains
  unproved under the user's deferral; packet or judged proof cannot close it.
  The open human deferral item prevents claiming complete R7, feature, or epic
  acceptance. This bounded code-delivery signal grants no merge authority.
- **Relies on an unmerged successor:** no

### Tasks and tests

1. Proof: Add
   `packages/cli/tests/integration/planning-evidence-boundary.test.ts`. Through
   real planning/review packet preparation, prove retrieved instructions cannot
   alter scope, code snippets are not run, public evidence remains usable
   without sending private context, and absent reuse limits are not invented.
   Cover both `PlanEvidenceRecordV1` in Implementation Inspiration and the
   reviewer verdict's durable evidence record.
   Run `bun run test tests/integration/planning-evidence-boundary.test.ts` through `scripts/dev`; in the original RED, assert the
   new case fails because untrusted packet evidence changes accepted authority or loses its reuse limits.

2. Proof: Add a versioned `evidence_records` collection to new job-result fixtures with
   source identity, claims, license, attribution, redistribution, security,
   privacy, and reuse limits. Prove persistence in the existing job record,
   integrity coverage, authority-inert older-schema reading, and no backfill.
   Run `bun run test tests/review/job.test.ts tests/integration/planning-evidence-boundary.test.ts` through `scripts/dev`; in the original RED, assert the
   new case fails because an evidence record is dropped, accepted despite broken integrity, or gains authority under an unsupported schema.

3. Proof: Add
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
   Run `bun run test tests/integration/planning-scope-review.test.ts tests/integration/planning-documentation.test.ts tests/hooks/product-plan-contract.test.ts` through `scripts/dev`; in the original RED, assert the
   new case fails because omission or overreach advances, or the customer guidance omits an accepted authority boundary.

4. Proof: Add a versioned judged-eval manifest/corpus for R7 and R10–R16. Pin
   judge identity, rubric digest, deterministic settings, repetitions `3`,
   agreement threshold `2`, expected verdict, allowed finding authority, and
   forbidden scope expansion. Run `bun run test:eval:planning-contracts`;
   in the original RED it must fail adversarial omissions, overreach, instruction
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
   `bun run test tests/integration/planning-evidence-boundary.test.ts tests/integration/planning-scope-review.test.ts tests/integration/planning-documentation.test.ts tests/hooks/product-plan-contract.test.ts tests/integration/plan-state-truthfulness.test.ts`.
10. Add the aggregate `test:eval:planning-reviews` script, then run it to prove
    both the reviewer-capability catalogue and semantic planning contracts.
11. Run:
    `bun run test:bdd:acceptance -- features/keep-plan-reviews-current-and-trustworthy.feature`.
12. Run: `bun run test:bdd:proof`.
13. Run: `bun run lint` and `bun run format:check`.
14. Run: `bun run test:smoke`.

## Obligation ownership

| Accepted obligation                                                                                    | Owning PRs       |
| ------------------------------------------------------------------------------------------------------ | ---------------- |
| R1 shared clauses are authored once and generated into every planning contract                         | PR 2             |
| R2 every review receives complete phase context                                                        | PR 3             |
| R3 required context resolves or fails closed                                                           | PR 3             |
| R4 currency changes only for semantic dependencies                                                     | PR 3             |
| R5 exact canonical generated bytes control installed contract use                                      | PR 2, PR 3       |
| R6 fallback is independent-first, bounded, authenticated, and honestly labeled                         | PR 4             |
| R7 research and reviewed context remain untrusted evidence with durable reuse limits                   | PR 5             |
| R8 ungated surfaces receive advisory guidance only                                                     | PR 4             |
| R9 canonical declaration is decidable; invalidation follows its direction and cannot cross ticket/kind | PR 2, PR 3       |
| R10 all three phases share contract shape but retain bounded approval meanings                         | PR 2, PR 5       |
| R11 finding authority, corrected-byte invalidation, and truthful gate errors                           | PR 1, PR 3, PR 5 |
| R12 scope includes ticket, project, milestone, and parent boundaries and non-goals                     | PR 3, PR 5       |
| R13 completeness rejects both omission and overreach                                                   | PR 5             |
| R14 reviewer corrections cannot silently expand scope and a user decline remains recorded              | PR 3, PR 5       |
| R15 architecture, data, testing, domain, research, and reviewer guidance cannot expand scope           | PR 5             |
| R16 Product Plan review covers every accepted persona outcome and epistemic state                      | PR 5             |
| Existing review history stays preserved and authority-inert when unreadable by active schema           | PR 3, PR 5       |
| Customer docs explain currency, authority, fallback, recovery, and host enforcement                    | PR 4, PR 5       |

## Deferred scope ownership

- User-accepted 2026-10-09 deferral: MCWV4B owns OpenCode CLI/TUI and
  Claude/Cursor Cloud verification after epic #4200. Their four installed
  stale-receipt examples and 12 pending/current/fallback examples remain intact
  under explicit manual/deferral tags;
  they are excluded from the current automated acceptance lane and remain
  unproven. No local simulation counts as cloud acceptance. This does not
  defer shared review/security behavior or the other nondeferred scenarios.
  Cursor repository access setup stops here; no permission change was saved.

- 7CAMAD owns Execution Plan decomposition/content, coding authorization, and
  repair loop; this ticket owns review identity and quality.
- K3EBHB owns final Non-Technical Builder recovery wording and installed-
  surface comprehension proof; this ticket supplies typed reason/recovery data.
- YCFFNC owns migration and coordinated cutover; this ticket adds no migration
  or backfill and keeps older records authority-inert.
- G1C9PP owns 30–60 minute focused reviewability and its receipt judgment; this
  ticket preserves the bounded contract that judgment consumes.
- User-accepted 2026-09-30 deferral: host-level hostile-content injection at the
  planning agent's retrieval boundary. The user owns reopening or changing that
  deferral; the contributor owns producing its boundary evidence once reopened.
  Packet quarantine and the judged corpus do not prove host instruction refusal,
  nonexecution, or nondisclosure. R7, feature, and epic acceptance remain open.
  The Delivery Checklist's `retrieval-proof-deferral` item retains this gap even
  if every narrower command passes; the risk acceptance grants no merge authority.

## Decision accounting

- Consolidate authenticated planning approval authority and truthful refusals:
  `unchanged` — authenticated current phase admission is the sole review
  prerequisite; remove the redundant artifact stamp and render only actual
  `changes_requested` reviewer rejection findings. Human design approval remains
  separate. PR 1 and `phase-approval-proof` carry this decision.

- Bind each verdict to exact plan bytes plus exact bounded canonical-contract
  bytes and semantic context projections, while gating generated copies by exact bytes separately:
  unchanged.
- Extend the existing coordinator and review ledger instead of creating a
  second planning-review subsystem: unchanged.
- Author shared planning clauses once and generate exact marked copies while
  keeping phase-only judgment separate: unchanged.
- Treat semantic projection as a closed domain model, not generic Markdown
  normalization: unchanged.
- Record a user-declined optional strengthening in ticket context: unchanged.
- Confirm reviewer identity through Codex acknowledged, turn-correlated model
  metadata and Claude assistant/result usage agreement; never accept argv, a
  banner, or a selector probe: `unchanged` — PR 4 and `fallback-proof`.
- Classify reviewer capability from qualified exact ordered pairs and fail closed
  when comparison is unavailable: unchanged.
- Admit authenticated reduced-independence receipts without discarding stronger
  completed evidence: unchanged.

The judged eval below proves semantic judgment only. Deterministic integration
remains required for structure, wiring, receipt identity, and corrected bytes.

## Proof specifications

| Proof ID             | Method  | Scope       | Boundary exercised                                                                                                                        | Qualifies as  | Currency         | Invocation                                                                                                                                                                                                                                                                       |
| -------------------- | ------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ------------- | ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| phase-approval-proof | command | integration | Installed CLI plan approval through authenticated phase admission and typed rejection rendering | real_boundary | current_required | {"type":"command","cwd":"packages/cli","argv":["../../scripts/dev","bun","run","test","tests/integration/plan-design-approval.test.ts","tests/integration/plan-transition-gate.test.ts","tests/integration/review-receipt-wiring.test.ts"]} |
| contract-proof | command | integration | Canonical generator through schema reconciliation, installed copies, and lifecycle copy checks | real_boundary | current_required | {"type":"command","cwd":"packages/cli","argv":["../../scripts/dev","bun","run","test","tests/integration/planning-contract-generation.test.ts","tests/integration/installed-planning-copy-admission.test.ts","tests/review/plan-rubric-generation.test.ts","tests/review/execution-plan-rubric-generation.test.ts","tests/schema.test.ts","tests/parity.test.ts"]} |
| identity-proof | command | integration | Filesystem context resolution through coordinator job, ledger stamp, and phase admission | real_boundary | current_required | {"type":"command","cwd":"packages/cli","argv":["../../scripts/dev","bun","run","test","tests/review/planning-context.test.ts","tests/integration/planning-review-identity.test.ts","tests/integration/planning-review-disposition.test.ts","tests/integration/phase-review-gate.test.ts","tests/integration/planning-context-currency.test.ts","tests/review/job.test.ts"]} |
| fallback-proof | command | integration | Coordinator exhaustion through authenticated fallback receipt and installed host gates | real_boundary | current_required | {"type":"command","cwd":"packages/cli","argv":["../../scripts/dev","bun","run","test","tests/integration/planning-review-fallback.test.ts","tests/integration/planning-review-zero-independent.test.ts","tests/integration/planning-review-route-order.test.ts","tests/integration/planning-review-host-gates.test.ts","tests/review/policy.test.ts","tests/review/surface-parity.test.ts"]} |
| evidence-proof | command | integration | Retrieval quarantine through durable evidence record and installed planning/review entry points | real_boundary | current_required | {"type":"command","cwd":"packages/cli","argv":["../../scripts/dev","bun","run","test","tests/integration/planning-evidence-boundary.test.ts","tests/integration/planning-scope-review.test.ts","tests/hooks/product-plan-contract.test.ts"]} |
| documentation-proof | command | integration | ADR supersession, customer-facing README/website content, and generated host guidance through exact assertions | real_boundary | current_required | {"type":"command","cwd":"packages/cli","argv":["../../scripts/dev","bun","run","test","tests/integration/planning-documentation.test.ts"]} |
| planning-evals-proof | command | eval | Pinned repeated capability-catalogue and semantic-contract corpora exercise exact planning rubrics and default cross-provider comparisons | real_boundary | current_required | {"type":"command","cwd":"packages/cli","argv":["../../scripts/dev","bun","run","test:eval:planning-reviews"]} |
| feature-proof | command | E2E | Complete feature through real Cucumber entry point and step wiring | real_boundary | current_required | {"type":"command","cwd":".","argv":["scripts/dev","bun","run","test:bdd:acceptance","--","features/keep-plan-reviews-current-and-trustworthy.feature"]} |
| release-proof | command | E2E | Repository smoke boundary after integrated feature changes | real_boundary | current_required | {"type":"command","cwd":".","argv":["scripts/dev","bun","run","test:smoke"]} |
| failure-proof | command | integration | Context, copy, route, identity and origin refusal through their public integration paths | real_boundary | current_required | {"type":"command","cwd":"packages/cli","argv":["../../scripts/dev","sh","-c","bun run test tests/integration/planning-contract-generation.test.ts tests/integration/installed-planning-copy-admission.test.ts tests/review/plan-rubric-generation.test.ts tests/review/execution-plan-rubric-generation.test.ts tests/schema.test.ts tests/parity.test.ts tests/review/planning-context.test.ts tests/integration/planning-review-identity.test.ts tests/integration/planning-review-disposition.test.ts tests/integration/phase-review-gate.test.ts tests/integration/planning-context-currency.test.ts tests/review/job.test.ts tests/integration/planning-review-fallback.test.ts tests/integration/planning-review-zero-independent.test.ts tests/integration/planning-review-route-order.test.ts tests/integration/planning-review-host-gates.test.ts tests/review/policy.test.ts tests/review/surface-parity.test.ts tests/integration/planning-evidence-boundary.test.ts tests/integration/planning-scope-review.test.ts tests/hooks/product-plan-contract.test.ts"]} |
| complete-testing-proof | command | integration | All named deterministic integration boundaries plus pinned planning evals | real_boundary | current_required | {"type":"command","cwd":"packages/cli","argv":["../../scripts/dev","sh","-c","bun run test tests/integration/plan-design-approval.test.ts tests/integration/plan-transition-gate.test.ts tests/integration/review-receipt-wiring.test.ts tests/integration/planning-contract-generation.test.ts tests/integration/installed-planning-copy-admission.test.ts tests/review/plan-rubric-generation.test.ts tests/review/execution-plan-rubric-generation.test.ts tests/schema.test.ts tests/parity.test.ts tests/review/planning-context.test.ts tests/integration/planning-review-identity.test.ts tests/integration/planning-review-disposition.test.ts tests/integration/phase-review-gate.test.ts tests/integration/planning-context-currency.test.ts tests/review/job.test.ts tests/integration/planning-review-fallback.test.ts tests/integration/planning-review-zero-independent.test.ts tests/integration/planning-review-route-order.test.ts tests/integration/planning-review-host-gates.test.ts tests/review/policy.test.ts tests/review/surface-parity.test.ts tests/integration/planning-evidence-boundary.test.ts tests/integration/planning-scope-review.test.ts tests/hooks/product-plan-contract.test.ts tests/integration/planning-documentation.test.ts && bun run test:eval:planning-reviews"]} |
| slice-review-proof | review_receipt | integration | Current reviewed slice boundaries, dependencies, and safe intermediate development states; final code review remains required | real_boundary | current_required | {"type":"review_receipt","kind":"plan-execution","targets":[".project/tickets/5F5ZZA-keep-plan-reviews-current-and-trustworthy/execution-plan.md"]} |
| live-model-proof | command | E2E | Fresh installed coordinator through real Claude/Codex exact-selector model confirmation | real_boundary | current_required | {"type":"command","cwd":"packages/cli","argv":["../../scripts/dev","env","SAFEWORD_RUN_PLANNING_MODEL_LIVE=1","bun","run","test:smoke:live","tests/smoke/planning-review-model-confirmation.live.test.ts"]} |
| packaged-release-proof | command | integration | Packaged default ordered-pair qualification, current generated runtimes, and release conformance | real_boundary | current_required | {"type":"command","cwd":"packages/cli","argv":["../../scripts/dev","bun","run","test:release"]} |

## Delivery checklist

<!-- safeword:delivery-checklist:v1 -->

| ID                     | Category                                  | Obligation                                                                                                                                           | Owner       | Required proof       | Disposition    | Evidence class | Revision | Evidence, reason, or dependency                                                |
| ---------------------- | ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | -------------------- | -------------- | -------------- | -------- | ------------------------------------------------------------------------------ |
| outcome-scope          | outcome and scope                         | Deliver the nondeferred R1–R16 boundaries without redefining sibling scope; R7 host acceptance remains open under retrieval-proof-deferral                                         | contributor | feature-proof        | open           | missing        |          |                                                                                |
| resolved-decisions     | resolved decisions                        | Preserve all nine recorded decisions and exact/fallback/capability/user-authority boundaries                                                        | contributor | feature-proof        | open           | missing        |          |                                                                                |
| pr-decomposition | dependency and pull-request decomposition | Deliver five ordered slices safe without successors; obtain current review of their boundaries | contributor | slice-review-proof | open | missing |  |  |
| testing                | testing                                   | Complete nondeferred boundary/ledger proof and pinned evals; preserve unfinished R7 host acceptance regardless of narrower scenario passes          | contributor | complete-testing-proof | open           | missing        |          |                                                                                |
| data-compatibility     | data and compatibility                    | Add versioned identity/evidence to existing job results and user dispositions to tickets; preserve history with no new store, migration, or backfill | contributor | identity-proof       | open           | missing        |          |                                                                                |
| monitoring             | monitoring and failure signals            | Expose typed context, copy, route, identity, and origin failures with one recovery action                                                            | contributor | failure-proof       | open           | missing        |          |                                                                                |
| security-privacy       | security and privacy                      | Preserve credential/privacy boundaries and deny execution or instruction authority to evidence                                                       | contributor | evidence-proof       | open           | missing        |          |                                                                                |
| rollout-rollback       | rollout and rollback                      | Release PR 2–4 together after integration; rollback preserves inert records and ledger history                                                                        | contributor | identity-proof       | open           | missing        |          |                                                                                |
| documentation          | documentation                             | Update guidance, README, website, ADR marker, and generated host copies                                                                              | contributor | documentation-proof  | open           | missing        |          |                                                                                |
| ownership-dependencies | ownership and human dependencies          | Keep sibling obligations deferred to named owners and invent no human authority                                                                      | contributor | feature-proof        | open           | missing        |          |                                                                                |
| live-model-confirmation | testing | Prove current exact packaged reviewer selectors through actual installed Claude and Codex protocols; no skipped route qualifies | contributor | live-model-proof | open | missing | | |
| packaged-release | rollout and rollback | Verify current packaged default comparisons and coherent generated runtimes before any release | contributor | packaged-release-proof | open | missing | | |
| design-approval        | ownership and human dependencies          | Obtain configured human design approval                                                                                                              | human       |                      | not_applicable | missing        |          | Project `designApprovalGate` is disabled; review is not human design approval. |
| retrieval-proof-deferral | ownership and human dependencies | Resolve the user-owned R7 host-retrieval proof deferral and establish its boundary evidence before claiming complete R7, feature, or epic acceptance | human | | pending_human | missing | | User deferred this proof on 2026-09-30; narrower packet or judged evidence cannot close this item. |
| completion-evidence    | completion evidence                       | Produce current receipts for delivered boundaries and evals; do not claim complete feature or epic acceptance while retrieval-proof-deferral is open                                                                | contributor | release-proof        | open           | missing        |          |                                                                                |
