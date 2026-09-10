# Feature Contribution: Make Safeword plans clear and reviewable

<!-- safeword:product-plan-contract:v1 -->

## Parent References

- **Parent:** 82T411
- **Milestone:** M1
- **Parent job:** plan-implementability.TBU4
- **Killer Demo:** inherited from the parent spec

<!-- Inherited by reference; the child never restates it. To skip demo proof for
     this feature alone, append an em-dash skip clause to the Killer Demo line
     above, in the form SCENARIOS.md documents. Never record it by editing the
     parent's "## Killer Demo" — that silences every sibling. -->

## Contribution

Give Safeword's plan authors and reviewers a shared writing standard, plus a
small plan-specific extension that tells them what belongs in each planning
artifact. This supports M1 by making the three plan contracts readable and
reviewable without duplicating their substantive phase rules.

## Rules

<!-- Rules stay at h4 even without an h3 above them: scenario-coverage.ts reads
each `#### ` heading as a Rule/AC id, so demoting these to h3 would break child
lineage parsing to satisfy a cosmetic heading rule. -->
<!-- markdownlint-disable MD001 -->

#### plan-implementability.TBU4.ZSHVEB.R1 — One shared technical-writing guide is the authoritative home for current truth, decision-first paragraphs, exact contracts, scannable structure, LLM writing and review, the deletion test, compact examples, and sources for load-bearing claims

#### plan-implementability.TBU4.ZSHVEB.R2 — One plan-writing extension explains the distinct ownership, required content, review question, and approval meaning of the Product Plan, Implementation Plan, and Execution Plan without restating their canonical phase contracts

#### plan-implementability.TBU4.ZSHVEB.R3 — Relevant technical-document authoring and review workflows load the shared guide, while workflows that author or review any of the three plans additionally load the plan extension

#### plan-implementability.TBU4.ZSHVEB.R4 — Shared rules have one authoritative home: the plan extension may reference the general guide, but the general guide does not reference the plan extension and the extension contains only plan-specific rules or explicit overrides

#### plan-implementability.TBU4.ZSHVEB.R5 — Both guides preserve compact examples and supporting sources while excluding project history, Arcade-specific ceremony, and project-specific implementation details

#### plan-implementability.TBU4.ZSHVEB.R6 — Generated and installed workflow copies preserve the authoritative guide content and references across affected Safeword authoring and review surfaces

<!-- markdownlint-enable MD001 -->

## Surfaces

Affected:

- Claude Code
- Claude Code Cloud
- OpenAI Codex
- OpenAI Codex Cloud
- OpenCode
- Cursor
- Cursor Cloud Agents
- Safeword CLI

<!-- Contexts this must keep working in (see paths.surfaces). Each Affected entry
needs a scenario tagged @surface.<slug> or an inline skip; Unaffected is
informational. These comment lines declare nothing until you fill them in.

Affected:
- Claude Code
- OpenAI Codex — skip: <why no scenario of its own>

Unaffected:
- Cursor — <why this work cannot reach it> -->
