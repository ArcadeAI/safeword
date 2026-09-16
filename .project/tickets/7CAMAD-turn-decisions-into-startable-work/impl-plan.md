# Implementation Plan: Turn accepted decisions into startable work

**Status:** planned
**Planned on:** 2026-09-16

## Approach

### Architecture at a glance

The [approved scenarios](../../../features/turn-decisions-into-startable-work.feature)
remain the behavior contract. Implementation Planning owns decisions;
Execution Planning owns ordered work, exact proof mechanics, Delivery Checklist
obligations, and pull-request slices; TDD owns the implementation loop. This
ticket connects those already accepted contracts at one coding-authorization
boundary. It does not add another planning artifact or approval authority.

One read-only public CLI operation, `ticket coding-authorization <ticketId>`,
will answer whether coding is authorized for one feature ticket. It composes the existing authenticated scenario review,
accepted Implementation Plan (including configured human design approval), and
admitted normalized Execution Plan review. The `plan-execution → implement`
transition and production-code edit gate consume that same result. Structural
checks report artifact and receipt facts; only the semantic reviews decide plan
quality.

Implementation-time changes follow the dependency direction already accepted
in `ARCHITECTURE.md`. Product Plan identity comprises `spec.md`, the approved
feature source, and the normalized `scope`, `out_of_scope`, and `done_when`
ticket fields. A change to that identity or the Implementation Plan stales both
planning reviews; a stable Execution Plan definition change stales its own
review; ordinary Delivery Checklist progress does not. A stale authorization
stops subsequent production edits. During replan, the canonical A639WN
evidence-state update preserves proof whose accepted boundary is unchanged and
demotes proof invalidated by the changed decision to audit evidence, reopening
that obligation for current proof. The agent returns to the earliest affected
planning phase, reviews the corrected exact bytes, and resumes from the first
affected obligation.

### Riskiest assumption and cheapest proof

The riskiest assumption is that a thin hook can enforce current semantic
authorization without becoming a second authority or trusting editable receipt
text. The cheapest discriminating proof is an installed-CLI integration flow:
admit all three reviews, authorize coding, change the stable Implementation or
Execution Plan definition, observe a production edit denied, re-review the
affected plan or plans, and observe authorization restored. Evidence retention
and demotion after a changed decision are a separate delivery-compatibility
boundary proved in build step 5.

### Proof strategy

