# Product Plan: Separate implementation decisions from execution sequencing

<!-- safeword:product-plan-contract:v1 -->

## Product Bet

- **Problem / Why now:** GitHub issue #4200 records an `impl-plan.md` that
  passed eleven independent reviews but still left its implementer to invent
  data and API contracts. User feedback exposed the deeper cause: today's one
  planning phase mixes two different jobs—deciding a coherent implementation
  approach and sequencing the concrete work needed to carry it out. Adding
  detail for either job makes the other harder to judge, so teams compensate by
  writing two competing "implementation plans" by hand.
- **Expected outcome:** Safeword splits today's mixed planning step into two
  consecutive phases. **Implementation Plan** decides and explains the
  approach—architecture, contracts, responsibilities, tradeoffs, risks, and
  rollout—for both people and agents. **Execution Plan** follows it and
  organizes the accepted approach into exact, startable build and test work.
  Both remain project-local Safeword artifacts, following today's plan storage,
  review, and enforcement model. Each phase defines one canonical quality
  contract derived from one packaged authority and identified by a digest of
  the exact contract bytes in both the authoring artifact and review request.
  The
  Implementation Plan becomes the feature's design plan of record: it includes
  an architecture applicability check and applies the data guide when the work
  changes data contracts, ownership, lifecycle, migration, or cross-system
  flow. Architecturally significant decisions are also recorded in the
  configured durable architecture record and linked from the plan. Each
  contract judges the decision its phase must establish; authoring techniques
  remain guidance, while parsers enforce only observable artifact and approval
  facts. Implementation Planning reuses early BDD's decision-discovery loop:
  derive the dimensions that can change the design, make them concrete with
  alternatives and failure cases, expose their consequences and tradeoffs, and
  converge on explicit choices before work is decomposed. Decision discovery
  applies proportionally to every work type, but the two formal planning phases
  remain feature-only. Routing uses an explicit precedence order: a narrow
  patch check first, then feature triggers, then task as the fallback. This
  keeps small work small without letting a task or patch label hide unresolved
  consequential decisions. Both planning phases share a canonical scope and
  review-lifecycle foundation: discovery stays inside the accepted boundary,
  authors and reviewers receive the complete current context, missing context
  fails closed, reviewers cannot silently expand scope, and edits invalidate
  every review that depended on the changed artifact or upstream decision.
- **Success threshold:** An Implementation Plan can be judged on whether the
  approach is sufficiently decided in a focused 30–60 minute review without
  also carrying task sequencing, while retaining the technical detail needed
  to explain each decision; an
  agent given only the accepted context and plans can identify and begin the
  first Execution Plan step without asking for or inventing a behavior,
  interface, data, authorization, compatibility, rollout, rollback, or proof
  decision; and tests prove that each phase's author and reviewer receive the
  same content-identified phase-specific contract from one authoritative
  source. Cross-agent independent review is attempted first; only a typed
  exhaustion of every independent route permits Safeword's established
  best-available fallback, whose reduced independence is recorded and never
  presented as independent coverage.
  Starting from an ambiguous
  technical problem, Implementation Planning also surfaces material decisions
  the user did not initially know to ask about and records the accepted choices
  before Execution Planning. Tests also prove that missing required review
  context cannot produce approval, both plans are checked for omissions and
  scope overreach, and changing a plan or load-bearing upstream decision
  invalidates every dependent review.
- **Project non-goals:** Split the phases solely by human versus agent audience;
  forbid technical detail from an Implementation Plan when it carries a design
  decision; duplicate decisions across both plans; integrate with or depend on
  an external tracker; use one rubric for both purposes; or make a structural
  parser pretend it can judge semantic completeness. Do not create a separate
  feature design document by default, require a durable architecture update for
  every routine and reversible schema detail, or turn architecture and data
  guidance into additional workflow phases. Do not make one exact research
  table, prescribed research sequence, or skill invocation stand in for
  decision quality. Do not add Implementation Plan, Execution Plan, or
  independent planning-review artifacts to tasks or patches; require a failing
  test for non-behavioral edits; or use file count as the sole work-type rule.
  Do not require an interactive human to unblock a cloud or headless session,
  or describe a permitted exhausted-route fallback as independent review.

## Jobs To Be Done

### plan-implementability.TBU1 — Decide a coherent implementation approach

**Persona:** Technical Builder (TBU)

> When a feature's behavior is fixed, I want to decide and explain its
> implementation approach, so people and agents share the same architecture,
> contracts, tradeoffs, risks, and rollout before work is sequenced.

