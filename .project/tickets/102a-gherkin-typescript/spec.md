# Spec: Executable Gherkin — cucumber-js foundation (102a)

## Intent

Safeword orchestrates BDD but never executes the specs it produces — Given/When/Then lives as Markdown in `test-definitions.md`, hand-translated into vitest. This slice makes Gherkin **executable** in safeword's own repo: a generator (`safeword codify --format gherkin`) that turns a ticket's scenarios into a `.feature` file, and a runner (cucumber-js — the acceptance layer alongside vitest) that runs `.feature` files, proven by one dogfood feature. It's the foundation the rest of epic 102 (and the arcade merge) builds on. The larger bdd-flow change — making `.feature` the scenario source of truth — is deliberately a later slice.

## References

- Parent: epic **102** (under Phase 1 / 0AWSY8). Runner decided **cucumber-js**, all-TypeScript (102's Replan 2026-06-09).
- Seed: **CS86B0** `safeword codify` (pure emitter + CLI). This slice adds a Gherkin renderer beside the vitest one.
- cucumber-js v13: a **separate runner** from vitest; TS/ESM via the `tsx` loader (not ts-node — path-alias bug); config `{ import: ['tsx/esm', 'features/steps/**/*.ts'], paths: ['features/**/*.feature'] }`.
- Grounded in arcade-monorepo's real `.feature` tag taxonomy (`@spec:`/`@B-`); safeword derives `@`-tags from its `<jtbd>.AC#` lineage.

## Personas

**Agent-Driven Developer (DEV)** — runs safeword's BDD flow; wants scenarios to become runnable acceptance tests instead of hand-copied vitest.

**Safeword Maintainer (SM)** — builds safeword; wants safeword's own repo to execute `.feature` tests (dogfood the capability it will ship to customers).

## Vocabulary

**Acceptance layer** — the human-readable `.feature` tests run by cucumber-js, distinct from the fast unit/integration tests that stay in vitest. Two runners, different jobs.

**Lineage tag** — the `<jtbd>.AC#` id emitted as a Gherkin `@tag`, so a scenario traces to its AC (mirrors arcade's `@spec:`/`@B-`).

## Jobs To Be Done

### gherkin-typescript.DEV1 — Generate a runnable `.feature` from my scenarios

**Persona:** Agent-Driven Developer (DEV)

> When I've defined a ticket's scenarios, I want to generate a Gherkin `.feature` from them, so my specs are executable acceptance tests instead of Markdown I hand-translate into vitest.

#### gherkin-typescript.DEV1.AC1 — `codify --format gherkin` renders each scenario as a Gherkin `Scenario` under a `Feature`, with Given/When/Then steps and the lineage as a `@tag`

#### gherkin-typescript.DEV1.AC2 — Gherkin is opt-in: `--format gherkin` emits Gherkin; without it `codify` still emits native vitest (additive, backward-compatible)

### gherkin-typescript.SM1 — Run `.feature` acceptance tests in safeword's own repo

**Persona:** Safeword Maintainer (SM)

> When I add the Gherkin capability, I want safeword's own repo to execute `.feature` files through cucumber-js, so I'm dogfooding what I'll scaffold for customers — and the existing vitest unit suite stays untouched.

#### gherkin-typescript.SM1.AC1 — cucumber-js is wired (config + `test:bdd` script) and a dogfood `.feature` runs green via cucumber-js, separate from the vitest `test` script

## Outcomes

- A DEV runs `safeword codify --format gherkin <ticket>` and gets a valid `.feature` whose scenarios match the ticket's, tagged with their AC lineage.
- `bun run test:bdd` executes `.feature` files (the dogfood feature passes); `bun run test` (vitest) is unchanged.
- The foundation exists for the next slice (`.feature` as scenario source) and for scaffolding cucumber-js into customer/arcade projects.

## Open Questions

_None — figure-it-out resolved the runner (cucumber-js), the format-flag (additive), and the slice boundary (foundation-only). The bdd-flow change is explicitly out of scope (a later slice)._
