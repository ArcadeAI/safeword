---
id: '102'
slug: gherkin-executable-specs
title: 'Epic: Executable Gherkin specifications'
type: Epic
status: in_progress
priority: high
parent: '0AWSY8'
epic: bdd-phase-one-merge
children: ['102a', '102b']
---

# Epic: Executable Gherkin Specifications

SafeWord orchestrates BDD but has no executable specs — internally or for customers. This epic adds real Gherkin execution, all in TypeScript.

## Replan — 2026-06-09 (folded into Phase 1; cucumber-js; all-TypeScript)

**Folded into Phase 1 (0AWSY8).** Executable Gherkin is core BDD absorption, not a side track — it's the merge requirement that lets arcade-monorepo adopt safeword. `parent: 0AWSY8`; Phase 1 no longer closes until 102a + 102b ship.

**Runner: cucumber-js (reverses the QuickPickle choice in the children below).** Decided after a live-docs deep-dive: cucumber-js wins on the three axes that matter for a cross-team, customer-facing harness — org-maintained (no solo-maintainer bus factor), native Cucumber JSON/HTML reporting (the living-documentation payoff QuickPickle lacks — vitest-reports only), and the same Cucumber family as arcade's pytest-bdd (shared tag canon + report format + mental model). Accepted cost: a **separate acceptance-test runner** alongside vitest — reframed as the normal two-layer split (fast units in vitest; human-readable `.feature` acceptance tests in cucumber-js). QuickPickle's only edge (single-runner DX in safeword's own repo) doesn't serve the merge and doesn't travel to customers.

**All TypeScript (102c cancelled).** Step defs are uniformly TypeScript. Non-TS apps stay covered by TS step defs that shell out or hit HTTP (102b). Native-language step defs (godog/pytest-bdd/cucumber-rs) are dropped — see cancelled 102c.

**CS86B0 is the seed — not a from-scratch build.** Safeword already shipped `safeword codify` (a pure emitter + CLI turning `test-definitions.md` into native vitest). 102a **retargets that emitter** to emit `.feature` files + cucumber-js step stubs instead — same parse/emit architecture, different output.

**Grounded in arcade's real usage.** arcade-monorepo already authors tagged `.feature` files (`tests/behaviors/<service>/<spec>.feature`) with a tag taxonomy `@service:` / `@spec:<id>` / `@B-<behavior-id>` / `@smoke`/`@fast` and persona-driven Scenario Outlines hitting HTTP — but **has not wired a runner yet**, so building cucumber-js is greenfield for both. Safeword should adopt arcade's tag taxonomy (derive `@spec:`/`@B-` from its existing `<jtbd>.AC#` lineage; drop `@service:` — single-package).

The QuickPickle-specific sections further below (file structure, install steps) are **historical design context** — the concrete cucumber-js architecture is set per-child at intake + `/figure-it-out`.

## Children

| Ticket   | Scope                          | Step defs  | Runner                          |
| -------- | ------------------------------ | ---------- | ------------------------------- |
| **102a** | TypeScript projects + safeword | TypeScript | **cucumber-js**                 |
| **102b** | Non-TS apps (shell-out / HTTP) | TypeScript | **cucumber-js**                 |
| ~~102c~~ | ~~Customer native-lang steps~~ | ~~native~~ | _cancelled 2026-06-09 (all-TS)_ |

## Progression

**102a** delivers full value for TypeScript projects — SafeWord's own tests and TS customer projects. Same runner, same config, no compromises.

**102b** extends to Go, Rust, Python projects. Step definitions are still TypeScript but shell out to native tooling (`go test`, `cargo test`). Tradeoff: JS tooling in a non-JS repo. Acceptable because SafeWord already requires Node/Bun.

**102c** eliminates that tradeoff. Customers configure `gherkin.stepLanguage` in `.safeword.yml` to write step defs in their project's language. Useful for polyglot repos where a team wants to standardize on one language regardless of project mix.

## Shared Architecture (all tickets)

- `.feature` files are the single source of truth for behavioral scenarios (replaces Given/When/Then in test-definitions.md)
- Gherkin at the **acceptance layer only** — unit/integration tests stay in native frameworks
- Domain-grouped step definitions, thin shared core, grow organically
- Re-evaluate QuickPickle at implementation time (50 stars, solo maintainer as of 2026-04 — architecture is runner-agnostic)

## Status — 2026-06-09

- **102a — done** (commit 12f59d77): safeword's own repo now emits **and** runs Gherkin — `safeword codify --format gherkin` (additive renderer beside the vitest one) + a cucumber-js acceptance lane (`test:bdd`) + a dogfood `.feature`. Full `/verify` (2548 pass) + `/audit` clean. The runner-agnostic "re-evaluate QuickPickle" note above resolved → **cucumber-js** (see the Replan at top).
- **102b** — backlog: non-TS apps via TS step defs; 102a's foundation (runner + step-def pattern) is now in place.
- **102c** — cancelled (all-TS).
- Epic stays `in_progress` until 102b ships. The QuickPickle-specific sections above are the superseded original plan.