#### plan-implementability.TBU1.R1 — Implementation planning is a distinct approach-decision phase

#### plan-implementability.TBU1.R2 — Implementation Plan authors and reviewers apply one canonical decision-quality contract

#### plan-implementability.TBU1.R3 — The Implementation Plan leads with a decision summary covering architecture, scope, contracts, major tradeoffs, risks, and rollout in plain language suitable for a focused 30–60 minute semantic review; execution sequencing is not required and may not obscure those decisions, while technical detail that carries a decision remains in a proportionate detail section or linked evidence

#### plan-implementability.TBU1.R4 — The Implementation Plan remains a project-local reviewed phase artifact

#### plan-implementability.TBU1.R5 — Every Implementation Plan records architecture applicability inside the plan, including a justified skip when no architecture guidance applies

#### plan-implementability.TBU1.R6 — Data guidance is applied when the approach changes a store, schema, entity relationship, source of truth, ownership, access, lifecycle, migration, backfill, or cross-system data flow

#### plan-implementability.TBU1.R7 — Feature-local, reversible decisions live in the Implementation Plan, while architecturally significant decisions are also recorded in and linked from the configured durable architecture record

#### plan-implementability.TBU1.R8 — A decision is architecturally significant when it changes shared structure or contracts, a key quality attribute, data ownership or lifecycle, migration or compatibility behavior, or another difficult-to-reverse project constraint

#### plan-implementability.TBU1.R9 — The Implementation Plan is the only feature-local design plan of record, and no retained guide or workflow route produces a second feature design artifact

#### plan-implementability.TBU1.R10 — Implementation planning uses the testing guide to choose the proof scope, real boundary, and confidence argument for each behavior without requiring execution-level test mechanics

#### plan-implementability.TBU1.R11 — The Implementation Plan contract rejects an approach that leaves applicable responsibilities, boundaries, API or data contracts, authorization, failure behavior, compatibility, migration, rollout, rollback, or proof scope for Execution Planning to decide

#### plan-implementability.TBU1.R12 — Each load-bearing choice records the decision, credible alternatives, why the choice won, why alternatives lost, and current evidence with version fit and license or security limits when those facts affect the choice

#### plan-implementability.TBU1.R13 — The authoring template may offer a compact Decision Evidence table, but authors may use another concise form; structural checks require at least one declared decision entry or an explicit `skip: no load-bearing choice`, plus a stable evidence reference, retrieval date, and declared applicable-version field for each entry, while the semantic reviewer judges whether every load-bearing choice was declared, whether any skip is credible, whether the named version actually fits, and whether its evidence and tradeoffs are credible rather than judging exact formatting or whether a prescribed research ritual was followed

#### plan-implementability.TBU1.R14 — Implementation Planning derives the material decision dimensions required inside the accepted scope boundary, makes them concrete with alternatives and failure cases, exposes their consequences and tradeoffs, and converges on explicit choices before Execution Planning; ideas beyond that boundary are dropped or surfaced as user-owned scope decisions rather than silently incorporated

#### plan-implementability.TBU1.R15 — On upgrade, a feature not yet in implementation enters the new planning flow; an existing legacy implementation plan becomes the draft Implementation Plan and must satisfy the new decision contract before an Execution Plan is created, while a ticket already in implementation or later under a previously accepted plan is not retroactively blocked unless it returns to planning

#### plan-implementability.TBU1.R16 — The existing optional human design-approval gate applies once, after the Implementation Plan passes semantic review and before Execution Planning begins; it does not add a second approval after the Execution Plan, and cloud or headless sessions preserve today's nonblocking behavior by recording pending approval and surfacing the reviewed approach in reviewable output

#### plan-implementability.TBU1.R17 — The Implementation Plan review receipt records an explicit pass or fail for focused 30–60 minute decision reviewability and, on failure, names the execution detail, missing summary, or disproportionate depth that obscures a decision

#### plan-implementability.TBU1.R18 — Planning guidance replaces the feature artifact list with Implementation Plan plus Execution Plan, retires the `design.md` artifact and complex-feature design-template row, and stops installing the design template for feature planning

#### plan-implementability.TBU1.R19 — Architecture guidance retains durable-record routing for significant choices under R8 while redirecting every feature-local Design result, tie-breaker reference, and file-organization example to the Implementation Plan

#### plan-implementability.TBU1.R20 — Data guidance retains the store, model, flow, source-of-truth, ownership, access, lifecycle, migration, backfill, and compliance subjects in R6, redirects every feature-local Design result to the Implementation Plan, and retires both numeric entity thresholds and the single-store, simple-schema, and feature-scoped-entity skip carve-outs; R6 decides when to consult data guidance and R8 separately decides whether a durable architecture record is required

