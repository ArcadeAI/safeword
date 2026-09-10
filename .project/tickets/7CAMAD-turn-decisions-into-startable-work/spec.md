# Feature Contribution: Turn accepted decisions into startable work

<!-- safeword:product-plan-contract:v1 -->

## Parent References

- **Parent:** 82T411
- **Milestone:** M1
- **Parent job:** plan-implementability.TBU2
- **Killer Demo:** inherited from the parent spec — G1C9PP owns the plan repair loop, this child owns the accepted-plan-to-first-RED continuation and implementation-time replan, and 3EG00H owns the task-and-patch proportional-flow clause

<!-- Inherited by reference; the child never restates it. To skip demo proof for
     this feature alone, append an em-dash skip clause to the Killer Demo line
     above, in the form SCENARIOS.md documents. Never record it by editing the
     parent's "## Killer Demo" — that silences every sibling. -->

## Contribution

Turn an approved approach into dependency-ordered work that a fresh agent can
start and verify without silently making a new behavior-shaping decision.

K3EBHB owns the plain-language recovery rendering for this child's blocked gate
outcomes; 5F5ZZA owns review transport, fallback, and provenance validation.

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

#### plan-implementability.TBU2.7CAMAD.R12 — The Execution Plan distinguishes current implementation from target work and uses the canonical evidence-currency taxonomy owned by A639WN.R7

#### plan-implementability.TBU2.7CAMAD.R13 — The Execution Plan carries the feature Delivery Checklist and maps accepted obligations into dependency-ordered tasks and independently reviewable pull-request slices under the sibling checklist and slicing contracts

#### plan-implementability.TBU2.7CAMAD.R14 — Execution Plan approval establishes only that delivery is startable and provable without a new behavior-shaping decision; it does not claim implementation, verification, human release approval, or merge authority

#### plan-implementability.TBU2.7CAMAD.R15 — Accepted measurement decisions become concrete instrumentation, test, and evidence-collection work without redefining the upstream promise or validity contract

#### plan-implementability.TBU2.7CAMAD.R16 — Changing load-bearing behavior or scope invalidates both plan reviews, changing the accepted Implementation Plan invalidates both plan reviews, and changing only the Execution Plan invalidates only its own review

#### plan-implementability.TBU2.7CAMAD.R17 — A design-changing implementation decision returns through revised and re-reviewed Implementation and Execution Plans, while a sequencing-only decision returns through a revised and re-reviewed Execution Plan; both paths preserve still-valid work and evidence and resume from the first invalidated obligation

<!-- markdownlint-enable MD001 -->

## Surfaces

Affected:

- Safeword CLI
- Claude Code — skip: M1 defines the plan contract; YCFFNC in M2 owns installed delivery and real-boundary proof
- Claude Code Cloud — skip: M1 defines the plan contract; YCFFNC in M2 owns installed delivery and real-boundary proof
- OpenAI Codex — skip: M1 defines the plan contract; YCFFNC in M2 owns installed delivery and real-boundary proof
- OpenCode — skip: M1 defines the profile contract; YCFFNC in M2 owns catalogue delivery, while Desktop remains advisory until native hook dispatch is independently proven
- Cursor — skip: M1 defines the plan contract; YCFFNC in M2 owns installed delivery and real-boundary proof
- Cursor Cloud Agents — skip: M1 defines the plan contract; YCFFNC in M2 owns installed delivery and real-boundary proof

Unaffected:

- Claude Code on the Web — no browser-entry-point behavior changes
- OpenAI Codex Cloud — repository instructions are advisory and cannot enforce the local phase gate
