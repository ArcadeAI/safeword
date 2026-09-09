# Feature Contribution: Split large contributions into independently reviewable PRs

<!-- safeword:product-plan-contract:v1 -->

## Parent References

- **Parent:** 82T411
- **Milestone:** M1
- **Parent job:** plan-implementability.TBU2
- **Killer Demo:** inherited from the parent spec — skip: this child proves reviewable delivery slices rather than the complete cold-start execution payoff

## Contribution

> When an accepted feature is too large for one useful code review, I want its
> Execution Plan divided into coherent, dependency-ordered pull requests, so
> each change can be understood, verified, and merged without reconstructing
> the entire implementation or inventing a design decision.

## Rules

<!-- markdownlint-disable MD001 -->

#### plan-implementability.TBU2.6XW8H7.R1 — Execution Planning explicitly decides whether a large contribution needs multiple pull requests

#### plan-implementability.TBU2.6XW8H7.R2 — Each planned pull request has one coherent purpose, boundary, prerequisite set, proof obligation, and completion signal

#### plan-implementability.TBU2.6XW8H7.R3 — Pull-request dependencies are ordered explicitly and every merge leaves the repository in a safe supported state

#### plan-implementability.TBU2.6XW8H7.R4 — Reviewable size is judged by conceptual scope and independent proof rather than line or file count alone

#### plan-implementability.TBU2.6XW8H7.R5 — PR slicing preserves every accepted behavior, migration, rollout, rollback, documentation, and affected-surface obligation without reopening the approach

<!-- markdownlint-enable MD001 -->

## Surfaces

Affected:

- Claude Code
- OpenAI Codex
- OpenCode — profile catalogue only; Desktop remains advisory until native hook support exists
- Cursor

Unaffected:

- Safeword CLI — PR slicing is authored through host planning guidance rather than a standalone CLI command
- Claude Code Cloud — project instructions are advisory; no new cloud lifecycle enforcement is introduced
- OpenAI Codex Cloud — repository instructions are advisory; no local planning gate is available
- Cursor Cloud Agents — project instructions are advisory; no new cloud lifecycle enforcement is introduced
