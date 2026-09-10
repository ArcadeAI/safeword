# Impl Plan: Approve coherent Implementation Plans

**Status:** planned
**Planned on:** 2026-09-08

## Approach

Architecture at a glance: one canonical phase model owns the transition from
behavior to design to execution; one project-local `impl-plan.md` owns the
accepted design; one generated author/reviewer contract defines its quality;
and existing transition hooks, review packets, and receipts enforce the same
boundary across supported hosts. The Implementation Plan gives a reviewer the
mental model, contracts, operational consequences, risks, and unresolved
authority needed to approve the approach. Linked artifacts may carry detailed
proof, research, or execution data and may carry the full detail of a named
decision when they are resolvable, explicitly subordinate to `impl-plan.md`, and
included in the bounded review packet. The plan must still name the decision,
why it matters, its consequence, and the supporting link. A separately
authoritative or unlinked feature design document is a competing plan of record
and blocks approval.

This is a prospective design plan written while transitional implementation
machinery already exists. The plan therefore labels proposed decisions,
implemented facts, available proof, known deviations, and pending human
authority separately. Existing code is evidence about current behavior, not
automatic proof that the proposed design is correct or approved.

The riskiest assumption is that a second explicit planning phase produces a real,
cross-host boundary rather than another prose-only convention. The cheapest
discriminating slice is the R1 phase-transition scenario: an unresolved
behavior-shaping choice must block `plan-implementation → plan-execution`, while
a current reviewed Implementation Plan must permit it. A constant allow or deny
implementation fails one of those rows.

The design adds one canonical `plan-execution` phase between
`plan-implementation` and `implement`. The Implementation Plan remains the one
project-local design record. It contains the decisions a human or agent must
judge—architecture, data, interfaces, risk, rollout/rollback, and proof scope—but
not file-by-file work or test commands. A separate project-local
`execution-plan.md` will later translate the accepted design into startable TDD
work. This ticket establishes the first half of that boundary; sibling `7CAMAD`
owns the Execution Plan contents and its implement-entry gate.

The author and reviewer will consume one generated Implementation Plan contract.
Its canonical source is a delimited contract block in the planning skill; the
build extracts that exact text for the review runtime. Review preparation hashes
the resolved contract, records its identity in the review packet and durable
receipt. This ticket distinguishes present-but-unequal author/reviewer contract
identities and names reconciliation as recovery. The parent-level behavior for
a missing or unreadable canonical contract is not claimed by this child because
it has no child-owned scenario here. SHA-256 is integrity identity, not a claim
that the prose is semantically good; independent semantic review still judges
the decisions.

The Implementation Plan parser will enforce only observable structure and
applicability: an architecture-at-a-glance mental model, scope boundary,
approach decisions, architecture and data applicability, rollout/rollback,
proof strategy, decision-depth state models for significant workflows,
measurement-design applicability, linked supporting detail, unresolved
authority, truthful state labels, exact-plan human-approval state, repair-loop
state, and honest skips. The review rubric—not the parser—will judge
whether decisions are complete, evidence is credible/current, the summary fits a
focused 30–60 minute review, and execution choreography obscures the decision.
Every simultaneous blocker is returned so authors do not repair one hidden
failure at a time.

The deterministic contract-conformance fixture is not a scripted verdict
table. Each semantic obligation has a mutation check: deleting its clause from
the exact packaged contract bytes must make the corresponding scenario fail,
and the emitted finding must identify the missing contract obligation. This
keeps the packaged author/reviewer contract, rather than a test-only checker, as
the real judgment boundary.

The R9 single-plan check runs at semantic review. Project knowledge resolution
supplies a ticket-local artifact manifest and the contents of candidate feature
design documents as context, while `impl-plan.md` remains the sole authoritative
feature design work product. Linked detail remains inside the review path only
when the plan names the decision and consequence, marks the linked artifact as
supporting rather than authoritative, and includes it in the bounded packet.
The reviewer blocks an unlinked artifact, a second artifact claiming design
authority, or a required decision that the plan neither names nor routes into
that packet.

