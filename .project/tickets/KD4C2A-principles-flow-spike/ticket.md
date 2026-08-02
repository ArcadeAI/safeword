---
id: KD4C2A
slug: principles-flow-spike
type: feature
phase: verify
status: in_progress
phase_skips:
  - intake: Completed before the first feature checkpoint; the scoped spec and intake work log are committed with this ticket.
  - define-behavior: Completed before the first feature checkpoint; the dimensions and scenario ledger are committed with this ticket.
  - scenario-gate: Completed before the first feature checkpoint; the approved feature and review work log are committed with this ticket.
  - plan-implementation: Completed before the first feature checkpoint; the reviewed implementation plan and phase anchor are committed with this ticket.
created: 2026-08-02T14:08:58.443Z
last_modified: 2026-08-02T18:10:00Z
scope:
  - scaffold principles as configurable user-owned project knowledge with health parity
  - make Design alignment canonical while accepting legacy Arch alignment plans
  - carry principles personas and surfaces through creation independent review verification and audit
  - document the shared project-knowledge configuration contract
  - preserve workflow parity across canonical dogfood Cursor and Codex surfaces
out_of_scope:
  - semantic scoring or hook enforcement of principle persona or surface quality
  - a new per-ticket project-knowledge artifact or copied catalogue
  - migration of Safeword's repo-root PRINCIPLES.md content
  - cloud-runtime-specific workflow behavior
done_when:
  - setup and check prove default configured missing and orphaned principle path behavior without overwrites
  - new Design alignment plans and legacy Arch alignment plans both parse and gate successfully
  - independent review and verification consume the relevant project-knowledge sources and evidence
  - audit checks only objective references traces and evidence links including configured paths
  - public docs explain principles personas and surfaces configuration and lifecycle
  - canonical dogfood Cursor and Codex contracts plus the full test suite pass
phase_anchors:
  - define-behavior: .project/tickets/KD4C2A-principles-flow-spike/spec.md
  - scenario-gate: features/principles-flow-spike.feature
  - implement: .project/tickets/KD4C2A-principles-flow-spike/impl-plan.md
  - verify: .project/tickets/KD4C2A-principles-flow-spike/verify.md
---

# Make project knowledge shape and challenge feature delivery

**Goal:** Ship a proportional project-knowledge thread from feature discovery through independent review, verification, and objective audit.

**Why:** Principles currently influence plans by convention, but the workflow does not make applicability, consequence, proof, and reconciliation explicit.

## Scope

- Manage project principles as project knowledge, parallel to personas: a
  scaffolded, user-owned `<namespace-root>/principles.md` with an optional
  `paths.principles` override.
- Load principles before classifying/building work, but record only principles
  that materially change behavior, design, proof, or an intentional deviation.
- For features, carry applicable principles through `impl-plan.md`'s existing
  alignment section, make `Design alignment` canonical while accepting legacy
  `Arch alignment`, and reconcile the claims before verify.
- Give spec, scenario, plan, and quality reviewers the relevant principles,
  personas, and surfaces so they can challenge applicability, fulfillment,
  consequence, proof, and intentional deviations.
- Keep audit limited to objective trace integrity; principle judgment remains a
  review responsibility.
- Complete the same review contract for personas and surfaces, including
  configured-path health and per-surface verification evidence.
- Document the shared configuration and ownership lifecycle for principles,
  personas, and surfaces.
- Preserve the contract across canonical templates, dogfood Claude content,
  thin Cursor references, and generated Codex assets.
- Exercise the contract with both an experience principle (`delight the user`)
  and a sourcing principle (`adopt and extend OSS before bespoke`).

## Out of Scope

- Semantic scoring or hook-enforcement of principle compliance.
- A new per-ticket project-knowledge artifact or copied catalogue.
- Migrating or rewriting the existing repo-root `PRINCIPLES.md`; its configured
  compatibility route is sufficient.
- Cloud-runtime-specific workflow behavior.

## Done When

- [ ] Setup and check cover default, configured, missing, and orphaned principle
      paths without overwriting user content.
- [ ] New plans use `Design alignment`; new and legacy headings both parse and
      gate, while missing or simultaneous aliases fail with remediation.
- [ ] Spec, scenario, plan, and quality reviewers receive the relevant project
      knowledge and challenge type-specific behavior and proof.
- [ ] Verification records persona experience and proof per affected surface;
      audit checks only objective references, traces, and evidence links.
- [ ] Public docs explain principles, personas, and surfaces configuration,
      ownership, health, and preservation behavior.
- [ ] Canonical, dogfood, Cursor, and Codex contracts plus the full suite pass.

## Spike Evidence Already Established

- [x] Principles default/override resolution and setup preservation.
- [x] Proportional principle mapping and implement-exit reconciliation guidance.
- [x] Independent principle/persona/surface challenge guidance and configured
      surface audit/health resolution.
