# Impl Plan: Split large contributions into independently reviewable PRs

**Status:** planned
**Planned on:** 2026-09-11

## Approach

Architecture at a glance: one canonical Execution Planning contract defines
both author and reviewer expectations for pull-request slicing. The existing
review coordinator transports those exact contract bytes under a distinct
Execution Plan review kind; it does not gain a second review engine. The
contract models a contribution as one or more conceptual slices ordered by
dependency. Each slice has one purpose, a boundary, prerequisites, proof, and a
safe completion state. Repository-host stacking features may carry that order,
but Safeword's contract does not depend on one host.

The riskiest assumption is that Execution Plan review can judge conceptual
slice boundaries without falling back to line-count rules or inventing a design
decision. The proof therefore has two layers: deterministic tests prove that the
installed CLI sends the exact packaged contract and handles its typed result,
while a live-model smoke sends three positive plans and one compact defect
matrix through that same CLI boundary. The positive plans cover one large
coherent mechanical change, two independently valuable concerns with separate
proof, and a schema-addition slice ordered before reader activation. Their
review summaries must record slice eligibility, the one-versus-many rationale,
the schema-before-reader merge order with no unmerged-successor reliance, each
obligation owner, and that accepted decisions remain unchanged. The negative
matrix contains distinct cases for an omitted slicing decision, one specifically
named field omission, a two-independent-purpose slice, a formally complete slice
with an unresolved authorization boundary, an unsafe dependency, a
threshold-only justification, one specifically named unassigned obligation, and
a rewritten accepted decision. Its review must return one typed blocking finding
per category; the findings must name the exact omitted field, require one
coherent purpose per slice, name the unsafe intermediate merge and its missing
prerequisite, and name the unassigned obligation and unresolved authorization
decision. Deterministic fixtures exhaustively cover all five field omissions and
all six obligation omissions by name. Separate contract-derived tests remove
each R1–R5 clause in turn and must fail; these mutations prove only that required
contract bytes are present and dispatched, while the live lane proves
representative semantic application. Exact dispatch proof compares the captured
contract bytes and their SHA-256 digest with the installed source; a version
label cannot satisfy it.

Proof strategy:

| Behavior | Real boundary | Primary proof | Confidence limit |
| --- | --- | --- | --- |
| R1 makes and justifies the one-versus-many slicing decision | Packaged author/reviewer contract through the installed CLI route | Exact-contract integration, R1 clause-deletion mutation, live one-slice and two-slice positive records, and an omitted-decision denial | Mutation proves clause presence only; live records prove that one-slice plans explain why another split adds no review value, two-slice plans name both proofs, and omission is denied, not a universal estimate of review effort |
| R2 requires a complete, single-purpose slice with no invented design | Semantic reviewer consuming the accepted approach and proposed slices | Field-omission, two-purpose, and separately formally-complete-but-undecided-design fixtures; R2 clause-deletion mutation; live eligible-slice record and distinct negative findings | Deterministic proof establishes contract presence and routing; live proof inspects the positive eligibility record and requires the unresolved-design finding to name the authorization decision |
| R3 orders dependencies and keeps every intermediate merge supported | Semantic reviewer over schema-before-reader and unsafe-successor examples | R3 clause-deletion mutation, live positive summary naming schema-before-reader order and no successor reliance, and live denial naming the unsafe intermediate merge and missing prerequisite | Mutation proves clause presence only; live proof establishes the explicit dependency distinction, not repository-host merge behavior |
| R4 judges conceptual scope and proof rather than size alone | Semantic reviewer over large-mechanical, small-multi-purpose, and threshold-only examples | R4 clause-deletion mutation, live one-concern and two-concern positive records with named proof, and threshold-only denial | Mutation proves clause presence only; live proof establishes conceptual application while line and file counts remain advisory signals |
| R5 assigns every accepted obligation without rewriting the approach | Reviewer packet containing the current Implementation Plan and proposed slice map | Exhaustive named obligation-omission fixtures and changed-decision fixtures, R5 clause-deletion mutation, live positive summary containing the obligation-to-slice map and unchanged-decision record, and representative live denials naming the omitted obligation and changed decision | Mutation proves clause presence only; deterministic examples prove every required name; live proof establishes representative semantic application; `5F5ZZA` owns semantic-context digest invalidation for both review kinds, while `G1C9PP` owns the current Implementation Plan decision consumer |
| New Execution Plan review entry point | Real CLI, real packet builder and coordinator, deterministic substitute only for the external reviewer process | Wiring integration | Proves local CLI wiring; installed agent-host delivery remains a `YCFFNC` prerequisite |