| Behavior cluster                                              | Owner                                                                                                                                                     | Primary proof and real boundary                                                                                                                        | Supporting proof                                                                                                      | Confidence limit                                                                                            |
| ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Reviewed current approach controls Execution Planning         | G1C9PP-owned plan approval command plus this ticket's phase-transition consumer                                                                            | Integration through the installed CLI and real pre-tool hook process                                                                                   | Table-driven receipt, verdict, provenance, and digest cases                                                           | Proves local installed enforcement, not host delivery owned by YCFFNC                                       |
| Execution steps are startable and preserve accepted decisions | Canonical Execution Planning author/reviewer contract and conformance admission                                                                           | Installed-CLI `plan-execution` review over complete scenarios, Implementation Plan, and Execution Plan, including omission without placeholder tokens  | Deterministic packet, contract-identity, placeholder-rejection, and output-validation tests                           | Representative admitted reviewers can still make semantic judgment errors                                   |
| Execution discoveries return to the owning phase              | Execution Planning semantic contract classifies whether a discovery changes an accepted design or proof boundary; the approval command applies the result | Installed-CLI semantic review varies a fixture change that stays, an accepted-boundary change that returns, and a path change that also changes an API contract | Typed output validation refuses an unknown destination                                                                | Semantic review can misclassify novel prose; exact representative partitions constrain admitted identities  |
| Coding requires current project-local plans                   | New coding-authorization CLI projection consumed by the pre-tool hook                                                                                     | Installed-CLI production-edit integration covers authorization currentness and the simultaneous stale-plan plus unmet-RED state, asserting plan repair is the surfaced recovery | Verdict and provenance partitions; forged self-claim; stale project-local plan plus host note; mutable phase without validated provenance | Local hooks cannot enforce hosts that do not dispatch them; K3EBHB owns full progressive recovery rendering |
| Structural plan facts stay distinct from semantic approval    | Existing phase-provenance and plan-presence projections                                                                                                   | Closed output-shape integration covers present/valid, absent, and present-but-unreadable artifacts and rejects semantic-readiness claims                | Unit cases cover malformed status and receipt shapes                                                                  | Negative vocabulary checks cannot prove every future synonym is harmless                                    |
| Accepted proof becomes TDD work                               | BDD ledger and executable-RED gate                                                                                                                        | Integration through the real hook workflow proves pre-RED production edits are denied with the named RED recovery, then RED, GREEN, and REFACTOR proceed | Existing ledger parser and executable-RED tests                                                                       | Does not prove the eventual feature under development is correct                                            |
| Obligation, checklist, evidence, and PR-slice completeness    | Existing plan-execution record and Delivery Checklist admission                                                                                           | Semantic review covers omitted, partially mapped, and explicitly obligation-free approaches, known-defect versus target state, pending human authority, and canonical A639WN/6XW8H7 contract identity | Existing parser, normalized-digest, proof-currency, checklist, and slicing matrices                                   | Structural admission cannot establish semantic relevance by itself                                          |
| Measurement work preserves the accepted promise               | Execution Planning semantic contract                                                                                                                      | Installed-CLI semantic review varies instrumentation, evidence, target, and origin                                                                     | Packet completeness and contract-identity tests                                                                       | No quantitative product promise exists for this child itself                                                |
| Dependency-directed invalidation and replanning               | Coding authorization, review identities, and A639WN's `delivery-compatibility` review plus durable `delivery-compatibility:v1` decision event             | Git-backed integration separately varies `spec.md`, approved feature bytes, normalized ticket scope fields, Implementation Plan bytes, stable Execution Plan definition, and ordinary checklist progress | Mutation tests assert preserved proof keeps the byte-identical evidence class without a new proof-execution receipt, while invalidated proof becomes audit-only | Exact-byte upstream identity can require review for cosmetic edits; that conservative cost is deliberate    |
| Approval claims stay narrow                                   | Typed coding-authorization result                                                                                                                         | Public CLI integration rejects implementation, verification, release, and merge claims                                                                 | Closed result-shape tests                                                                                             | Human merge policy remains outside Safeword authority                                                       |

The Safeword CLI is the only affected M1 runtime surface. Claude Code, Claude
Code Cloud, OpenAI Codex, OpenCode, Cursor, and Cursor Cloud Agents remain
explicitly delegated to
[YCFFNC](../YCFFNC-migrate-planning-guidance-without-disrupting-features/ticket.md),
which will install and prove the canonical behavior on each applicable host.

### Build order

1. Insert `plan-execution` into the canonical phase model, phase evidence,
   provenance lists, planning code freeze, and parity fixtures. Then prove the
   public coding-authorization result from the three existing prerequisites and
   wire both thin consumers against the same provenance fixture. The minimal
   loop for this slice must invoke the installed CLI through the real
   transition and production-edit hook process; unit or fixture-only consumer
   calls are supporting proof, not the load-bearing proof. Register the
   command under Typed CLI Execution and Discovery with read-only effects,
   schema-v1 JSON, non-interactive operation, deterministic fixtures,
   command-reference reconciliation, and the standard exit mapping. The
   minimal risk loop must show the transition and production-edit boundaries
   return the same authorization and denial identity for three states: current
   plans authorize, a stable plan change denies, and a fresh review restores
   authorization. Its closed result shape must also
   reject attempts to infer implementation, verification, human release
   approval, or merge authority. This is the load-bearing slice.
2. First prove installed-CLI admission and mismatch rejection for the canonical
   Execution Planning, A639WN, and 6XW8H7 contract bytes. Then add the semantic
   conformance cases for discovery routing, disguised data decisions, concrete
   proof work, a later unstartable step, omitted, partially
   mapped without dependency order, completion signal, or pull-request owner,
   completely mapped, and explicitly obligation-free approaches, current defect
   versus target work, pending human
   authority, all four A639WN evidence classes and the partial-proof rejection,
   missing and mismatched canonical contracts, fixture and test-command changes,
   incomplete prerequisites, empty plans, risk-first ordering, explicit safe
   parallelism, one-purpose and dependency-ordered multi-purpose contribution
   shapes, stale project-local plans coexisting with host-local approval notes,
   and measurement execution.