#### plan-implementability.TBU1.R21 — The current separate deep-design lane is folded into the Implementation Plan contract and authoring guidance rather than retained as another artifact route

### plan-implementability.TBU2 — Turn the accepted approach into startable work

**Persona:** Technical Builder (TBU)

> When the implementation approach is accepted, I want it organized into a
> concrete Execution Plan, so each step can begin in order without reopening or
> silently inventing the design.

#### plan-implementability.TBU2.R1 — Execution planning begins only from the current Implementation Plan after it passes the required semantic review under its canonical decision-quality contract and the review receipt records the achieved independence level

#### plan-implementability.TBU2.R2 — Every execution step is startable without inventing a behavior-shaping contract

#### plan-implementability.TBU2.R3 — Execution Plan authors and reviewers apply one canonical implementability contract

#### plan-implementability.TBU2.R4 — If execution planning contradicts the accepted approach or exposes an unexecutable accepted behavior, design, data, or proof-boundary decision, the work returns to Implementation Planning; fixture, helper, path, command, and sequencing details remain in Execution Planning

#### plan-implementability.TBU2.R5 — The Execution Plan remains a project-local reviewed phase artifact

#### plan-implementability.TBU2.R6 — The Execution Plan reviewer judges whether any step depends on an unresolved architecture or data decision regardless of the words used to describe the step

#### plan-implementability.TBU2.R7 — Structural transition checks verify artifact, status, and review provenance but do not claim to judge semantic implementability

#### plan-implementability.TBU2.R8 — Execution planning turns each accepted proof strategy into startable test work with concrete setup, action, assertion, process boundary, command, and ordering

#### plan-implementability.TBU2.R9 — Coding begins only after the current Execution Plan passes the required semantic review under its canonical implementability contract and the review receipt records the achieved independence level

#### plan-implementability.TBU2.R10 — The Execution Plan maps every accepted scenario, decision, proof, affected surface, migration, rollout, rollback, and documentation obligation to dependency-ordered work with a concrete completion signal

#### plan-implementability.TBU2.R11 — Changing load-bearing behavior or scope context invalidates the Implementation Plan review and every dependent Execution Plan review; changing an accepted Implementation Plan invalidates both plan reviews; changing only an Execution Plan invalidates only its own review

### plan-implementability.TBU3 — Keep small work small without hiding decisions

**Persona:** Technical Builder (TBU)

> When work appears smaller than a feature, I want Safeword to use only the
> planning needed for its real decision risk, so tasks and patches stay fast
> without making implementation the place where consequential choices are
> guessed.

#### plan-implementability.TBU3.R1 — Decision discovery applies proportionally to every work type, while the formal Implementation Plan and Execution Plan phases remain feature-only

#### plan-implementability.TBU3.R2 — Work is classified in this order: patch when the narrow patch contract applies; otherwise feature when any feature trigger applies; otherwise task

#### plan-implementability.TBU3.R3 — A patch has a fully established expected outcome, introduces no new behavior contract or consequential design choice, satisfies none of the feature triggers in R4, and has sufficient existing or targeted verification without new regression proof

#### plan-implementability.TBU3.R4 — A feature has behavior complexity such as multiple flows or new persistent state, or accepted in-scope work requires an unresolved choice that changes promised behavior, a public or shared contract, durable architecture, data ownership or lifecycle, migration or compatibility, or the required proof boundary, regardless of file count

#### plan-implementability.TBU3.R5 — A task is the residual classification after patch and feature checks fail; its behavior and proof boundary are settled, it has no unresolved feature-triggering decision, and work too broad for one bounded task is split into dependency-ordered tasks without changing classification

#### plan-implementability.TBU3.R6 — File count and affected surfaces are re-evaluation signals rather than complete classification rules, so a one-file public-contract decision can be a feature and a mechanical many-file change can remain a task

#### plan-implementability.TBU3.R7 — A task uses inline test specifications as its small execution guide and does not create Implementation Plan or Execution Plan artifacts or independent planning reviews

#### plan-implementability.TBU3.R8 — Before a behavior-changing task modifies production code, TDD names and observes one meaningful failing test through an existing boundary without inventing expected behavior or a consequential design decision

#### plan-implementability.TBU3.R9 — Before behavior-preserving task work, existing or characterization proof protects the behavior at an appropriate boundary; patches instead use the cheapest relevant targeted verification and are not forced through RED

#### plan-implementability.TBU3.R10 — Reversible local implementation choices may be resolved during task TDD and do not by themselves promote the task to a feature