Build order begins with RED proof for the canonical Execution Planning
skill/template, whose marked review section is the one author/reviewer contract,
then implements that contract and extractor. A second RED step proves the
Execution Plan review kind before extending the shared packet and coordinator
path. Contract-derived semantic fixtures and clause-deletion mutations stay in
the same RED/GREEN slice as each R1–R5 obligation. As soon as the contract and
review kind exist, a minimal live probe tests one coherent positive and one
two-purpose negative before further fixture investment. The full live-model
matrix then checks the assembled boundary, and generated host assets refresh
last. Its environment flag remains opt-in so ordinary test runs do not spend
tokens, but a passing live result is mandatory completion evidence for this
child; `verify.md` records the exact fixture digests, coordinator review IDs,
reviewer provenance, verdicts, and required positive/negative record checks. An
unavailable reviewer blocks completion rather than becoming a claimed pass. The
contract and its minimal semantic probe are load-bearing: if author/reviewer
bytes diverge or the reviewer misses conceptual cohesion, no later work
proceeds.

Affected surfaces:

- Safeword CLI: real-command wiring and semantic contract proof.
- Claude Code, Claude Code Cloud, OpenAI Codex, Cursor, and Cursor Cloud Agents:
  skip: `YCFFNC` owns installed delivery and real-host parity in M2; this M1
  child supplies the canonical contract they will consume.
- OpenCode: skip: `YCFFNC` owns catalogue delivery in M2; Desktop remains
  advisory until native hook dispatch is independently proven.

Decision boundaries:

- API, authorization, and data contracts: not applicable; this feature adds no
  application API, permission boundary, or persisted domain data.
- Failure behavior: semantic review refuses a missing slicing decision,
  incomplete or unsafe slice, discarded obligation, or rewritten approach.
  `K3EBHB` owns the final plain-language recovery projection.
- Compatibility and rollout: the new contract and review kind remain part of
  the unreleased epic until `YCFFNC` supplies in-flight migration and host
  parity. Existing implementation-phase tickets are not retroactively blocked.
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

**Decision impact:** changed: replaced the existing task-count/component-count
heuristic as a PR-slicing authority with a conceptual dependency and proof
contract; retained numeric signals only as non-authoritative prompts.
**Decision informed:** Represent PR slicing as a dependency-ordered set of independently safe conceptual changes

### Recorded Decisions

| Decision | Choice | Alternatives considered | Rejected because |
| --- | --- | --- | --- |
| Represent PR slicing as a dependency-ordered set of independently safe conceptual changes | Decide one versus many explicitly; every slice names one purpose, boundary, prerequisites, proof, and supported post-merge state | Fixed line/file thresholds; one large PR divided into reviewer sections | Thresholds confuse volume with cognitive scope; sections improve navigation but cannot make changes independently mergeable or reversible |
| Extend the shared semantic review route with one canonical Execution Plan contract | Add a distinct review kind whose author and reviewer consume the same extracted slicing obligations through the existing coordinator | Reuse the Implementation Plan review kind; add a dedicated slicing checker | Reuse conflates design approval with execution readiness; a second engine duplicates transport, provenance, and lifecycle behavior |
| Keep dependency semantics host-neutral | Record logical prerequisites and merge order in `execution-plan.md`; allow repository tools to realize that order later | Require GitHub stacked pull requests; leave ordering implicit in prose | GitHub's feature is preview and not universal; implicit order cannot prove a safe intermediate merge |
| Stage this child as the slicing portion of the future canonical Execution Plan contract | Establish the contract and review-kind foundation now; `A639WN` and `7CAMAD` extend the same authority with checklist and full startability obligations before release | Create a temporary child-specific contract; wait and implement all three children together | A temporary contract creates competing authority; one combined implementation defeats the accepted child dependencies and makes failures harder to isolate |