Accepted-persona coverage resolves from the accepted Product Plan's persona
outcome inventory. The project-wide persona catalogue supplies definitions and
context, but it cannot add a persona obligation that Product did not accept for
this feature.

Scope expansion has a separate trust boundary. The planning contract consumes
only a typed `UserAuthorityEvidence` input supplied outside the plan under
review and bound to this ticket, session, and proposed scope digest. Text in
`impl-plan.md`, `ticket.md`, or an agent-authored work-log entry does not satisfy
the required type and remains outside the accepted boundary. This ticket proves
that fail-closed consumer behavior with valid fixture input versus absent typed
input; it does not prove that a producer cannot forge the type. Sibling `5F5ZZA`
owns authentic host-user-event acquisition, anti-forgery provenance, and
review-packet transport. Until that producer is present, discovery keeps the
capability out of scope.

Durable-state design is applicable. Existing review jobs remain transient
coordinator state; existing review stamps and new human design decisions use the
project-local append-only review ledger. A design-decision event records ticket,
phase, exact Implementation Plan digest, `approved` or `declined`, user-authority
reference, and timestamp; `pending` is derived from configuration plus the
absence of a current matching approval and never masquerades as authority. The
source of truth is the current plan bytes plus the latest valid matching event.
Only resolved user authority may write approval or decline; agents and
non-interactive runs may report pending but cannot manufacture a decision.

The shared ledger writer serializes updates and replaces the ledger atomically.
An idempotency key over ticket, plan digest, decision, and authority event makes
retry safe. The gate rereads the committed ledger before changing phase, so a
crash after the event write but before the phase write safely resumes, while a
crash before the event write leaves the phase blocked. Events are retained with
the project for audit; new plan bytes make old events non-current rather than
deleting them. The host-user event flows through 5F5ZZA's typed provenance
boundary into this consumer and stores no decision rationale or sensitive
content beyond the minimum authority reference. Existing tickets with approval
enabled but no digest-bound event enter `pending`; no backfill invents approval.
YCFFNC owns rollout compatibility and rollback to the pre-feature phase sequence.

Proof strategy by behavior cluster:

