# Feature Contribution: Resolve disputed plan findings without review loops

<!-- safeword:product-plan-contract:v1 -->

## Parent References

- **Parent:** 82T411
- **Milestone:** M2
- **Parent job:** plan-implementability.TBU5
- **Killer Demo:** inherited from the parent spec — skip: this child proves disputed-review termination rather than the complete cold-start planning payoff

## Contribution

> When a plan author and reviewer disagree about a finding, I want the dispute
> routed to an authority that did not create it, so work reaches an honest
> per-finding terminal result without reviewer-owned scope or silent
> redispatch.

## Rules

<!-- markdownlint-disable MD001 -->

#### plan-implementability.TBU5.26FK42.R1 — The originating reviewer cannot be the sole adjudicator of its disputed finding

#### plan-implementability.TBU5.26FK42.R2 — Scope and optional-strengthening disputes route to the user, currency disputes resolve from bound provenance, and correctness or relevance disputes route to a fresh adjudicator applying the accepted contract and scope

#### plan-implementability.TBU5.26FK42.R3 — When a reviewer disputes whether a finding is optional strengthening, the fresh adjudicator applies the nonblocking classification owned by 5F5ZZA; the dispute itself cannot make the finding blocking, and only user acceptance can change the accepted scope

#### plan-implementability.TBU5.26FK42.R4 — Headless and cloud work preserves current nonblocking human-approval behavior, records unresolved dispositions for later review, and never turns an unresolved correctness dispute into approval

#### plan-implementability.TBU5.26FK42.R5 — Every dispute reaches an honest typed result without a fixed correctness-pass cap, reviewer-owned scope, or silent retry loop

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
