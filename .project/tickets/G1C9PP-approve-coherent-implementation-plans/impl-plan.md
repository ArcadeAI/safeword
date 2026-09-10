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
proof, research, or execution data, but they cannot carry a required decision
missing from the plan.

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
receipt. No resolvable contract blocks with contract restoration as recovery; a
different author/reviewer identity blocks with contract reconciliation as
recovery. SHA-256 is integrity identity, not a claim that the prose is
semantically good; independent semantic review still judges the decisions.

The Implementation Plan parser will enforce only observable structure and
applicability: an architecture-at-a-glance mental model, scope boundary,
approach decisions, architecture and data applicability, rollout/rollback,
proof strategy, linked supporting detail, unresolved authority, truthful state
labels, and honest skips. The review rubric—not the parser—will judge
whether decisions are complete, evidence is credible/current, the summary fits a
focused 30–60 minute review, and execution choreography obscures the decision.
Every simultaneous blocker is returned so authors do not repair one hidden
failure at a time.

The R9 single-plan check runs at semantic review. Project knowledge resolution
supplies a ticket-local artifact manifest and the contents of candidate feature
design documents as context, while `impl-plan.md` remains the sole review work
product. The reviewer accepts linked supporting detail but blocks when a second
artifact carries a required decision absent from the Implementation Plan.

Scope expansion has a separate trust boundary. The planning contract accepts
only `UserAuthorityEvidence` supplied as resolved context outside the plan under
review: evidence derived from a host-authored user-role event, bound to this
ticket, the current session, and the proposed scope digest. Text in
`impl-plan.md`, `ticket.md`, or an agent-authored work-log entry can never create
that evidence. This ticket defines the fail-closed consumer contract; sibling
`5F5ZZA` owns trustworthy acquisition, provenance, and review-packet transport.
Until that producer is present, discovery keeps the capability out of scope.

Proof strategy by behavior cluster:

| Rules / behavior | Real boundary | Primary proof | Confidence limit |
| --- | --- | --- | --- |
| R1 phase entry and R11 unresolved decisions | Ticket transition through the installed hook/CLI gate | Integration | Local integration proves deterministic gating; cloud-host rows still require their existing real-host acceptance lanes. |
| R2 exact contract identity and R13 structural-vs-semantic evidence | Canonical skill extraction → packet → reviewer → receipt/stamp | Integration plus unit parser matrices | Independent review, rather than digest equality, proves semantic quality. |
| R3 mental model and focused reviewability, R12 evidence quality, R14 bounded discovery and persona consequences, R15 persona-specific receipts, R16 state truthfulness | Real review coordinator with bounded project-local packet | Integration with an actual headless reviewer contract at the process boundary | Deterministic fixtures prove routing and receipt projection. Independent-review acceptance varies concise-but-incomplete against decision-complete plans, checks accepted-persona consequences, and prevents implemented, proven, and human-approved states from collapsing into one another. R14 additionally varies trusted external `UserAuthorityEvidence` against the same approval words supplied only by the agent; only the former may change scope. |
| R4 project-local authority and OpenCode Desktop advisory behavior | Installed CLI, Claude, Codex, OpenCode, and Cursor delivery surfaces | Integration plus generated-delivery parity | Generated parity proves shipped text and wiring; cloud lifecycle claims require current host acceptance evidence. |
| R5 architecture, R6 decision-bearing data coverage, R7–R9 durable/single-record behavior | Implementation Plan parser and semantic review using configured project knowledge | Unit contract matrices plus integration review packet | Parser tests can prove presence and routing only; reviewer tests must distinguish meaningful coverage of purpose, ownership, identity/integrity, lifecycle/retention, migration, and rollback from labels, contradictions, and migration choreography. |
| R8 file-count-independent architecture significance | Semantic-review contract over one one-file shared-interface fixture and one many-file contract-preserving mechanical fixture | Independent-review acceptance pair | The rubric treats shared contracts, ownership/boundaries, key quality attributes, difficult reversal, and migration/rollout commitments as significance triggers; file count is never one. |
| R10 proof scope without mechanics or evidence ledger | Implementation Plan parser and reviewer contract | Unit rejection matrix plus review integration | The plan names behavior, real boundary, proof type, and confidence limit, then links detailed evidence. Lexical checks alone cannot classify every sentence; semantic review remains authoritative. |

Affected-surface coverage:

