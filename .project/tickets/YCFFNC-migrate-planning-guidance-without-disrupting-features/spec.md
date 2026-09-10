# Feature Contribution: Migrate planning guidance without disrupting features

<!-- safeword:product-plan-contract:v1 -->

## Parent References

- **Parent:** 82T411
- **Milestone:** M2
- **Parent job:** plan-implementability.TBU1
- **Killer Demo:** inherited from the parent spec — this child owns the installed complete-feature journey across supported authoritative hosts; G1C9PP and 7CAMAD own the plan-repair-and-start proof

<!-- Inherited by reference; the child never restates it. To skip demo proof for
     this feature alone, append an em-dash skip clause to the Killer Demo line
     above, in the form SCENARIOS.md documents. Never record it by editing the
     parent's "## Killer Demo" — that silences every sibling. -->

## Contribution

Replace legacy feature-design routes with the two-plan workflow while preserving
accepted work already in implementation and proving the installed planning
behavior at every affected host boundary.

## Rules

<!-- Rules stay at h4 even without an h3 above them: scenario-coverage.ts reads
each `#### ` heading as a Rule/AC id, so demoting these to h3 would break child
lineage parsing to satisfy a cosmetic heading rule. -->
<!-- markdownlint-disable MD001 -->

#### plan-implementability.TBU1.YCFFNC.R1 — In-flight tickets migrate without retroactive blocking

#### plan-implementability.TBU1.YCFFNC.R2 — Planning guidance names only the two feature plans

#### plan-implementability.TBU1.YCFFNC.R3 — Architecture guidance redirects feature-local design

#### plan-implementability.TBU1.YCFFNC.R4 — Data guidance uses semantic applicability and significance

#### plan-implementability.TBU1.YCFFNC.R5 — Deep design is folded into the Implementation Plan

#### plan-implementability.TBU1.YCFFNC.R6 — A plan created or revised after implementation exists reconciles its claims against current behavior and records discrepancies without relabeling them as accepted, proven, or approved

#### plan-implementability.TBU1.YCFFNC.R7 — Installed guidance delivers both planning-phase entry gates and project-local artifacts, the feature Delivery Checklist, and reviewable pull-request slicing, and proves that behavior at each affected host boundary or records a specific justified limitation at that real boundary

#### plan-implementability.TBU1.YCFFNC.R8 — On each supported authoritative host, a plain feature prompt automatically traverses intake, behavior definition, both planning phases, TDD implementation, verification, checklist completion, and pull-request preparation while preserving a contract-quality Product Plan, Implementation Plan, and Execution Plan and leaving human review and merge authority intact

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
