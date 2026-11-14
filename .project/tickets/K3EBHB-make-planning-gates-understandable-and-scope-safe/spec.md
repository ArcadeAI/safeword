# Feature Contribution: Make planning gates understandable and scope-safe

<!-- safeword:product-plan-contract:v1 -->

## Parent References

- **Parent:** 82T411
- **Milestone:** M2
- **Parent job:** plan-implementability.NTB1
- **Killer Demo:** inherited from the parent spec — skip: this child proves plain recovery messages while G1C9PP and 7CAMAD own the parent plan-repair and execution payoffs

<!-- Inherited by reference; the child never restates it. To skip demo proof for
     this feature alone, append an em-dash skip clause to the Killer Demo line
     above, in the form SCENARIOS.md documents. Never record it by editing the
     parent's "## Killer Demo" — that silences every sibling. -->

## Contribution

Make every planning stop or wait recoverable without reading code, including
stale reviews, fallback, work-type promotion, pending human design approval,
and pending user-owned scope or dispute decisions.

## Rules

<!-- Rules stay at h4 even without an h3 above them: scenario-coverage.ts reads
each `#### ` heading as a Rule/AC id, so demoting these to h3 would break child
lineage parsing to satisfy a cosmetic heading rule. -->
<!-- markdownlint-disable MD001 -->

#### plan-implementability.NTB1.K3EBHB.R7 — Every planning block gives one plain recovery action

#### plan-implementability.NTB1.K3EBHB.R8 — Stale review messages name the meaningful change and affected plan

#### plan-implementability.NTB1.K3EBHB.R9 — Promotion messages preserve evidence and name the resume phase

#### plan-implementability.NTB1.K3EBHB.R10 — Non-technical walkthroughs prove block, invalidation, fallback, promotion, pending human design-approval, and pending user-owned scope or dispute recovery messages at real boundaries

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