### Data applicability

Data applicability: skip: this feature changes planning and review contracts but
does not add a data contract, persisted entity, ownership rule, or lifecycle.
The existing transient review-job and project-ledger behavior is unchanged.

## Design alignment

| Principle | Consequence | Proof | Conflict |
| --- | --- | --- | --- |
| Structure enforces; instructions suggest | The installed review packet carries the exact canonical slicing contract and cannot pass with missing or mismatched author/reviewer obligations | [installed-contract and rejection scenarios](features/split-large-contributions-into-reviewable-prs.feature) | |
| Discover decisions before prescribing work | Slicing consumes accepted Implementation Plan decisions, assigns every obligation, and rejects a slice that reopens the approach | [R2 and R5 scenarios](features/split-large-contributions-into-reviewable-prs.feature) | |
| Optimize for the NTB without constraining the TBU | This child emits typed semantic denials; `K3EBHB` owns their single plain-language recovery action without removing technical detail | [typed denial scenarios](features/split-large-contributions-into-reviewable-prs.feature); [delegated recovery scenarios](features/make-planning-gates-understandable-and-scope-safe.feature) | |
| Correct and safe; then clear; then simple | One new review kind reuses the existing packet and coordinator path; no second checker or repository-host dependency is introduced | [CLI wiring and dependency-safety scenarios](features/split-large-contributions-into-reviewable-prs.feature) | |

Architecture applicability: this feature adds the slicing obligations of the
shared Execution Planning contract. It honors `ARCHITECTURE.md` → “Separate
Implementation and Execution Planning Gates,” which already decides that
`execution-plan.md` contains independently reviewable PRs and that each planning
phase has one canonical author/reviewer contract. Implementation will append a
narrow extension to the existing cross-agent review-coordinator decision,
recording `plan-execution` as an anticipated semantic review kind that reuses
the coordinator without new lifecycle state; it will not create a separate ADR.

## Known deviations

The existing BDD splitting guide uses task, component, test, line, and file
counts as workflow decomposition prompts. This plan does not remove those
prompts; it deliberately refuses to treat any numeric threshold as sufficient
proof that a code-review slice is coherent. The two mechanisms answer different
questions.

Live proof uses one representative named field omission and one representative
named obligation omission. Skip: running all eleven permutations through a
token-spending reviewer repeats the same semantic class without increasing the
confidence boundary. Exhaustive deterministic fixtures still require every
field and obligation name in the shipped contract, while the representative
live cases prove the reviewer applies that naming rule.

## Doc impact

- The canonical Execution Planning skill and artifact template will explain the
  slicing decision and slice fields as part of the product behavior.
- README and installed-host workflow migration: skip: `YCFFNC` owns public phase
  migration and equivalent installed delivery after the M1 contracts exist.

## Assessment triggers

- Evidence that reviewers cannot consistently distinguish one conceptual
  concern from two under the contract: revisit the semantic examples before
  adding a numeric rule.
- A supported repository host requires different dependency semantics to keep
  intermediate merges valid: extend the host-neutral prerequisite model, not
  the canonical contract with host commands.
- The shared review coordinator needs slicing-specific lifecycle state beyond
  the contract bytes: reconsider reuse before adding a parallel engine.
- `A639WN` or `7CAMAD` reveals that staged contract composition would create two
  authorities: return to Implementation Planning and collapse the clauses into
  the single canonical Execution Plan contract before implementation continues.
