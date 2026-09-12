# Impl Plan: Split large contributions into independently reviewable PRs

**Status:** planned
**Planned on:** 2026-09-11

## Approach

The [approved scenarios](../../../features/split-large-contributions-into-reviewable-prs.feature)
are the authoritative behavior contract; this plan does not restate them.

Use one canonical Execution Planning contract for both plan authors and
reviewers. The existing review coordinator sends those exact contract bytes
under a distinct `plan-execution` review kind; it does not gain a second review
engine. The contract represents a contribution as one or more conceptual
slices in dependency order. Each slice names one purpose, its boundary,
prerequisites, proof, and a safe completion state. Repository-host stacking may
carry that order, but the contract remains host-neutral.

The riskiest assumption is that a semantic reviewer can judge conceptual slice
boundaries without substituting line counts or inventing design. Live review of
coherent and incoherent plans samples that judgment across Claude and Codex.
Deterministic tests separately prove contract dispatch, output validation, and
CLI wiring; live output is not used to prove parser behavior.

An approved review returns an `execution_plan_record` through the reviewer-agent
result and CLI `data.reviewer_output`. It records the slicing decision and
rationale; each slice's complete contract and dependency safety; the reviewer's
owner map for accepted obligations; and the accepted decisions the reviewer
accounted for as unchanged. The reviewer contract requires those sets to come
from the exact Implementation Plan, scenarios, and Execution Plan in the
bounded packet, never from a reviewer-supplied baseline, and requires the
recorded slices to correspond one-to-one with the Execution Plan's slices.
When the Implementation Plan declares no load-bearing choice, the reviewer
accounts for that explicit applicability decision instead of inventing one.
Until startable-work planning defines a canonical obligation manifest,
completeness and correspondence against those source documents are
semantic-review judgments, not deterministic-parser claims.
[Reviewer-output validation](#reviewer-output-validation) defines the structural
acceptance boundary once.

## Release gates

| Gate | What it blocks | Required proof | Confidence limit |
| --- | --- | --- | --- |
| Canonical contract | Execution Plan review | The installed Safeword CLI package sends the exact packaged author/reviewer contract; the author skill and template name the slicing decision and slice fields; clause-deletion checks cover [R1–R5](../../../features/split-large-contributions-into-reviewable-prs.feature) | Proves contract presence and parity, not agent-host delivery or semantic judgment |
| Conceptual slicing | Completion of this child | Each admitted reviewer identity returns its own expected verdict and specific finding for every rejection class in the [authoritative scenarios](../../../features/split-large-contributions-into-reviewable-prs.feature); positive records correspond one-to-one with the Execution Plan's slices and cover the packet's accepted obligations and decisions | Exact-identity conformance cannot guarantee future reviewer behavior or exhaustive source-document interpretation |
| Approval-record integrity | Any `plan-execution` approval | Route-independent validation tests exercise every invariant in [Reviewer-output validation](#reviewer-output-validation), including conversion of negative tripwires; provider-specific fixtures construct inputs that strict schemas cannot emit | Structural validation proves a coherent record and explicit reviewer assertions; semantic review proves source coverage, dependency safety, and decision preservation |
| Existing review compatibility | Provider schema, validation, and stored result | Golden schema comparisons keep every existing review kind byte-for-byte unchanged; table-driven approval and denial cases prove every existing kind retains its prior validator path and persisted result shape without `execution_plan_record` | Covers declared schema, validation, and storage behavior, not undocumented provider behavior |
| CLI wiring | Completion of this child | With only the external reviewer replaced, the real CLI, packet builder, coordinator, result store, and stamp writer persist and cite a valid approval whose populated output validates against the v1 CLI envelope; exhausted malformed-positive routes persist no approval or stamp; a legible denial or negative assertion ends denied without invoking another route | [Installed workflow migration](../YCFFNC-migrate-planning-guidance-without-disrupting-features/ticket.md) owns agent-host delivery |

Exact test cases, commands, task order, and generated-asset sequencing belong in
the Execution Plan.

Affected surfaces:

- Safeword CLI: real-command wiring and semantic contract proof.
- Claude Code, Claude Code Cloud, OpenAI Codex, Cursor, and Cursor Cloud Agents:
  skip: [installed workflow migration](../YCFFNC-migrate-planning-guidance-without-disrupting-features/ticket.md)
  owns installed delivery and real-host parity in M2; this M1 child supplies
  the canonical contract they will consume.
- OpenCode: skip: installed workflow migration owns catalogue delivery in M2;
  Desktop remains advisory until native hook dispatch is independently proven.

Decision boundaries:

- Application-level APIs and permissions are not applicable. The reviewer-agent
  result contract and CLI `data.reviewer_output` change as recorded in
  Decisions; the top-level CLI envelope does not. [Startable work](../7CAMAD-turn-decisions-into-startable-work/ticket.md)
  owns the coding-transition consumer and fail-closed denial when no current
  Execution Plan approval exists; [review currency](../5F5ZZA-keep-plan-reviews-current-and-trustworthy/ticket.md)
  owns invalidation.
- Failure behavior: [Reviewer-output validation](#reviewer-output-validation)
  owns denial, malformed-output, retry, persistence, and stamp behavior.
  [Plain-language gate recovery](../K3EBHB-make-planning-gates-understandable-and-scope-safe/ticket.md)
  owns the final recovery message.
- Compatibility and rollout: the new contract and review kind remain part of
  the unreleased epic until installed workflow migration supplies in-flight
  migration and host parity. Existing implementation-phase tickets are not
  retroactively blocked.
- Rollback: remove the unreleased Execution Plan review route with the epic; no
  external state or migrated data requires reversal.
- Measurement applicability: skip: the Product Plan makes no quantitative
  promise for this child.

## Decisions

### Implementation Inspiration

<!-- prettier-ignore -->
| Reference | Checked on | Source version | Target version | Evidence of fit | Principle to borrow | Mismatch / license / security boundary |
| --- | --- | --- | --- | --- | --- | --- |
| https://google.github.io/eng-practices/review/developer/small-cls.html | 2026-09-11 | Current published guidance | Safeword 0.83.1+ | Defines a small change as one self-contained concern with related tests and a working post-submit system; explicitly rejects simplistic line-count sizing | Make conceptual cohesion, local proof, and safe intermediate state the slicing test | Guidance describes Google's review practice, not a portable repository API; principles only, no code or license transfer |
| https://docs.github.com/en/pull-requests/get-started/about-stacked-prs | 2026-09-11 | Public preview documentation current on retrieval | Safeword 0.83.1+ | Orders foundational dependencies below consumers and exposes each layer as a discrete reviewable change | Record explicit dependency order and require lower slices to contain prerequisites | GitHub stacks are preview and host-specific; Safeword must not require the feature or its APIs |
| https://martinfowler.com/bliki/ParallelChange.html | 2026-09-11 | Current article on retrieval | Safeword 0.83.1+ | Expand-migrate-contract shows how incompatible work can become safe incremental states | Accept enabling slices when each intermediate state remains supported | Technique applies to compatibility changes, not every contribution; principles only, no code reuse |
| https://developers.openai.com/api/docs/guides/structured-outputs | 2026-09-11 | Current official documentation | Safeword 0.83.1+ reviewer runtime | Strict structured output requires every declared field and supports only a JSON Schema subset | Keep existing review-kind schemas unchanged and select a separate strict schema that requires `execution_plan_record` for `plan-execution` | OpenAI documents the Codex-side constraint; Claude compatibility still requires its own live route proof |

**Decision impact:** changed: replaced the existing task-count/component-count
heuristic as a PR-slicing authority with a conceptual dependency and proof
contract; retained numeric signals only as non-authoritative prompts.
**Decision informed:** Represent PR slicing as a dependency-ordered set of independently safe conceptual changes

### Recorded Decisions

| Decision | Choice | Alternatives considered | Rejected because |
| --- | --- | --- | --- |
| Represent PR slicing as a dependency-ordered set of independently safe conceptual changes | Decide one versus many explicitly; every slice names one purpose, boundary, prerequisites, proof, and supported post-merge state | Fixed line/file thresholds; one large PR divided into reviewer sections | Thresholds confuse volume with cognitive scope; sections improve navigation but cannot make changes independently mergeable or reversible |
| Extend the shared semantic review route with one canonical Execution Plan contract | Add a distinct review kind whose author and reviewer consume the same extracted slicing obligations through the existing coordinator | Reuse the Implementation Plan review kind; add a dedicated slicing checker | Reuse conflates design approval with execution readiness; a second engine duplicates transport, provenance, and lifecycle behavior |
| Admit only routes with semantic conformance proof | An exact runtime/model identity, or an explicit runtime-default identity, may approve `plan-execution` only after passing every authoritative scenario class. A resolved route list with no admitted identity ends routes-exhausted with no approval or stamp. | Let every configured coordinator route approve; admit by runtime name alone; require only one proven route | Model changes can alter semantic judgment; an unproven route can bypass accepted rejection behavior; one proven route makes another approval path unsafe |
| Make positive Execution Plan judgment machine-checkable | Add optional `execution_plan_record` to the reviewer-agent `ReviewerOutput` contract and CLI `data.reviewer_output`; select a strict `plan-execution` schema where the field is required but nullable on denial; validate approved records after schema parsing; leave the top-level schema-v1 CLI envelope and existing review-kind provider schemas unchanged. The [v1 CLI result schema](../../../packages/cli/schemas/cli-result-v1.schema.json) leaves command-specific `data` unconstrained, so the nested addition needs no envelope version bump. | Require exact prose labels in `summary`; encode positive facts as informational findings; add one optional field to every strict provider schema | Free prose can echo the input without proving judgment; findings remain message-shaped; strict structured output requires every declared property, while a denial cannot truthfully produce a complete positive record |
| Reject structurally invalid review records | The post-schema validator enforces [Reviewer-output validation](#reviewer-output-validation) after every provider adapter | Treat non-null as sufficient; validate only inside strict provider schemas; ask the deterministic validator to interpret source prose | Presence alone proves no judgment; provider enforcement differs; structural assertions can still be untrue, so semantic source completeness and decision preservation remain reviewer judgments until startable work supplies a canonical manifest |
| Bound Execution Plan approval to coding readiness | A current semantic approval authorizes only the transition to `implement`; parent Rule TBU1.R16 deliberately requires no second human approval after Execution Planning | Let reviewer approval imply implementation, verification, release, or merge authority; add a human approval after Execution Planning | Downstream claims overstate the evidence; a second human gate contradicts the accepted parent behavior and breaks headless completion |
| Retain the machine-checkable judgment with its review receipt | Persist `execution_plan_record` inside the existing integrity-checked review-job result and have the review stamp cite that review ID; do not duplicate it into a second ledger | Keep the record transient; copy it into the human design-approval ledger | Transient evidence cannot show what an approval covered; the design ledger represents human authority over approach bytes, not semantic execution-plan evidence |
| Keep dependency semantics host-neutral | Record logical prerequisites and merge order in `execution-plan.md`; allow repository tools to realize that order later | Require GitHub stacked pull requests; leave ordering implicit in prose | GitHub's feature is preview and not universal; implicit order cannot prove a safe intermediate merge |
| Stage this child as the slicing portion of the future canonical Execution Plan contract | Establish the contract and review-kind foundation now; [delivery checklist](../A639WN-complete-contributions-with-a-default-delivery-checklist/ticket.md) and [startable work](../7CAMAD-turn-decisions-into-startable-work/ticket.md) extend the same authority before release | Create a temporary child-specific contract; wait and implement all three children together | A temporary contract creates competing authority; one combined implementation defeats the accepted child dependencies and makes failures harder to isolate |

### Reviewer-output validation

The coordinator dispatches this post-schema validator only when the stored
review job kind is `plan-execution`. Existing review kinds keep their prior
validation and storage path and do not persist `execution_plan_record`.
An admitted best-available fallback uses the same contract, schema, validator,
and record invariants; its receipt records reduced independence and never labels
the result independent. An unproven fallback cannot approve.

For `plan-execution`, the validator applies these invariants after every
provider adapter:

- A legible denial is stored as denied and its record is normalized to null;
  record shape never turns it into retryable invalid output.
- For an approval, readable tripwires are evaluated before any other structural
  rule. `relies_on_unmerged_successor: true` or any readable decision status
  other than `unchanged` converts the result to a final denial, normalizes the
  record to null, and produces a blocking finding that names the assertion.
- After the tripwire pass, an approval needs a present, non-null record with a
  nonblank rationale. A missing, null, or structurally malformed positive
  record—including an absent or unreadable tripwire—is invalid output and may
  use only the coordinator's bounded remaining routes. Every route uses the
  same contract, schema, validator, and per-route semantic proof, and each route
  runs at most once. Retries recover malformed transport or format; they never
  seek reversal of a semantic denial.
- The slicing decision is `one_pull_request` with exactly one slice or
  `multiple_pull_requests` with at least two slices.
- Slice names are unique and nonblank. Every slice also has a nonblank purpose,
  boundary, proof, and completion signal. Its prerequisite list exists, and
  each prerequisite names a unique slice earlier in the record's slice array.
  A one-slice record has no prerequisites. Each slice's boolean
  `relies_on_unmerged_successor` is the tripwire for that slice, and a converted
  denial's finding names the offending slice.
- An approval has at least one obligation-owner entry. Every entry has a unique
  nonblank obligation name and one or more unique slice names that exist in the
  record. The floor is valid because every in-scope feature has at least one
  accepted behavior obligation; every slice is named by at least one entry.
- An approval has at least one decision-status entry. Every entry has a unique
  nonblank decision name and a present readable status exactly equal to
  `unchanged`. The floor is valid because every Implementation Plan has a
  Recorded Decision or an explicit no-load-bearing-choice applicability
  decision.

The validator proves structural integrity and explicit reviewer assertions.
The semantic reviewer proves whether the source obligations are complete and
the decisions truly remain unchanged. The verdict is the sole authority signal;
record presence grants none. Denied results and exhausted malformed-positive
routes persist no approval and write no approval stamp.

## Approvals

- Plan quality: independent semantic approval of the exact current plan bytes
  is required.
- Human design: not required by the current project configuration. Projects
  that enable it ask once before Execution Planning, never afterward.
- Product behavior: owned by the approved scenario contract and not duplicated
  here.

### Data applicability

Data applicability: this feature does not add application data, but it extends
the existing review-job result with an optional `execution_plan_record`. The
record is retained in the integrity-checked local review-job file with no new
automatic expiry; it remains available until that existing transient workspace
state is explicitly removed. Ownership and access follow that store's existing
model: the project-local file is mode `0600`, read by the current local Safeword
user, and authenticated with the user-scoped review integrity key. The review
stamp cites the job by ID and therefore fails closed if the job is removed.
Existing review kinds keep their provider schema and stored shape unchanged.
Compliance: not applicable because the record contains planning evidence
already present in the bounded review packet, not credentials, customer data,
or a new data classification. No second ledger, migration, cross-system flow,
or new application-data owner is introduced. Rollback leaves the now-unknown
job record as inert local state until existing workspace-state cleanup removes
it; it grants no authority. Review currency owns whether changed plan or context
digests make the cited review non-current.

### Persona consequences

| Persona | Need and design consequence | Confidence limit |
| --- | --- | --- |
| Technical Builder (TBU) | Can inspect the slice rationale, boundaries, prerequisites, proof, and obligation ownership in the retained review result; a current approval permits coding but cannot impersonate verification or merge authority | This child proves the semantic record and review route; startable work owns the final coding-transition gate |
| Non-Technical Builder (NTB) | Receives a refusal when work is not safely sliced without being treated as an approver; plain-language gate recovery converts the typed reason into one recovery action | Until that recovery work lands, the denial may expose internal terms |
| Safeword Maintainer (SWM) | Gets one declarative Execution Planning contract, exact-byte generation checks, and live proof that the shared reviewer applies it | Live fixtures establish representative semantic behavior, not universal reviewer consistency |

## Design alignment

| Principle | Consequence | Proof | Conflict |
| --- | --- | --- | --- |
| Structure enforces; instructions suggest | The installed review packet carries the exact canonical slicing contract and cannot pass with missing or mismatched author/reviewer obligations | [installed-contract and rejection scenarios](features/split-large-contributions-into-reviewable-prs.feature) | |
| Add, never replace | Existing review kinds retain their provider schemas, validator paths, and stored result shapes | [existing review compatibility release gate](.project/tickets/6XW8H7-split-large-contributions-into-reviewable-prs/impl-plan.md#release-gates) | |
| Discover decisions before prescribing work | Slicing consumes accepted Implementation Plan decisions, assigns every obligation, and rejects a slice that reopens the approach | [R2 and R5 scenarios](features/split-large-contributions-into-reviewable-prs.feature) | |
| Optimize for the NTB without constraining the TBU | This child emits typed semantic denials; plain-language gate recovery owns one recovery action without removing technical detail | [typed denial scenarios](features/split-large-contributions-into-reviewable-prs.feature); [delegated recovery scenarios](features/make-planning-gates-understandable-and-scope-safe.feature) | |
| Correct and safe; then clear; then simple | One new review kind reuses the existing packet and coordinator path; no second checker or repository-host dependency is introduced | [CLI wiring and dependency-safety scenarios](features/split-large-contributions-into-reviewable-prs.feature) | |

Architecture applicability: this feature adds the slicing obligations of the
shared Execution Planning contract. It honors `ARCHITECTURE.md` → “Separate
Implementation and Execution Planning Gates,” which already decides that
`execution-plan.md` contains independently reviewable PRs and that each planning
phase has one canonical author/reviewer contract. Implementation will append a
narrow extension to the existing cross-agent review-coordinator decision,
recording `plan-execution` as an anticipated semantic review kind that reuses
the coordinator without new lifecycle state. The extension will link this
plan's reviewer-output validation, storage, schema-compatibility, and
reassessment boundaries rather than restating them. It will not create a
separate ADR.

## Known deviations

The existing BDD splitting guide uses task, component, test, line, and file
counts as workflow decomposition prompts. This plan does not remove those
prompts; it deliberately refuses to treat any numeric threshold as sufficient
proof that a code-review slice is coherent. The two mechanisms answer different
questions.

## Doc impact

- The canonical Execution Planning skill and artifact template will explain the
  slicing decision and slice fields as part of the product behavior.
- README and installed-host workflow migration: skip: installed workflow
  migration owns public phase migration and equivalent installed delivery after
  the M1 contracts exist.

## Assessment triggers

- Evidence that reviewers cannot consistently distinguish one conceptual
  concern from two under the contract: revisit the semantic examples before
  adding a numeric rule.
- A supported repository host requires different dependency semantics to keep
  intermediate merges valid: extend the host-neutral prerequisite model, not
  the canonical contract with host commands.
- The shared review coordinator needs slicing-specific lifecycle state beyond
  the contract bytes: reconsider reuse before adding a parallel engine.
- A semantic reviewer returns a generic denial instead of naming the omitted
  field or obligation: expand the adversarial live matrix before trusting that
  reviewer version for Execution Plan approval.
- Startable work supplies a canonical obligation manifest, or live review misses
  an accepted obligation or decision: replace the temporary structural floors
  with deterministic comparison to that manifest.
- Delivery checklist or startable work reveals that staged contract composition
  would create two authorities: return to Implementation Planning and collapse
  the clauses into the single canonical Execution Plan contract before
  implementation continues.
