# Feature Contribution: Keep plan reviews current and trustworthy

<!-- safeword:product-plan-contract:v1 -->

## Parent References

- **Parent:** 82T411
- **Milestone:** M2
- **Parent job:** plan-implementability.TBU4
- **Killer Demo:** inherited from the parent spec — skip: this child supports but does not own the cold-start execution moment

<!-- Inherited by reference; the child never restates it. To skip demo proof for
     this feature alone, append an em-dash skip clause to the Killer Demo line
     above, in the form SCENARIOS.md documents. Never record it by editing the
     parent's "## Killer Demo" — that silences every sibling. -->

## Contribution

Make both planning approvals trustworthy by binding semantic review to the
canonical contract, exact plan, complete context, and honestly recorded route.

## Rules

<!-- Rules stay at h4 even without an h3 above them: scenario-coverage.ts reads
each `#### ` heading as a Rule/AC id, so demoting these to h3 would break child
lineage parsing to satisfy a cosmetic heading rule. -->
<!-- markdownlint-disable MD001 -->

#### plan-implementability.TBU4.5F5ZZA.R1 — Shared clauses are authored once and generated into both contracts

#### plan-implementability.TBU4.5F5ZZA.R2 — Each review receives its complete phase context

#### plan-implementability.TBU4.5F5ZZA.R3 — Required context resolves or fails closed

#### plan-implementability.TBU4.5F5ZZA.R4 — Review provenance changes only for semantic dependencies

#### plan-implementability.TBU4.5F5ZZA.R5 — Contract identity binds exact canonical bytes

#### plan-implementability.TBU4.5F5ZZA.R6 — Review fallback is bounded and honestly labeled

#### plan-implementability.TBU4.5F5ZZA.R7 — Research and review context remain untrusted evidence

#### plan-implementability.TBU4.5F5ZZA.R8 — Ungated surfaces receive advisory guidance only

#### plan-implementability.TBU4.5F5ZZA.R9 — Review invalidation follows dependency direction

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