- [x] Focused tests demonstrated the production direction is viable.

## Spike Results

### Verdict

**GO on the knowledge model; revise the plan surface before shipping.** Principles
fit the same ownership and resolution machinery as personas: scaffold once,
user-owned thereafter, namespace-root aware, and redirectable through
`paths.principles`. They do not fit persona-style semantic enforcement.

### What the examples exposed

- **Delight the user** enters at intake: it becomes a concrete Rave Moment and
  observable Rules. At planning, tests prove the mechanics while a persona
  walkthrough or real-user signal proves the experience. Putting that claim
  under `Arch alignment` works mechanically but reads incorrectly.
- **Adopt and extend OSS before bespoke** enters primarily at planning: it
  changes the candidate survey, extension boundary, compatibility proof, and
  reassessment triggers. It fits the current alignment section naturally.

### Learnings

1. **Same storage, different semantics.** Persona identity is factual and can
   hard-block an unknown reference. Principle applicability is judgment; hooks
   should validate file/plan shape, never declare a design principled.
2. **Two reads are necessary.** Read principles before scope/behavior, then
   re-read at plan-implementation so resumed or fresh-context planning does not
   depend on intake memory.
3. **One mapping pays rent.** `principle → concrete consequence → proof` is
   enough traceability. Copying the catalogue or scoring every principle creates
   ceremony without better decisions.
4. **The current heading is too narrow.** `Arch alignment` hides experiential
   and product principles. A production version should rename it to a broader
   `Design alignment` (accepting legacy `Arch alignment`) rather than add a
   second mandatory section.
5. **Patches need no ledger.** Reading a small principles file is cheap; writing
   “not applicable” repeatedly is not. Tasks record only load-bearing effects;
   patches record only deliberate exceptions.
6. **Compatibility is clean.** Safeword can retain its existing root
   `PRINCIPLES.md` through `paths.principles: "PRINCIPLES.md"`; customers get
   `<namespace-root>/principles.md` by default.
7. **Creation and challenge need the same source.** Passing only the plan to an
   adversarial reviewer catches weak prose but cannot catch an omitted or
   misread principle. The reviewer needs the configured principles file.
8. **Audit is the wrong semantic judge.** Quality review challenges whether the
   principle, consequence, and proof are credible. Audit only detects a broken
   trace—missing source principle, incomplete mapping, dead evidence reference,
   or an unrecorded conflict.
9. **Persona identity was strong; persona fulfillment was not.** Intake and
   self-review resolved persona references, but independent review needed the
   persona source and explicit JTBD reconciliation.
10. **Surface tags express intent, not execution.** A scenario tag proves that a
    surface was considered. Verification now records what command/manual check
    actually ran per affected surface, and quality review challenges that proof.
11. **Configured-path parity must be executable.** Audit previously claimed
    persona/surface overrides were covered while reading only default files;
    the resolver and doctor now honor those overrides directly.

### Remaining production work

- Document `paths.principles` in the public config reference.
- Add doctor advisories for a missing configured file and an orphaned default,
  parallel to personas; do not add compliance scoring.
- Decide and migrate the plan heading with a backward-compatible parser alias.
- Generate and verify every packaged Codex/Cursor surface before release.

## Work Log

- 2026-08-02T18:10:00Z Verification: Executed all 72 feature examples, fixed
  the stale legacy-heading acceptance contract, passed the complete 746-scenario
  lane, and passed all 410 Vitest files under a two-worker contention limit.
- 2026-08-02T17:28:00Z Verify entry: Whole-diff quality review exposed and
  resolved two evidence gaps: E010 now validates Markdown fragments and ignores
  supporting principle sections, and a real setup-installed 12-row host-stage
  matrix caught and fixed Cursor self-review's missing current-knowledge input.
- 2026-08-02T17:08:00Z Plan-implementation exit: Fresh review passed, the
  valid planned artifact was stamped, and implementation began with alignment
  compatibility as the load-bearing slice.
- 2026-08-02T17:04:00Z Plan review passed: Named the production review-source
  resolver and its real-entry-point integration test, and fixed the verify.md
  review-record fields before final stamping.
- 2026-08-02T16:55:00Z Plan review corrections: Separated installed-input
  wiring from semantic review evidence, narrowed E010 to explicit conflict
  markers, inventoried every parser consumer, reordered source production ahead
  of audit, and made NTB trust evidence plus production host catalogues explicit.
- 2026-08-02T16:43:00Z Implementation planning: Figure-it-out selected
  canonical heading normalization, shared factual path health, executable E010,
  and installed-host wiring. Kept one feature after the splitting checkpoint;
  authored five ordered slices with no ADR.
- 2026-08-02T16:31:00Z Scenario-gate exit: Stamped the approved feature
  source and advanced to implementation design.