3. Make the Implementation Planning exit enforce R1's absent artifact, missing
   semantic receipt, stale receipt, rejected verdict,
   missing-achieved-independence, unearned-assurance, permitted-fallback
   provenance, and disregarded self-authored-claim states, plus the positive
   admitted-review path into Execution Planning and its schema-owned
   `execution-plan.md` template scaffold.
4. Harden phase provenance beyond the basic transition wired in step 1:
   implement entry requires `execution-plan.md`. Production-edit enforcement is
   monotonic for the new flow: any authenticated `plan-execution` provenance,
   admitted Execution Plan review, or project-local Execution Plan activates the
   gate, and a missing or downgraded prerequisite then denies coding. An editable
   phase field alone cannot activate the gate. A legacy feature with none of
   those durable markers remains outside M1 until YCFFNC migrates it.
5. Extend the basic production-edit denial from step 1 with implementation-time
   ordering and replan behavior. When both planning authorization and the named
   RED are unsatisfied, surface plan repair first. Preserve unchanged evidence
   through A639WN's `delivery-compatibility` review and durable
   `delivery-compatibility:v1` decision event, asserting its evidence class is
   byte-identical and no proof command reruns; demote proof invalidated by a
   changed decision to audit history before work resumes.
6. Update the canonical BDD workflow, Safeword handbook, and existing
   planning-gates architecture record so `plan-execution` has its entry,
   artifact, review exit, resume behavior, code freeze, shared authorization
   projection, gate summary, return paths, and the rollback migration defined
   under Compatibility below; then regenerate host derivatives.
7. Prove the complete cold-start journey from accepted Implementation Plan to
   reviewed Execution Plan to the first executable RED, plus both
   implementation-time replan branches.

The resulting Execution Plan will decide the exact test files, commands,
generated-asset order, and independently reviewable PR slices. Those mechanics
do not belong in this decision record.

### Persona and operational consequences

| Persona               | Consequence                                                                                                               | Confidence limit                                                     |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Technical Builder     | Gets a direct, inspectable authorization verdict and retains exact review and proof evidence without a new approval layer | Installed-host parity remains YCFFNC's responsibility                |
| Non-Technical Builder | Gets one concrete repair path when coding is unsafe, without having to interpret plan digests or reviewer internals       | K3EBHB owns the final plain-language rendering across every gate     |
| Safeword Maintainer   | Maintains one prerequisite evaluator and one authorization projection rather than duplicated hook logic                   | The hook still depends on resolving and invoking a healthy local CLI |

### Compatibility, rollout, and rollback

This is an unreleased workflow extension. The public authorization result has
no legacy exemption: whenever it is invoked, a missing or stale plan denies
coding. During the M1-to-M2 window, the production-edit consumer activates for
tickets with any authenticated `plan-execution` provenance, admitted Execution
Plan review, or project-local Execution Plan. Once present, those markers make
enforcement monotonic: losing a prerequisite denies rather than exempts the
ticket. A mutable phase field alone cannot activate the gate. The delegated
host-migration work covers later activation for earlier in-flight tickets with
none of those markers. New contracted features enter implementation only
through the new phase. Rollback first moves every ticket still at
`plan-execution` back to `plan-implementation`, then removes the unreleased
authorization command, transition consumer, phase value, and guidance
together. Retained Execution Plans, review jobs, and ledger events become inert
audit history and require no further data reversal.

Implementation may begin only after the current scenario artifacts and this
exact Implementation Plan have admitted reviews. The canonical parent-contract
reconciliation gate remains authoritative for Product Plan currency at
transition time.

Failures are closed and actionable: unreadable state, missing artifacts,
unapproved or stale reviews, missing configured human authority, and an
unavailable CLI all refuse coding rather than guessing. Review transport,
provenance rules, and fallback policy remain owned by 5F5ZZA.