| Rules / behavior | Real boundary | Primary proof | Confidence limit |
| --- | --- | --- | --- |
| R1 phase entry | Ticket transition through the installed hook/CLI gate | Integration | Local integration proves deterministic phase gating; cloud-host rows still require their existing real-host acceptance lanes. |
| R11 unresolved decisions | Exact packaged Implementation Plan contract through the deterministic contract-conformance reviewer; installed CLI review receipt for the simultaneous-blocker case | Pure contract matrix plus separate real-process CLI integration | The contract matrix proves unresolved and resolved API, rollback, and proof-scope outcomes at the accepted semantic-fixture boundary. It does not prove installed wiring or live-reviewer consistency; the tagged CLI scenario separately proves that one installed invocation retains every simultaneous blocker. |
| R2 exact contract identity and R13 structural-vs-semantic evidence | Canonical skill extraction → packet → reviewer → receipt/stamp | Integration plus unit parser matrices for equal and present-but-unequal contracts | Independent review, rather than digest equality, proves semantic quality. Missing/unreadable canonical-contract recovery is a parent-level obligation not claimed by this child packet. |
| R3 mental model and focused reviewability, R12 evidence quality, R14 bounded discovery and persona consequences, R15 persona-specific receipts, R16 state truthfulness | Real review coordinator with bounded project-local packet | Deterministic contract-conformance integration plus a current-revision independent-review acceptance artifact | CI fixtures prove contract-byte routing and receipt projection, not that every live reviewer will reach the same semantic verdict. Current exact contract acceptance is recorded outside the deterministic suite and must be downgraded when unavailable. R14 is partial here: absence of the required typed authority is proven fail-closed; authentic production and anti-forgery provenance remain a 5F5ZZA prerequisite. |
| R4 project-local authority and OpenCode Desktop advisory behavior | Installed Safeword CLI and project-local artifact resolution | CLI integration | This ticket proves only the canonical CLI boundary. Installed host delivery and parity are explicit YCFFNC prerequisites. |
| R5 architecture, R6 decision-bearing data coverage, R7–R9 durable/single-record behavior | Implementation Plan parser and semantic review using configured project knowledge; phase edit gate for the configured architecture record | Unit contract matrices plus integration review packet and edit-gate allow/deny pair | Parser tests can prove presence and routing only; reviewer tests must distinguish meaningful coverage from labels and choreography. The edit-gate pair proves the configured architecture record is writable during planning while an ordinary source or documentation path remains blocked; review still blocks a significant choice whose link is absent or unresolved. |
| R8 file-count-independent architecture significance | Semantic-review contract over shared-interface, quality-attribute, data-lifecycle, migration/compatibility, difficult-reversal, and contract-preserving mechanical fixtures | Contract matrix plus independent-review acceptance pair | The review receipt requires a durable record for every semantic trigger family and does not require one for the mechanical control; file count is never a trigger. |
| R10 proof scope without mechanics or evidence ledger | Implementation Plan parser and reviewer contract | Unit rejection matrix plus review integration | The plan names behavior, real boundary, proof type, and confidence limit, then links detailed evidence. Lexical checks alone cannot classify every sentence; semantic review remains authoritative. |
| R17 significant workflow decision depth | Packaged plan contract and deterministic semantic-review conformance boundary | Contract matrix plus installed CLI review integration | Durable state, authorization, and migration fixtures vary state, transition authority, atomicity, retry, compatibility, and preserved evidence so labels alone cannot pass. |
| R18 measurement-design ownership | Product promise → Implementation Plan review packet | Contract matrix plus deterministic semantic review | The accepting case decides measurement origin, method, safeguards, and failure behavior; rejection cases prevent changing Product-owned targets or substituting instrumentation commands for validity decisions. For this epic's 30–60 minute promise, Product owns a timestamped review study: start when the reviewer begins the decision summary, stop at approve/block, record whether the reviewer can explain the approach and unresolved authority, sample reviewers without authoring context, and report setup interruptions separately. The semantic receipt's pass/fail is diagnostic input, not duration proof by self-report. |
| R19 exact-plan human approval and headless completion | Installed CLI approval boundary with interactive and non-interactive invocation fixtures | Real-process integration | Approval is bound to exact reviewed approach bytes, reused only while those bytes remain current, refreshed after change even when an Execution Plan exists, and recorded pending without prompting or deadlocking when no approver is available. This proves human-approval currency only; 5F5ZZA owns semantic review-record invalidation and provenance recomputation. |
| R20 complete repair loop | Installed CLI review and decision-discovery loop with deterministic reviewer process results | End-to-end CLI integration | The first receipt exposes the full three-defect set together; accepted owners resolve each decision; the approving receipt binds the corrected digest and cannot bind the original bytes; unavailable external authority produces an honest pending result rather than approval or a fixed retry cap. |

Affected-surface coverage:

| Surface | Proof |
| --- | --- |
| Safeword CLI | Public review/transition command integration uses real config resolution and collaborators. |
| Claude Code | skip: YCFFNC in M2 owns installed lifecycle delivery and real-boundary proof. |
| Claude Code Cloud | skip: YCFFNC in M2 owns fresh-VM delivery and real-boundary proof. |
| OpenAI Codex | skip: YCFFNC in M2 owns packaged-plugin delivery and real-boundary proof. |
| OpenCode CLI/TUI and Desktop | skip: YCFFNC in M2 owns installed profile delivery and the explicit Desktop advisory limitation. |
| Cursor | skip: YCFFNC in M2 owns installed project-hook delivery and real-boundary proof. |
| Cursor Cloud Agents | skip: YCFFNC in M2 owns fresh-runner delivery and real-boundary proof. |