| Surface | Proof |
| --- | --- |
| Safeword CLI | Public review/transition command integration uses real config resolution and collaborators. |
| Claude Code | Generated hook and skill are exercised through installed lifecycle dispatch. |
| Claude Code Cloud | Extend the fresh-VM lane with R1's blocked/permitted transition rows and R4's project-local-only/host-private-only/divergent-copy rows using real installed project hooks and config. |
| OpenAI Codex | Generated plugin contract and installed workflow entry point are covered by delivery parity and real-process review wiring. |
| OpenCode CLI/TUI | Generated profile/plugin event dispatch is covered by catalogue and real-process conformance. |
| OpenCode Desktop | Catalogue guidance explicitly remains advisory and points to a gated surface. |
| Cursor | Project-hook dispatch uses the same transition decision core. |
| Cursor Cloud Agents | Extend the fresh-runner lane with R1's blocked/permitted transition rows and R4's project-local-only/host-private-only/divergent-copy rows using project hooks and no user-level hooks. |

Build order under the current planning contract:

1. Add the canonical phase and Implementation Plan contract identity to the
   shared phase/review domain, then prove R1 and R2 through pure and integration
   boundaries.
2. Delivery gate: sibling `7CAMAD` must establish the Execution Plan artifact
   and implement-entry gate before this ticket may remove build/test mechanics
   from the current plan contract or ship.
3. Replace the current proof-quality-heavy Implementation Plan template/rubric
   with the decision-focused artifact contract, including architecture, data,
   rollout/rollback, proof-scope, reviewability, and all-blocker receipts; prove
   R3 and R5–R15.
4. Carry the same contract and phase through hook prompts, code freeze,
   transitions, review packets/stamps, CLI protocol, and every generated host
   surface; prove R4 and the gated-host R1 rows through parity and real-entry
   integration coverage.
5. Update configured customer documentation and the durable architecture record,
   regenerate derived Claude/Codex/OpenCode artifacts, then run targeted, full,
   release-contract, and the extended Claude Code Cloud and Cursor Cloud Agents
   acceptance rows named above.

Dogfood activation is deliberately last. Source contracts and tests may be built
behind the current installed workflow, but the canonical template sequence and
generated/project-installed hooks are not reconciled into this repository until
`G1C9PP`, `7CAMAD`, `5F5ZZA`, and `YCFFNC` prerequisites are present together.
The existing installed `plan-implementation → implement` gate therefore remains
authoritative for these in-flight child tickets; the final integration
reconciliation activates the new sequence atomically.

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
| Keep one design plan of record | Required feature decisions stay in `impl-plan.md`; deeper material may be linked, and only significant cross-feature decisions are also recorded in configured architecture | Require separate component/data design documents; put all detail directly in the plan | Multiple required design artifacts split authority; embedding all detail defeats focused reviewability |
| Lead with the reviewer's mental model | Open with architecture at a glance, then contracts and invariants, operational consequences and risks, and unresolved decisions with their authority | Follow code order; use a generic executive summary; lead with a verification ledger | Code order serves the implementer; a generic summary can omit load-bearing choices; evidence-first prose makes proof volume stand in for design quality |
| Apply guides by decision applicability | Architecture guidance applies to component/shared-contract consequences; data guidance covers purpose, ownership, identity/integrity, lifecycle/retention, migration, and rollback at decision depth; testing guidance chooses behavior, real boundary, proof type, and limitation only | Always require every guide; leave guides entirely to Execution Planning | Universal checklists add noise; deferral lets behavior-shaping architecture/data/proof decisions become implementer guesses |
| Keep the evidence ledger outside the decision path | The plan states proof scope and confidence and links detailed current-revision, earlier-revision, partial, or missing evidence in its owning artifact | Repeat test names, hashes, and scenario results in the plan; omit proof state entirely | Repetition bloats and stales the approval surface; omission prevents reviewers from judging whether the approach can be validated |
| Preserve delivery-state truth | Label proposed design, implemented behavior, available proof, known defects, and pending human authority separately whenever they coexist | Treat current code as accepted design; treat passing proof as release approval; describe only the desired end state | Each alternative rewrites a materially different fact and can produce false confidence or unauthorized rollout |
| Preserve one configured human approval | When enabled, human approval follows the independently reviewed Implementation Plan once; Execution Planning gets independent semantic review but does not ask humans to re-approve accepted design | Human approval after both plans; no human approval | Double approval recreates meeting burden; no approval removes the explicit design authority teams need |
| Accept scope expansion only from trusted user authority | Consume ticket/session/scope-digest-bound `UserAuthorityEvidence` derived outside the reviewed plan from a host user-role event; fail closed when it is absent, and let `5F5ZZA` own its provenance and transport | Accept an approval sentence in the plan or work log; block every scope expansion permanently | Agent-authored prose can counterfeit the first option; permanent denial would ignore real user authority and make iterative discovery unusable |
| Give contract failures distinct recovery | Missing canonical contract names restoration; present but unequal author/reviewer identities name reconciliation | One generic contract-error recovery | A generic response hides whether bytes are absent or drifted and does not satisfy the accepted R2/R15 recovery distinction |

