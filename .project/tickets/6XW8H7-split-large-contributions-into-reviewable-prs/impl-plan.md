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
while an opt-in live-model smoke sends a matched pair through that same CLI
boundary—one large coherent mechanical change and one small change with two
independently valuable concerns. The smoke must approve the former, reject the
latter, and fail if the contract's conceptual-scope clause is removed.

Proof strategy:

| Behavior | Real boundary | Primary proof | Confidence limit |
| --- | --- | --- | --- |
| R1 makes the one-versus-many slicing decision explicit | Packaged Execution Plan contract through the installed CLI review route | Integration plus live-model smoke | Deterministic proof covers exact contract delivery; the live matched pair proves one load-bearing semantic distinction, not a universal estimate of review effort |
| R2 requires a complete, single-purpose slice with no invented design | Semantic reviewer consuming the accepted approach and proposed slices | Integration with field-omission, two-purpose, and formally-complete-but-undecided-design examples | Deterministic proof covers every accepted partition; the live smoke exercises the highest-risk single-purpose distinction |
| R3 orders dependencies and keeps every intermediate merge supported | Semantic reviewer over schema-before-reader and unsafe-successor examples | Integration | Proves the explicit dependency cases, not repository-host merge behavior |
| R4 judges conceptual scope and proof rather than size alone | Semantic reviewer over large-mechanical, small-multi-purpose, and threshold-only examples | Integration | Line and file counts may remain advisory signals; they cannot establish reviewability |
| R5 assigns every accepted obligation without rewriting the approach | Reviewer packet containing the current Implementation Plan and proposed slice map | Integration with obligation-omission and changed-decision matrices | Proves preservation in the bounded packet; `5F5ZZA` owns stale-context invalidation across plan reviews |
| New Execution Plan review entry point | Real CLI, real packet builder and coordinator, deterministic substitute only for the external reviewer process | Wiring integration | Proves local CLI wiring; installed agent-host delivery remains a `YCFFNC` prerequisite |

Build order begins by authoring the canonical Execution Planning skill/template
whose marked review section is the one author/reviewer contract, then adds its
extractor. Next it adds the Execution Plan review kind to the shared packet and
coordinator path, adds deterministic semantic contract proofs plus the opt-in
live-model discrimination smoke, and finally refreshes generated host assets.
The contract slice is load-bearing: if author and reviewer bytes or obligations
diverge, no later work proceeds.

Affected surfaces:

- Safeword CLI: real-command wiring and semantic contract proof.
- Claude Code, Claude Code Cloud, OpenAI Codex, OpenCode, Cursor, and Cursor
  Cloud Agents: skip: `YCFFNC` owns installed delivery and real-host parity in
  M2; this M1 child supplies the canonical contract they will consume.

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
| Structure enforces; instructions suggest | The installed review packet carries the exact canonical slicing contract and cannot pass with missing or mismatched author/reviewer obligations | `features/split-large-contributions-into-reviewable-prs.feature` installed-contract and rejection scenarios | |
| Discover decisions before prescribing work | Slicing consumes accepted Implementation Plan decisions, assigns every obligation, and rejects a slice that reopens the approach | `features/split-large-contributions-into-reviewable-prs.feature` R2 and R5 scenarios | |
| Optimize for the NTB without constraining the TBU | This child emits typed semantic denials; `K3EBHB` owns their single plain-language recovery action without removing technical detail | `K3EBHB` scenario and verification evidence before epic completion | Recovery rendering is intentionally delegated rather than duplicated here |
| Correct and safe; then clear; then simple | One new review kind reuses the existing packet and coordinator path; no second checker or repository-host dependency is introduced | `features/split-large-contributions-into-reviewable-prs.feature` CLI wiring and dependency-safety scenarios | |

Architecture applicability: this feature adds the slicing obligations of the
shared Execution Planning contract. It honors `ARCHITECTURE.md` → “Separate
Implementation and Execution Planning Gates,” which already decides that
`execution-plan.md` contains independently reviewable PRs and that each planning
phase has one canonical author/reviewer contract. No new durable architecture
decision is required.

## Known deviations

The existing BDD splitting guide uses task, component, test, line, and file
counts as workflow decomposition prompts. This plan does not remove those
prompts; it deliberately refuses to treat any numeric threshold as sufficient
proof that a code-review slice is coherent. The two mechanisms answer different
questions.

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
