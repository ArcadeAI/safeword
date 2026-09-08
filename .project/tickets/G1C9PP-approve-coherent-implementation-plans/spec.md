# Feature Contribution: Approve coherent Implementation Plans

<!-- safeword:product-plan-contract:v1 -->

## Parent References

- **Parent:** 82T411
- **Milestone:** M1
- **Parent job:** plan-implementability.TBU1
- **Killer Demo:** inherited from the parent spec — skip: 7CAMAD owns the cold-start execution payoff after this feature approves its input

<!-- Inherited by reference; the child never restates it. To skip demo proof for
     this feature alone, append an em-dash skip clause to the Killer Demo line
     above, in the form SCENARIOS.md documents. Never record it by editing the
     parent's "## Killer Demo" — that silences every sibling. -->

## Contribution

Define the Implementation Plan as the single, project-local record that makes
all accepted approach decisions reviewable before execution is sequenced.

## Rules

<!-- Rules stay at h4 even without an h3 above them: scenario-coverage.ts reads
each `#### ` heading as a Rule/AC id, so demoting these to h3 would break child
lineage parsing to satisfy a cosmetic heading rule. -->
<!-- markdownlint-disable MD001 -->

#### plan-implementability.TBU1.G1C9PP.R1 — Implementation Planning is a distinct approach-decision phase

#### plan-implementability.TBU1.G1C9PP.R2 — Authors and reviewers use one decision-quality contract

#### plan-implementability.TBU1.G1C9PP.R3 — Decisions remain reviewable without becoming an execution manual

#### plan-implementability.TBU1.G1C9PP.R4 — The Implementation Plan is a project-local reviewed artifact

#### plan-implementability.TBU1.G1C9PP.R5 — Architecture applicability is explicit

#### plan-implementability.TBU1.G1C9PP.R6 — Data guidance applies to data-contract changes

#### plan-implementability.TBU1.G1C9PP.R7 — Significant decisions also enter the durable architecture record

#### plan-implementability.TBU1.G1C9PP.R8 — Architectural significance uses semantic triggers

#### plan-implementability.TBU1.G1C9PP.R9 — One feature has one design plan of record

#### plan-implementability.TBU1.G1C9PP.R10 — Implementation planning chooses proof scope without execution mechanics

#### plan-implementability.TBU1.G1C9PP.R11 — Behavior-shaping decisions cannot leak into execution planning

#### plan-implementability.TBU1.G1C9PP.R12 — Load-bearing choices carry alternatives and evidence

#### plan-implementability.TBU1.G1C9PP.R13 — Decision evidence is structurally present and semantically judged

#### plan-implementability.TBU1.G1C9PP.R14 — Decision discovery is complete and scope-bounded

#### plan-implementability.TBU1.G1C9PP.R15 — Review receipts expose decision reviewability

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