Measurement applicability: skip: this child makes no quantitative product
promise. It requires Execution Planning to translate any accepted upstream
measurement promise into instrumentation, test, and evidence work without
changing the promise or measurement design.

## Decisions

### Implementation Inspiration

<!-- prettier-ignore -->
| Reference | Checked on | Source version | Target version | Evidence of fit | Principle to borrow | Mismatch / license / security boundary |
| --- | --- | --- | --- | --- | --- | --- |
| [execution prerequisite](../../../packages/cli/src/commands/execution-prerequisite.ts) and [its installed-CLI proof](../../../packages/cli/tests/integration/delivery-execution-prerequisite.test.ts) | 2026-09-16 | commit 549c9c38ae28354c678646babd4ab413044b71af | this unreleased #4200 branch | Already composes authenticated scenario, approach, design-approval, and normalized Execution Plan admission without granting authority | Project a narrow authorization result from one prerequisite source instead of rebuilding its checks | Project-owned source is the authority for current behavior; no code or license crosses repositories |
| [pre-tool quality hook](../../../packages/cli/templates/hooks/pre-tool-quality.ts) and [its transition proof](../../../packages/cli/tests/integration/plan-transition-gate.test.ts) | 2026-09-16 | commit 549c9c38ae28354c678646babd4ab413044b71af | this unreleased #4200 branch | Shows the established local CLI subprocess seam for semantic gates and the production-edit enforcement boundary | Keep the hook a thin consumer of typed CLI truth | Hook dispatch exists only on supported local hosts; YCFFNC owns parity and advisory-only surfaces |
| [accepted planning architecture](../../../ARCHITECTURE.md#separate-implementation-and-execution-planning-gates) | 2026-09-16 | accepted decisions through 2026-09-12 | this unreleased #4200 branch | Fixes phase ownership, review identity, and dependency-directed currentness before this child chooses wiring | Enforce the accepted dependency graph rather than introduce a parallel state machine | Human-readable architecture is trusted project evidence; runtime tests must prove implementation conformance |

**Decision impact:** retained: the existing execution-prerequisite service and
local CLI hook seam already form the smallest shared boundary; add a narrow
authorization projection and consumers rather than a second checker.
**Decision informed:** Derive coding authorization once and consume it at both coding boundaries

### Recorded Decisions

| Decision                                                                  | Choice                                                                                                                                                                                    | Alternatives considered                                                               | Rejected because                                                                                                            |
| ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Derive coding authorization once and consume it at both coding boundaries | Add one read-only public coding-authorization result over the existing prerequisite service; use it for `plan-execution → implement` and production-code edits                            | Duplicate checks in the hook; gate only the phase transition                          | Duplication creates two authorities that can drift; transition-only enforcement misses a plan changed during implementation |
| Expose `ticket coding-authorization <ticketId>` through the public typed CLI | Register that read-only authorization projection in discovery and let both hook consumers invoke the inspectable contract                                                                  | Keep a hidden latency-oriented hook helper                                             | The same result must support transition enforcement, per-edit enforcement, TBU inspection, stable recovery, and closed authority claims; a hidden adapter would create a second less-inspectable surface |
| Keep semantic and structural responsibilities separate                    | Structural gates report artifact, receipt, digest, and provenance facts; semantic review decides completeness, startability, decision preservation, and proof quality                     | Parse prose heuristically in hooks; trust a reviewer without structural admission     | Heuristics turn formatting into quality judgment; unadmitted reviewer output can fabricate approval                         |
| Reuse content-bound review identity for dependency-directed replanning    | Exact upstream plan changes invalidate dependent authorization; the Execution Plan's reviewed normalization excludes only ordinary Delivery Checklist progress; unchanged proof retains its class and proof invalidated by a changed decision becomes audit-only | Add an invalidation ledger or mutable stale flags; restart all work; preserve every proof | Existing review identity already represents currentness; another store creates synchronization failure, while full restart loses valid work and indiscriminate preservation overstates completion |
| Preserve TDD as a separate implementation contract                        | Execution Planning names exact RED/GREEN/REFACTOR work; the existing BDD ledger and executable-RED gate prove ordering                                                                    | Treat an approved Execution Plan as RED evidence; invent a second task ledger         | Planning approval proves startability, not execution; a second ledger would compete with `test-definitions.md`              |
| Surface planning repair before executable RED                              | On a production edit, evaluate current planning authorization first and executable-RED authorization second                                                                             | Report RED first; combine unrelated failures into one recovery                         | RED cannot authorize work under a stale plan; one ordered repair avoids sending a builder to an action that remains blocked  |
| Activate M1 enforcement without a provenance bypass                        | Treat any authenticated new-flow provenance, admitted Execution Plan review, or project-local Execution Plan as a monotonic gate marker; a later missing or downgraded prerequisite denies coding | Gate every in-flight feature immediately with a per-ticket exemption list; trust only the mutable phase field | Immediate universal gating disrupts legacy work and adds exemption state; a phase field is forgeable, while durable new-flow markers distinguish migrated work without making their later loss authorize edits |

#### Reversibility and boundaries

The shared reversal is to remove the unreleased command and thin consumers;
existing prerequisites, plans, receipts, review identities, and valid proof
remain inert audit history. Per-decision boundaries are:

| Decision                        | Dependency, license, and security boundary                                                         |
| ------------------------------- | -------------------------------------------------------------------------------------------------- |
| Coding authorization projection | Existing Bun runtime, CLI envelope, review jobs, and local files only; no new dependency or egress |
| Semantic/structural separation   | Structural outputs never gain semantic approval authority                                           |
| Production edit gate            | Same-user local hook, not an OS sandbox or remote-host guarantee                                   |
| Review invalidation             | Existing authenticated review storage and normalized Execution Plan definition                     |
| TDD handoff and denial ordering | Existing ticket ledger and executable-RED reviewer remain authoritative after planning authorizes work |
| Dependency-directed replanning  | The accepted review dependency graph remains authoritative                                         |

Plan identity remains deliberately asymmetric: Product and Implementation Plan
reviews bind exact authored bytes. The Execution Plan digest excludes only
ordinary contributor progress cells whose stable definition was already
reviewed. Safeword does not attempt to decide whether two Markdown documents
are semantically equivalent.

### Data applicability

This feature extends the persisted workflow phase enum with `plan-execution`
and gives project-local `execution-plan.md` an explicit lifecycle: scaffolded
after the accepted Implementation Plan, reviewed against that exact approach,
current across ordinary Delivery Checklist progress, stale after stable plan or
upstream approach changes, and retained as inert audit history on rollback.
Authenticated phase provenance, admitted review state, and the project-local
Execution Plan control the migration window; an editable phase field alone does
not. Existing review jobs and append-only ledger events remain the storage
authorities; there is no new database, cross-system data flow, or formal
data-architecture document to add.

## Design alignment

| Principle                                         | Consequence                                                                                                                   | Proof                                                                                                        | Conflict          |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ----------------- |
| Structure enforces; instructions suggest          | Current authenticated plan receipts are a hard prerequisite for coding; prose cannot self-authorize                           | [R1/R9 contract](features/turn-decisions-into-startable-work.feature); installed CLI and hook mutation prove prose or an editable claim cannot authorize |                   |
| Fire at boundaries, not every turn                | Authorization is evaluated at implement entry and attempted production edits, not injected into ordinary conversation         | [R9 contract](features/turn-decisions-into-startable-work.feature); hook integration proves only transition/edit invocation and no prompt injection | explicit-conflict |
| Discover decisions before prescribing work        | Execution work may consume accepted decisions but must return any changed design or proof boundary to Implementation Planning | [R4/R6 contract](features/turn-decisions-into-startable-work.feature); conformance mutations distinguish execution-only, design, proof, and data changes |                   |
| Correct and safe; then clear; then simple         | One prerequisite source, one narrow authorization projection, and thin consumers avoid a second state machine                 | [R9 contract](features/turn-decisions-into-startable-work.feature); one fixture proves both boundaries return the same authorization result and denial identity, while a source assertion requires both consumers to call the single authorization entry point and fails if either consumer computes a prerequisite itself |                   |
| Optimize for the NTB without constraining the TBU | The public result exposes exact technical evidence while K3EBHB turns each refusal into one plain recovery action             | [R5 contract](features/turn-decisions-into-startable-work.feature); typed denial proves artifact identity while K3EBHB owns rendering | explicit-conflict |
| Add, never replace                                | Canonical workflow sources are updated first and every registered host derivative is regenerated rather than hand-maintained   | Verified repository targets [host parity gate](packages/cli/tests/parity.test.ts) and [OpenCode parity feature](packages/cli/features/opencode-parity.feature); a canonical workflow edit without regenerated derivatives must fail parity |                   |

Proof targets in this table use repository-root paths because the canonical
principle-trace gate resolves them from the project root. Each cell also names
the discriminating assertion that the Execution Plan must bind to executable
proof; the scenario file alone is the accepted contract, not evidence that the
implementation already exists.

Architecture applicability: this feature implements the accepted
[Separate Implementation and Execution Planning Gates](../../../ARCHITECTURE.md#separate-implementation-and-execution-planning-gates),
[Conformance-Gated Execution Plan Review](../../../ARCHITECTURE.md#conformance-gated-execution-plan-review),
[Digest-Bound Planning Decisions in the Shared Review Ledger](../../../ARCHITECTURE.md#digest-bound-planning-decisions-in-the-shared-review-ledger),
and [Typed CLI Execution and Discovery](../../../ARCHITECTURE.md#typed-cli-execution-and-discovery).
It adds no new structural or hard-to-reverse decision, so no new architecture
record is warranted.

## Known deviations

- **Optimize for the NTB without constraining the TBU:** This M1 child makes the
  missing-plan receipt identify the project-local `execution-plan.md`, rather
  than host-local scratch notes, as the artifact that must be created and
  reviewed. K3EBHB owns the complete progressive, plain-language recovery
  rendering across installed hosts and must land before the epic ships.
- **Fire at boundaries, not every turn:** The production-edit check is necessarily frequent while a feature is in
  implementation because a planning artifact can change between any two edits.
  It remains a local, read-only, deterministic CLI check and does not inject
  recurring prompt instructions. If measured edit latency becomes material,
  cache only against a complete authorization-input identity returned by the
  authorization service itself, including configuration, human authority, and
  validated review provenance; never assemble a cache key from a phase flag or
  a hand-picked subset of plan identities.

## Doc impact

- Update the canonical BDD skill and Execution Planning phase guide so authors
  enter `plan-execution`, review `execution-plan.md`, and transition through the
  coding-authorization boundary.
- Keep the schema-owned Execution Plan template and `approve-plan` scaffold in
  that canonical path; do not introduce host-local planning notes.
- Update the canonical Safeword handbook phase model and gate summary.
- Update the existing planning-gates architecture record in place to name the
  shared authorization projection consumed at both coding boundaries.
- Regenerate every repository-owned derivative required by schema and parity
  checks, including Claude, Cursor, Codex, and OpenCode. YCFFNC separately owns
  installed-host activation and migration guidance.
- README and website documentation: skip: M1 defines the unreleased internal
  workflow contract; public rollout documentation belongs to YCFFNC.

## Assessment triggers

- A supported host cannot invoke the typed local CLI at a production-edit
  boundary.
- The provenance-gated M1-to-M2 migration window leaves earlier in-flight
  tickets outside enforcement longer than YCFFNC's rollout plan permits.
- A user reports perceptible edit latency attributable to the authorization
  check. This trigger is report-driven and adds no instrumentation obligation.
- A stable plan definition can change while normalized identity and admitted
  review remain current.
- Delivery Checklist progress invalidates semantic review, or a stable
  obligation change fails to invalidate it.
- Contributors routinely need to change sequencing without an honest return to
  Execution Planning, or valid proof is lost during either replan path.
- A new planning artifact or approval source is introduced, requiring the
  dependency and authority graph to be reconsidered.