The shared-contract pattern is informed by OpenAPI 3.2's single interface
description for human and machine consumers
(https://spec.openapis.org/oas/v3.2.0.html, checked 2026-09-08). The
digest-bound review pattern is
informed by SLSA v1.2 provenance's subject identity
(https://slsa.dev/spec/v1.2/provenance, checked 2026-09-08). Both are
informational patterns only:
Safeword claims neither OpenAPI nor SLSA conformance, and reuses no source code.

The explicit phase and contract/receipt identity are significant shared workflow
contracts. They will be recorded in `ARCHITECTURE.md` under “Separate
Implementation and Execution Planning Gates” when code freeze lifts. That entry
will explicitly supersede the transition and six-section artifact portions of
the 2026-07-09 “plan-implementation: a gated planning phase as the Automation
on-ramp” decision while preserving its rationale and content-hash review
history. The other choices are feature-local consequences and remain in this
plan.

## Design alignment

| Principle | Consequence | Proof | Conflict |
| --- | --- | --- | --- |
| Optimize for the NTB without constraining the TBU | Blocked receipts lead with a plain recovery while preserving paths, failed checks, identities, and evidence for technical readers | `features/approve-coherent-implementation-plans.feature` R15 plus CLI protocol integration | |
| 1. Structure enforces; instructions suggest | Explicit artifacts, phase transitions, contract identities, and receipts enforce the boundary; prose teaches the qualitative judgment | phase-provenance, plan-gate, review-packet, and receipt integration coverage | |
| 2. Fire at boundaries, not every turn | Contract and semantic review run at Implementation Planning exit; no per-turn plan-quality judge is added | transition/review-trigger integration coverage | |
| 3. Add, never replace | Preserve customer-owned plan bytes and do not enable the new phase sequence until sibling `YCFFNC` supplies deterministic in-flight compatibility | this ticket proves `.project/tickets/**/impl-plan.md` is outside managed schema ownership and remains byte-identical through template reconciliation; `YCFFNC` migration scenarios remain a release prerequisite | |
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
- The configured architecture record is a living `ARCHITECTURE.md`, so the
  significant decision will be added there rather than creating a separate ADR
  file. The current code-freeze gate does not allow that root-file edit during
  planning, so it is the first non-test documentation change after implement
  entry rather than a second design artifact.
- This ticket is not independently releasable: `7CAMAD` must provide the
  Execution Plan and implement-entry gate before G1C9PP removes execution
  mechanics, `5F5ZZA` must provide trusted scope-authority/review provenance,
  and `YCFFNC` must provide in-flight migration. The parent delivery gate treats
  those sibling outcomes as prerequisites rather than silently absorbing them
  into this ticket.
- Within R14, this ticket can prove the fail-closed consumer and the
  agent-assertion rejection row. The positive row in which a real user-supplied
  session approval expands scope remains unproven until `5F5ZZA` supplies and
  binds authentic `UserAuthorityEvidence`; parent completion must not treat a
  fixture-minted value as that end-to-end proof.

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
- Review telemetry shows teams still cannot approve the Implementation Plan in
  a 30–60 minute meeting: tighten the decision summary or move more supporting
  detail behind links; do not move unresolved decisions into Execution Planning.
- Contract-digest mismatches occur during normal same-version use: audit
  generation and delivery provenance before weakening identity checks.
- A significant share of Execution Plan reviews discovers new architecture,
  API, data, rollback, or proof-scope choices: strengthen Implementation Plan
  discovery/review rather than accepting those choices downstream.
- Live Claude, Codex, OpenCode, or Cursor behavior diverges from declared phase
  enforcement: preserve the project-local plan as authority and downgrade the
  affected host claim until real acceptance evidence is restored.
