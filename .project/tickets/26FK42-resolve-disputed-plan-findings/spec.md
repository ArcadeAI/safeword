# Feature Contribution: Resolve disputed plan findings without review loops

<!-- safeword:product-plan-contract:v1 -->

## Parent References

- **Parent:** 82T411
- **Milestone:** M2
- **Parent job:** plan-implementability.TBU5
- **Killer Demo:** inherited from the parent spec — skip: this child proves disputed-review termination rather than the complete cold-start planning payoff

## Contribution

> When a plan author and reviewer disagree about a finding, I want the
> disagreement recorded and its effect on progress made explicit, so optional
> advice does not delay work and unresolved correctness is never approved or
> silently retried.

## Rules

<!-- markdownlint-disable MD001 -->

#### plan-implementability.TBU5.26FK42.R1 — The originating reviewer cannot be the sole adjudicator of its disputed finding

#### plan-implementability.TBU5.26FK42.R2 — Scope changes route to the user, currency disputes resolve from bound provenance, and an author records its disagreement and supporting accepted requirement or plan text; nonblocking advice does not stop progress, while a disputed blocking correctness or relevance finding remains unresolved and cannot approve the plan

#### plan-implementability.TBU5.26FK42.R3 — When a reviewer disputes whether a finding is optional strengthening, the fresh adjudicator applies the nonblocking classification owned by 5F5ZZA; the dispute itself cannot make the finding blocking, and only user acceptance can change the accepted scope

#### plan-implementability.TBU5.26FK42.R4 — Headless and cloud work preserves current nonblocking human-approval behavior, records unresolved dispositions for later review, and never turns an unresolved correctness dispute into approval

#### plan-implementability.TBU5.26FK42.R5 — Each disputed finding has an explicit recorded disposition and recovery action: nonblocking advice may proceed, a user-owned scope decision may remain pending, and disputed blocking correctness stays unresolved until the plan or review basis is materially corrected and freshly reviewed; unchanged work is not silently redispatched, scope never expands silently, and no fixed correctness-pass cap is imposed

<!-- markdownlint-enable MD001 -->

## Surfaces

Affected:

- Safeword CLI
- Claude Code
- Claude Code Cloud
- OpenAI Codex
- OpenCode — skip: CLI, TUI and Desktop excluded from this work by user decision on 2026-11-14; follow-up #7491. General OpenCode support status is unchanged.
- Cursor
- Cursor Cloud Agents

Unaffected:

- Claude Code on the Web — no browser-entry-point behavior changes
- OpenAI Codex Cloud — repository instructions are advisory and cannot enforce the local phase gate