- 2026-08-02T16:29:00Z Scenario gate: Deep quality review and a fresh
  review-spec pass approved all twenty scenarios with no remaining findings.
- 2026-08-02T16:16:00Z Deep quality review: Tightened the twenty-scenario
  contract to exercise every installed host review entry point and require
  claim-linked evidence; split public preservation and orphan documentation
  failures. Scenario count and accepted scope are unchanged.
- 2026-08-02T16:02:00Z Final scenario review: Closed the constant-rejection
  evidence hole, made override suppression fixture-independent, and split
  orphan reporting from preservation. Returned to saturation at twenty scenarios.
- 2026-08-02T15:53:00Z Renewed saturation: User accepted the nineteen-scenario
  set after adversarial corrections; re-entered the independent scenario gate.
- 2026-08-02T15:49:00Z Scenario review: Six must-fix findings were corrected;
  four useful gaps added accepted-deviation, current-source, absent-evidence,
  and clean-override coverage. Returned to define-behavior at nineteen scenarios
  for renewed user saturation.
- 2026-08-02T15:36:00Z Define-behavior complete: User accepted saturation at
  seven Rules and sixteen scenarios; saved the Gherkin source and R/G/R ledger,
  then advanced to the independent scenario gate.
- 2026-08-02T15:24:00Z Quality review: Reconciled the completed spike evidence
  with the active production feature contract; narrowed SWM1.R1 to principles,
  personas, and surfaces. Scenario coverage remains at the user gate.
- 2026-08-02T15:21:00Z Define-behavior: Derived seven behavioral dimensions
  and their boundary partitions before scenario authoring; settled that plans
  containing both alignment aliases are ambiguous and rejected.
- 2026-08-02T15:17:00Z Intake complete: Spec self-review passed after adding
  the missing documentation Rule; advanced to define-behavior with the spec as
  the phase anchor.
- 2026-08-02T15:14:00Z Intake self-review: Found public configuration docs in
  scope without a corresponding Rule; added SWM1.R4 before stamping the spec.
- 2026-08-02T15:11:00Z Intake Rules gate passed: User accepted all six Rules;
  translated them into scope, out-of-scope, and observable done-when fields for
  the engineering-scope gate.
- 2026-08-02T15:08:00Z Intake JTBD gate passed: User confirmed the NTB trust
  job and SWM lifecycle-maintenance job; decomposed them into six Rules for the
  criteria gate.
- 2026-08-02T15:05:00Z BDD intake: User explicitly promoted the spike to the
  full feature workflow; loaded configured principles, personas, glossary, and
  surfaces and drafted the intake brief plus JTBDs for confirmation.
- 2026-08-02T14:52:00Z Verified: Eleven focused files passed 265/265 tests,
  including CLI health, configured audit fixtures, canonical/dogfood/Codex
  review contracts, schema, hook coverage, and invocation logging. TypeScript,
  Prettier, parity, and diff integrity passed.
- 2026-08-02T14:48:00Z GREEN: Extended persona and surface sources through
  self-review, scenario review, independent plan review, quality review, and
  verification; added surface-path doctor parity and configured-path audit
  reconciliation.
- 2026-08-02T14:43:00Z RED: Fifteen host-surface review assertions plus
  configured surface-health and audit-override cases exposed the expected gaps.
- 2026-08-02T14:29:00Z Verified: Ten focused files passed 157/157 tests;
  TypeScript typecheck, Prettier, diff integrity, 200 parity pairs, and eight
  parity contracts passed. Regenerated the packaged Codex review surfaces.
- 2026-08-02T14:27:00Z GREEN: Principles now enter the independent plan review
  and whole-ticket quality review; audit checks only objective trace integrity
  and reports broken mappings as E010.
- 2026-08-02T14:25:00Z RED: Seven new review-contract assertions failed across
  plan, quality-review, and audit surfaces, confirming the creation-only gap.
- 2026-08-02T14:17:00Z Verified: Seven focused files passed 111/111 tests;
  TypeScript typecheck and Prettier checks passed. Spike remains in progress
  pending user discussion; no commit made.
- 2026-08-02T14:14:00Z GREEN: Added the principles knowledge scaffold,
  `paths.principles` resolution/schema ownership, proportional SAFEWORD
  guidance, feature-plan consequence/proof mapping, and implement-exit
  reconciliation; synced five generated dogfood copies.
- 2026-08-02T14:11:54Z RED: Focused suite failed in the intended five places:
  missing scaffold, missing partial-root repair, no planning mapping, and no
  canonical/dogfood reconciliation wording; 68 neighboring checks passed.
- 2026-08-02T14:10:21Z Scoped: User chose the personas model — configurable,
  scaffolded project knowledge rather than repo-only prose or per-ticket copies.
- 2026-08-02T14:08:58.443Z Started: Created ticket KD4C2A
