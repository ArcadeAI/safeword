# Feature Contribution: Turn accepted decisions into startable work

<!-- safeword:product-plan-contract:v1 -->

## Parent References

- **Parent:** 82T411
- **Milestone:** M1
- **Parent job:** plan-implementability.TBU2
- **Killer Demo:** inherited from the parent spec

<!-- Inherited by reference; the child never restates it. To skip demo proof for
     this feature alone, append an em-dash skip clause to the Killer Demo line
     above, in the form SCENARIOS.md documents. Never record it by editing the
     parent's "## Killer Demo" — that silences every sibling. -->

## Contribution

Turn an approved approach into dependency-ordered work that a fresh agent can
start and verify without silently making a new behavior-shaping decision.

## Rules

<!-- Rules stay at h4 even without an h3 above them: scenario-coverage.ts reads
each `#### ` heading as a Rule/AC id, so demoting these to h3 would break child
lineage parsing to satisfy a cosmetic heading rule. -->
<!-- markdownlint-disable MD001 -->

#### plan-implementability.TBU2.7CAMAD.R1 — Execution Planning requires a reviewed current approach

#### plan-implementability.TBU2.7CAMAD.R2 — Every execution step is startable without inventing a contract

#### plan-implementability.TBU2.7CAMAD.R3 — Authors and reviewers use one implementability contract

#### plan-implementability.TBU2.7CAMAD.R4 — Execution discoveries return to the owning phase

#### plan-implementability.TBU2.7CAMAD.R5 — The Execution Plan is a project-local reviewed artifact

#### plan-implementability.TBU2.7CAMAD.R6 — Semantic review detects disguised unresolved decisions

#### plan-implementability.TBU2.7CAMAD.R7 — Structural gates report facts rather than semantic quality

#### plan-implementability.TBU2.7CAMAD.R8 — Accepted proof strategies become exact test work

#### plan-implementability.TBU2.7CAMAD.R9 — Coding requires a reviewed current Execution Plan

#### plan-implementability.TBU2.7CAMAD.R10 — Every accepted obligation maps to startable work

#### plan-implementability.TBU2.7CAMAD.R11 — Execution Planning supplies rather than replaces TDD

<!-- markdownlint-enable MD001 -->

## Surfaces

Affected:

- Safeword CLI
- Claude Code
- Claude Code Cloud
- OpenAI Codex
- OpenCode — profile catalogue only; Desktop remains advisory until native hook support exists
- Cursor
- Cursor Cloud Agents

Unaffected:

- Claude Code on the Web — no browser-entry-point behavior changes
- OpenAI Codex Cloud — repository instructions are advisory and cannot enforce the local phase gate
