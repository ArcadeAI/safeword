# Architecture Decision Guide

Use during Implementation Planning when a choice changes shared structure,
contracts, a key quality attribute, or something difficult to reverse. A
feature's `impl-plan.md` is its design plan of record. Record every
behavior-shaping choice and consequence there. Give a significant choice a
resolvable link to the configured durable architecture record; a routine,
reversible feature-local choice stays in the plan.

## Read state and decisions separately

`<namespace-root>/architecture.generated.md` describes what the codebase is
now. Its monorepo root index is fully machine-owned. Headings, code references, fingerprints,
dependency edges, and status markers are regenerated. In a package leaf, module
purpose prose is human-owned and preserved only while that module remains present;
refresh prose marked stale when responsibility changes. Do not put design
decisions in generated structure.

The configured `paths.architecture` record explains why durable choices were
made. It may be a file or a directory of records. Read applicable records
before finalizing the plan; do not assume `ARCHITECTURE.md` or one file per
decision is universal.

## Decide significance by consequence

A shared API, service boundary, data owner, migration compatibility rule, or
hard-to-reverse technology choice can be significant in one file. A many-file
mechanical edit can be routine. Use these questions:

- Will another feature, team, service, or client have to honor this choice?
- Does it change which component owns an invariant, failure, or data?
- Would reversing it require migration, coordinated release, or user impact?
- Does it establish a quality constraint such as availability or isolation?

When all answers are no, give `Architecture applicability: skip: <reason>` or
name the feature-local component consequence in `impl-plan.md`. When an answer
is yes, record the choice, rejected credible alternative, rationale, tradeoff,
affected consumers, and reversal condition in the plan. Record the lasting
shared constraint in the configured durable record, and resolve its link before
requesting plan review. Do not maintain two competing versions of the rule.

## Compare the ideal with the existing system

Frame hard constraints and derive candidate approaches before surveying local
patterns. Then inspect relevant code, generated architecture state, tests, and
prior decisions. Reuse a sound pattern. If a different approach fixes a
concrete defect, name that defect, the affected call sites, and the cost of
having two patterns. A deviation is an explicit plan decision, not an
unexplained exception.

For a significant decision, let independent review challenge the alternative,
compatibility story, and reversibility. A later changed decision updates the
Implementation Plan and supersedes the old durable record through the
repository's configured record format; keep the old rationale discoverable.

## Boundaries and supporting detail

Describe the actual layer and dependency boundaries of this project. Do not
impose example `app/domain/infra` directories or a language-specific enforcement
tool as a universal architecture. Link a diagram or detailed interface example
when it clarifies a named plan decision; it cannot become a second feature
design authority.

For data ownership, lifecycle, schema, and cross-system flow, use the data
architecture guide. For a changed interface or access policy, use the
interface contract guide. The Execution Plan owns exact file edits, commands,
and release order.