Build order under the current planning contract:

1. Add the canonical phase, contract identity, and approval-state domain model;
   prove the pure equal/unequal contract and current/stale approval cases.
2. Delivery gate: sibling `7CAMAD` must establish the Execution Plan artifact
   and implement-entry gate before this ticket may remove build/test mechanics
   from the current plan contract or ship.
3. Replace the current proof-quality-heavy Implementation Plan template/rubric
   with the decision-focused artifact contract, including architecture, data,
   rollout/rollback, proof-scope, reviewability, persona consequences, truthful
   state, significant-workflow decision depth, measurement design, and
   all-blocker receipts; prove R3 and R5–R18.
4. Carry the phase, contract, configured-architecture edit exception, review
   packet/stamp, and project-local plan authority through the installed Safeword
   CLI; prove the tagged R1, R4, and R7 boundaries there.
5. Implement digest-bound approval/decline/pending state and the complete
   decision-discovery repair loop on that installed CLI boundary; prove R19 and
   R20 with deterministic reviewer-process results. Keep the six agent-host
   delivery paths as explicit YCFFNC M2 prerequisites.
6. Update configured customer documentation and the durable architecture record,
   then run targeted, full, and release-contract verification for this M1 slice.

Dogfood activation is deliberately last. Source contracts and tests may be built
behind the current installed workflow, but the canonical template sequence and
generated/project-installed hooks are not reconciled into this repository until
`G1C9PP`, `7CAMAD`, `5F5ZZA`, and `YCFFNC` prerequisites are present together.
The existing installed `plan-implementation → implement` gate therefore remains
authoritative for these in-flight child tickets. YCFFNC owns the final
integration activation mechanism, its crash/retry semantics, and rollback; this
ticket makes no atomic-activation claim.

## Decisions

### Implementation Inspiration

<!-- prettier-ignore -->
| Reference | Checked on | Source version | Target version | Evidence of fit | Principle to borrow | Mismatch / license / security boundary |
| --- | --- | --- | --- | --- | --- | --- |
| https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments | 2026-09-08 | GitHub Actions documentation current 2026-09-08 | Safeword 0.83.1+ | Required reviewers create an observable waiting state and prevent downstream execution until approval | Model planning approval as an explicit transition state, not prose inside one phase | Hosted deployment semantics are not copied; user-self-review policy is outside this ticket |

**Decision impact:** changed: the accepted two-goal model becomes two observable
ticket phases and two separately reviewed artifacts instead of one mixed plan or
an invisible substate.
**Decision informed:** Represent Execution Planning as an explicit canonical phase

### Recorded Decisions