#### plan-implementability.TBU3.R11 — When task TDD exposes an unresolved feature-triggering decision required by accepted in-scope work, implementation stops, preserves the test and investigation as evidence, and promotes the work to the appropriate feature phase

#### plan-implementability.TBU3.R12 — A newly discovered in-scope product-behavior decision returns to behavior definition, an implementation-design decision returns to Implementation Planning, and a sequencing-only change returns to Execution Planning; an idea outside accepted scope is dropped or offered as a user-owned scope decision rather than automatically promoting or expanding the work

#### plan-implementability.TBU3.R13 — Execution Planning does not replace feature TDD: it supplies the concrete test and build order that TDD executes through RED, GREEN, and REFACTOR

#### plan-implementability.TBU3.R14 — Structural enforcement may verify work type, required artifacts, and observable proof facts, but does not claim that a task or patch classification is semantically correct

### plan-implementability.TBU4 — Keep planning complete without expanding accepted scope

**Persona:** Technical Builder (TBU)

> When a plan is authored or reviewed, I want completeness judged against the
> whole accepted scope boundary, so missing obligations are caught without
> reviewers, guides, or agents quietly adding work I did not approve.

#### plan-implementability.TBU4.R1 — The Implementation Plan and Execution Plan contracts embed the same canonical scope and review-lifecycle clauses, authored once and generated into both phase contracts

#### plan-implementability.TBU4.R2 — The accepted scope boundary combines the ticket's scope and out-of-scope choices, project and milestone non-goals, and inherited parent boundaries for child work

#### plan-implementability.TBU4.R3 — Implementation Plan review receives the current accepted behavior, Rules, scenarios, dimensions, scope boundary, applicable principles, personas, surfaces, architecture records or generated architecture snapshot when present, and data guidance; Execution Plan review receives that context plus the accepted Implementation Plan, and an optional generated snapshot may add context but its absence cannot fail an otherwise complete review

#### plan-implementability.TBU4.R4 — Every review requires the nonblank ticket boundary, current spec Rules, accepted scenarios, canonical phase contract, resolved principles, personas and surfaces inventories, and the plan under review; the resolver uses a configured project source when present and otherwise supplies the installed default, while a configured but blank, unreadable, or stale override blocks review; an Implementation Plan review additionally requires current dimensions when that artifact exists, applicable data guidance when R6 triggers, and configured architecture records when they exist or a justified no-record skip, while an Execution Plan review additionally requires the accepted Implementation Plan; missing required input prevents approval and requires redispatch rather than a reduced-context pass

#### plan-implementability.TBU4.R5 — Each author and reviewer checks both directions of completeness: what required decision or work is missing, and what proposed decision or work exceeds the accepted scope boundary

#### plan-implementability.TBU4.R6 — A reviewer may require correction of an in-scope false clearance, contradiction, missing contract, missing context, or unexecutable accepted choice, but may not silently add behavior, design, proof, or work outside accepted scope

#### plan-implementability.TBU4.R7 — Nonblocking strengthening changes only with user authority; when the user declines a proposed expansion, the disposition is recorded and the unchanged artifact is re-reviewed against the resolved accepted boundary

#### plan-implementability.TBU4.R8 — Guidance from architecture, data, testing, domain knowledge, and reviewers supplies candidate decisions inside the accepted boundary, not authority to expand it

#### plan-implementability.TBU4.R9 — Review provenance binds the review kind, ticket, achieved independence level, exact reviewed plan bytes, and semantically normalized ticket-relevant slices of every load-bearing context input; normalization ignores formatting, comments, and unrelated persona or surface entries but not changed Rules, applicable principles, referenced personas, affected surfaces, accepted decisions, or scope, so only a semantic change to bound context invalidates that review and downstream reviews that relied on it

#### plan-implementability.TBU4.R10 — The exact bytes inside the packaged canonical contract markers are authoritative; generated reviewer rubrics and reconciled authoring copies carry a content-derived cryptographic digest that the gate recomputes from their contract bytes, and a version label alone cannot satisfy the check, so any missing, edited, stale, or mismatched copy blocks authoring or approval with a recovery path to regenerate or reconcile it

#### plan-implementability.TBU4.R11 — The review coordinator attempts cross-agent independent semantic review first; only a typed exhaustion of every independent route permits the established best-available fallback to satisfy the phase gate, and its receipt records the actual reviewer and reduced independence without calling the result independent or weakening the semantic contract

