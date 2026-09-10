# Feature Contribution: Approve coherent Implementation Plans

<!-- safeword:product-plan-contract:v1 -->

## Parent References

- **Parent:** 82T411
- **Milestone:** M1
- **Parent job:** plan-implementability.TBU1
- **Killer Demo:** inherited from the parent spec — this child owns the simultaneous-defect discovery, repair, and corrected-byte approval portion of the Plan repair payoff; skip the accepted-plan-to-Execution-Plan-and-first-RED continuation: 7CAMAD owns it; skip Complete feature journey: YCFFNC owns installed conversational-host delivery; skip Implementation replan: 7CAMAD owns implementation-time plan revision and resume

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

#### plan-implementability.TBU1.G1C9PP.R3 — The plan opens with an architecture-at-a-glance mental model and keeps decision-bearing detail in the main review path without becoming an execution or evidence manual

#### plan-implementability.TBU1.G1C9PP.R4 — The Implementation Plan is a project-local reviewed artifact

#### plan-implementability.TBU1.G1C9PP.R5 — Architecture applicability is explicit

#### plan-implementability.TBU1.G1C9PP.R6 — Applicable data decisions cover purpose, store and model, schema and relationships, source of truth, ownership and access, identity and integrity, cross-system flow, lifecycle and retention, migration and backfill, compliance, and rollback at decision depth

#### plan-implementability.TBU1.G1C9PP.R7 — Significant decisions also enter the durable architecture record

#### plan-implementability.TBU1.G1C9PP.R8 — Architectural significance uses semantic triggers

#### plan-implementability.TBU1.G1C9PP.R9 — One feature has one design plan of record

#### plan-implementability.TBU1.G1C9PP.R10 — Implementation planning chooses proof scope and confidence without absorbing execution mechanics or the verification ledger

#### plan-implementability.TBU1.G1C9PP.R11 — Behavior-shaping decisions cannot leak into execution planning

#### plan-implementability.TBU1.G1C9PP.R12 — Load-bearing choices carry alternatives and evidence

#### plan-implementability.TBU1.G1C9PP.R13 — Decision evidence is structurally present and semantically judged

#### plan-implementability.TBU1.G1C9PP.R14 — Decision discovery is scope-bounded and covers the consequential trust, operation, approval, and recovery needs of every accepted persona

#### plan-implementability.TBU1.G1C9PP.R15 — Review receipts expose decision reviewability and concrete recovery

#### plan-implementability.TBU1.G1C9PP.R16 — When planning and implementation states coexist, the plan distinguishes proposed decisions, implemented facts, available proof, known defects, and pending human authority without treating one as another

#### plan-implementability.TBU1.G1C9PP.R17 — Significant concurrency, security, durability, lifecycle, migration, and compatibility choices include the applicable state, authority, atomicity, retry, and evidence model at decision depth

#### plan-implementability.TBU1.G1C9PP.R18 — Accepted quantitative promises carry a design-level measurement contract without moving Product-owned outcomes or Execution-owned instrumentation into the Implementation Plan

#### plan-implementability.TBU1.G1C9PP.R19 — The existing optional human design approval binds the exact semantically reviewed Implementation Plan before Execution Planning; unchanged approach bytes reuse that approval, changed approach bytes require a new decision, approval is not duplicated after the Execution Plan, and headless work records pending authority without deadlocking or claiming approval

#### plan-implementability.TBU1.G1C9PP.R20 — An incomplete or incorrect plan returns to decision discovery with the full current set of blocking defects and is corrected and re-reviewed on its new exact bytes until complete and correct or honestly waiting on an external decision

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