| Decision | Choice | Alternatives considered | Rejected because |
| --- | --- | --- | --- |
| Represent Execution Planning as an explicit canonical phase | Add `plan-execution` between `plan-implementation` and `implement`, with `execution-plan.md` owned by that phase | Two sections in one plan; two files in one phase with hidden substate | One plan preserves the mixed review unit; hidden state cannot be observed or enforced consistently by host gates and receipts |
| Give Implementation Planning one author/reviewer contract | Extract one canonical contract block into generated runtime text and bind its SHA-256 identity into review packets and receipts | Duplicate author/reviewer prose with parity tests; runtime-only rubric; schema alone | Duplicate prose can drift before tests run; runtime-only text is not available to authors; structural schema cannot express semantic decision quality |
| Keep structural and semantic checks separate | Parsers enforce required structure/applicability; independent review judges implementability, evidence, trade-offs, and focused reviewability | Encode all quality as lexical/parser rules; let review check everything including file existence | Lexical rules reward proof-shaped prose and create false confidence; review-only structure produces slow, inconsistent recovery for observable omissions |
| Validate evidence fields in prose semantically | The parser requires an evidence-bearing decision section or justified applicability skip; when an external fact materially affects a load-bearing choice, semantic review requires a stable reference, retrieval date, and applicable version whether expressed as a table, prose, or bullets; otherwise the entry may say evidence is not applicable with a reason | Parse one mandatory table shape; require invented citations for internal policy choices; use lexical searches over free-form prose; leave all evidence checks implicit | One table violates presentation neutrality; invented citations reduce trust; lexical searches confuse labels with meaningful values; implicit checks cannot name the missing field in recovery |
| Keep one design plan of record | `impl-plan.md` remains authoritative and names each required decision, why it matters, and its consequence; a resolvable subordinate artifact included in the review packet may carry full decision detail; significant cross-feature decisions also enter configured architecture | Require every detail inline; allow unlinked or separately authoritative feature design documents | Embedding all detail defeats focused reviewability; competing authority splits the review path and lets required decisions evade the bounded review |
| Make durable architecture recording possible before approval | During planning, permit edits only to the configured project-owned architecture record in addition to existing meta paths; require the significant decision's resolvable link before semantic approval | Record the decision after implementation starts; accept a typed promise to record it later; put the architecture record under the ticket namespace | Post-approval recording makes R7 circular and lets an unrecorded decision advance; a promise weakens the accepted rejection behavior; a ticket-local substitute ignores the project's configured durable record |
| Lead with the reviewer's mental model | Open with architecture at a glance, then contracts and invariants, operational consequences and risks, and unresolved decisions with their authority | Follow code order; use a generic executive summary; lead with a verification ledger | Code order serves the implementer; a generic summary can omit load-bearing choices; evidence-first prose makes proof volume stand in for design quality |
| Apply guides by decision applicability | Architecture guidance applies to component/shared-contract consequences; data guidance covers purpose, store and model, schema and relationships, source of truth, ownership and access, identity and integrity, cross-system flow, lifecycle and retention, migration and backfill, compliance, and rollback at decision depth; testing guidance chooses behavior, real boundary, proof type, and limitation only | Always require every guide; leave guides entirely to Execution Planning | Universal checklists add noise; deferral lets behavior-shaping architecture/data/proof decisions become implementer guesses |
| Keep the evidence ledger outside the decision path | The plan states proof scope and confidence and links detailed current-revision, earlier-revision, partial, or missing evidence in its owning artifact | Repeat test names, hashes, and scenario results in the plan; omit proof state entirely | Repetition bloats and stales the approval surface; omission prevents reviewers from judging whether the approach can be validated |
| Preserve delivery-state truth | Label proposed design, implemented behavior, available proof, known defects, and pending human authority separately whenever they coexist | Treat current code as accepted design; treat passing proof as release approval; describe only the desired end state | Each alternative rewrites a materially different fact and can produce false confidence or unauthorized rollout |
| Preserve one configured human approval | Bind approval to the exact independently reviewed Implementation Plan bytes; reuse it while current; require a new decision after change; hold headless work pending without prompting; on decline, remain in Implementation Planning and bind the declined digest in the repair receipt | Approval once per ticket; human approval after both plans; advance while pending; no human approval | Ticket-wide approval goes stale silently; double approval recreates meeting burden; pending is not authority; no approval removes the explicit design authority teams need |
| Persist approval state safely | Reuse the project-local append-only review ledger with digest-bound, idempotent approval/decline events; derive pending and currency from config, current bytes, and the latest valid event; serialize and atomically replace ledger bytes before phase transition | Store mutable approval on ticket frontmatter; overwrite one current receipt; keep state only in host memory | Frontmatter conflates workflow and authority; overwrite destroys audit history; host memory breaks project-local handoff and recovery |
| Accept scope expansion only from trusted user authority | Consume ticket/session/scope-digest-bound `UserAuthorityEvidence` derived outside the reviewed plan from a host user-role event; fail closed when it is absent, and let `5F5ZZA` own its provenance and transport | Accept an approval sentence in the plan or work log; block every scope expansion permanently | Agent-authored prose can counterfeit the first option; permanent denial would ignore real user authority and make iterative discovery unusable |
| Require decision-depth models only when the choice is significant | Significant concurrency, security, durability, lifecycle, migration, and compatibility decisions must state applicable state, authority, atomicity, retry, and evidence behavior; routine local choices do not | Require the full model for every choice; accept labels without behavioral depth | Universal modeling bloats focused review; labels alone let destructive or retry behavior remain an implementer guess |
| Keep quantitative ownership split by phase | Product owns the promised target and population; Implementation Planning decides measurement origin, method, validity safeguards, and failure behavior; Execution Planning owns instrumentation commands | Put the entire metric in Product Planning; defer all measurement detail to execution | Product-only detail cannot establish technical validity; execution-only detail allows measurement design and failure semantics to be invented while building |
| Repair plans through the same decision-discovery loop | Return the full current blocking set, route each defect to its accepted decision owner, re-review corrected exact bytes, and stop honestly on unavailable external authority without a fixed repair cap | End at the first rejection; repair one finding per pass; let the reviewer choose missing product behavior | Rejection alone does not deliver a complete plan; serial hidden findings waste cycles; reviewer-owned decisions silently expand authority |