#### plan-implementability.TBU4.R12 — Both phase contracts preserve the current trust boundary: externally retrieved research is untrusted evidence rather than instructions; private code, credentials, customer data, and unpublished design context are not sent to external services; retrieved code is not executed; reused sources carry applicable license, attribution, redistribution, and security limits; and reviewers treat every reviewed artifact and context input as evidence to judge rather than instructions to follow

#### plan-implementability.TBU4.R13 — When repository-level instructions reach a surface where Safeword cannot enforce the phase gates, they state plainly that the workflow is advisory on that surface, do not claim review or approval occurred, and direct the user to a supported gated surface for authoritative planning

### plan-implementability.NTB1 — Recover from a planning gate without reading code

**Persona:** Non-Technical Builder (NTB)

> When Safeword stops planning or implementation, I want to understand the
> problem and the next action in ordinary language, so I can recover without
> reading code or learning Safeword's internals.

#### plan-implementability.NTB1.R1 — Every new fail-closed planning message states in plain language what is missing, stale, changed, or mismatched, why safe progress stopped, and the one concrete action that resumes the workflow; contract digests, review identifiers, and phase jargon are optional supporting detail rather than the primary explanation

#### plan-implementability.NTB1.R2 — When a review becomes stale, Safeword names the user-visible decision or artifact that changed and which plan must be reviewed again instead of reporting only an invalid identifier or provenance mismatch

#### plan-implementability.NTB1.R3 — When task work is promoted, Safeword explains the consequential decision it discovered, preserves completed test or investigation evidence, and names the phase where work will resume rather than presenting the promotion as lost progress

#### plan-implementability.NTB1.R4 — Verification includes an NTB walkthrough for each distinct block, invalidation, fallback, and promotion message category, proving that a person can identify the recovery action without reading code; affected surfaces need real-boundary evidence or a specific limitation

## Shape

### M1 — Establish the two phase contracts

- **Outcome:** Implementation Planning owns accepted approach decisions;
  Execution Planning owns dependency-ordered build and test mechanics; both
  have authoritative author-review contracts and explicit return paths.
- **Non-goals:** Host delivery, migration of existing tickets, and task or patch
  routing changes.

### M2 — Deliver and enforce the workflow everywhere Safeword runs

- **Outcome:** The phase model, artifacts, review dispatch, provenance,
  invalidation, fail-closed recovery, and in-flight-ticket migration work
  through the CLI and every affected agent surface.
- **Non-goals:** Claiming semantic quality from structural checks or adding a
  new external tracker dependency.

### M3 — Keep tasks and patches proportional

- **Outcome:** Classification, decision discovery, testing guidance, and
  promotion rules keep small work lightweight while preventing consequential
  choices from being invented during implementation.
- **Non-goals:** Formal planning artifacts or independent planning reviews for
  tasks and patches.

## Killer Demo

> For a technical builder starting with accepted feature behavior but an
> ambiguous implementation, Safeword discovers and independently approves the
> approach before producing executable work, visibly proven when a cold-start
> agent rejects a plan with a missing contract and then begins the corrected
> first RED step without inventing a decision, while tasks and patches follow a
> lighter proportional flow.

## Surfaces

Affected:

- Safeword CLI
- Claude Code
- Claude Code Cloud
- Claude Code on the Web — skip: no browser-entry-point behavior changes; the
  shared ephemeral-runtime behavior is proven at the Claude Code Cloud boundary
- OpenAI Codex
- OpenCode — profile catalogue only; Desktop remains advisory until native hook
  dispatch is independently proven
- Cursor
- Cursor Cloud Agents

Unaffected:

- OpenAI Codex Cloud — it reads repository `AGENTS.md` but does not receive the
  packaged local Codex plugin or lifecycle hooks that own these planning phases;
  guidance delivered there must label the workflow advisory and must not claim
  a review or approval, while extending the complete workflow requires a
  separate delivery contract
- Closeout Cleanup Guard — this feature does not change destructive closeout
  authorization or cleanup targets
- Retro Filer — this feature does not change retrospective transport or spool
  provenance
- GitHub Pull Request Conversation — plans may be surfaced in a PR description
  or summary, but this feature does not change marker-owned PR comments
- GitHub Pull Request Review — human plan approval does not create or change a
  GitHub review, approval, or inline-comment contract
- GitHub Actions Execution Sandbox — Claude Code running in Actions is covered
  by Claude Code Cloud, while this feature does not change workflow permissions,
  secrets, job isolation, or CI authority boundaries
- Railway Hosted Relay — this feature does not reach the hosted retro relay
- Railway Public Retro Collector — this feature does not reach public retro
  intake or quarantine storage