The shared-contract pattern is informed by OpenAPI 3.2's single interface
description for human and machine consumers
(https://spec.openapis.org/oas/v3.2.0.html, checked 2026-09-08). The
digest-bound review pattern is
informed by SLSA v1.2 provenance's subject identity
(https://slsa.dev/spec/v1.2/provenance, checked 2026-09-08). Both are
informational patterns only:
Safeword claims neither OpenAPI nor SLSA conformance, and reuses no source code.

The explicit phase, planning edit exception, and contract/receipt identity are
significant shared workflow contracts. They are recorded in the resolvable
`ARCHITECTURE.md` section “Separate Implementation and Execution Planning
Gates,” which explicitly supersedes the transition and six-section artifact
portions of the 2026-07-09 “plan-implementation: a gated planning phase as the
Automation on-ramp” decision while preserving its rationale and content-hash
review history. The other choices are feature-local consequences and remain in
this plan.

## Design alignment

| Principle | Consequence | Proof | Conflict |
| --- | --- | --- | --- |
| Optimize for the NTB without constraining the TBU | Blocked receipts lead with a plain recovery while preserving paths, failed checks, identities, and evidence for technical readers | `features/approve-coherent-implementation-plans.feature` R15 plus CLI protocol integration | |
| 1. Structure enforces; instructions suggest | Explicit artifacts, phase transitions, contract identities, and receipts enforce the boundary; prose teaches the qualitative judgment | phase-provenance, plan-gate, review-packet, and receipt integration coverage | |
| 2. Fire at boundaries, not every turn | Contract and semantic review run at Implementation Planning exit; no per-turn plan-quality judge is added | transition/review-trigger integration coverage | |
| 3. Add, never replace | Preserve customer-owned plan bytes and do not enable the new phase sequence until sibling `YCFFNC` supplies deterministic in-flight compatibility | existing schema-ownership regression tests, outside the behavior ledger because they verify the pre-existing unmanaged-artifact invariant, keep `.project/tickets/**/impl-plan.md` byte-identical through template reconciliation; `YCFFNC` migration scenarios remain a release prerequisite | |
| 4. Discover decisions before prescribing work | Implementation Planning resolves consequential choices; Execution Planning may only sequence them | R11/R14 behavior and the two phase contracts | |
| 5. Contribute, then converge | The planning guidance proposes concrete candidates and trade-offs before seeking missing user-only authority | planning skill contract review fixtures | |
| 6. Correct and safe; then clear; then simple | One new phase reuses the existing transition/review infrastructure; no second workflow engine or dependency is introduced | dependency diff, phase parity, and full-suite verification | |

Existing decisions honored:

- “Unified BDD+TDD Workflow” keeps TDD inline in the BDD workflow; the new
  boundary separates planning goals, not skills.
- “Continuous Quality Gates” remains the enforcement mechanism; phase and
  review state continue to derive from project-local ticket artifacts.
- “Host-owned cross-agent adversarial review coordinator” and its ranked local
  route extension remain the only review path. Implementation Planning is one
  new kind within its bounded work-product/context packet, typed provenance,
  and exhausted-route contract; sibling `5F5ZZA` owns route and fallback detail.
- The existing content-hash-bound review receipt remains the immediate R1
  currency check: any source-byte change makes the receipt stale and names
  revalidation. Sibling `5F5ZZA` later narrows invalidation to semantically
  relevant context without weakening this ticket's fail-closed behavior.
- “Typed Integration Registry for Harness-Neutral Lifecycle Workflows” remains
  the source of host capability truth; unsupported Desktop enforcement is not
  overstated.

## Known deviations

- The current planning gate asks this transitional `impl-plan.md` to contain a
  build order and proof paths. The new Implementation Plan contract deliberately
  moves those mechanics to `execution-plan.md`; this plan includes them only to
  satisfy the currently installed pre-change gate.
- The configured architecture record is the living `ARCHITECTURE.md`, not a
  second feature design plan. This bootstrap change was recorded there under
  the user's explicit authority. The implementation must make that satisfiable
  without an override for later tickets by admitting only the configured
  project-owned architecture path through the planning freeze; ordinary source
  and documentation paths remain blocked.
- This ticket is not independently releasable: `7CAMAD` must provide the
  Execution Plan and implement-entry gate before G1C9PP removes execution
  mechanics, `5F5ZZA` must provide trusted scope-authority/review provenance,
  and `YCFFNC` must provide in-flight migration. The parent delivery gate treats
  those sibling outcomes as prerequisites rather than silently absorbing them
  into this ticket.
- Installed delivery for Claude Code, Claude Code Cloud, OpenAI Codex, OpenCode,
  Cursor, and Cursor Cloud Agents is intentionally deferred to `YCFFNC` in M2.
  G1C9PP changes the canonical contract and proves the real Safeword CLI
  boundary only; generated-host parity or cloud acceptance here would duplicate
  sibling-owned work and violate the accepted milestone split.
- Within R14, this ticket proves the consumer's typed-input versus absent-input
  boundary. It does not prove that the input was authentically produced or
  cannot be forged; those provenance claims remain unproven until `5F5ZZA`
  supplies host-user-event acquisition and binding. Parent completion must not
  treat a fixture-minted value as that end-to-end proof.

## Doc impact

- `README.md`: explain the two planning goals and the normal feature phase flow
  without exposing internal review machinery to non-technical users.
- `packages/website/src/content/docs/getting-started/workflow.mdx`: G1C9PP owns
  the Implementation Planning purpose, human-review summary, guide-routing, and
  single approval timing. `7CAMAD` owns the Execution Planning instructions;
  `5F5ZZA` owns review freshness/provenance; `3EG00H` owns task/patch wording.

These updates follow the contract, gate, and host work so examples describe the
verified shipped behavior.

## Assessment triggers

- A host gains first-class workflow substate with the same durable,
  project-local transition and receipt guarantees as a phase: reconsider the
  explicit phase to reduce public state.
- A focused-review receipt records that a reviewer could not reach a decision
  within the Product-owned 30–60 minute review window because execution or
  evidence detail obscured the choices: tighten the summary or move supporting
  detail behind links; do not move unresolved decisions into Execution Planning.
- Contract-digest mismatches occur during normal same-version use: audit
  generation and delivery provenance before weakening identity checks.
- An Execution Plan review returns a newly discovered architecture, API, data,
  rollback, or proof-scope choice to Implementation Planning: strengthen the
  corresponding decision-discovery obligation before accepting that choice
  downstream.
- Live Claude, Codex, OpenCode, or Cursor behavior diverges from declared phase
  enforcement: preserve the project-local plan as authority and downgrade the
  affected host claim until real acceptance evidence is restored.
