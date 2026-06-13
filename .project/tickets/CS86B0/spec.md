# Spec: Emit native vitest test skeletons from test-definitions.md (`safeword codify`)

## Intent

A ticket's `test-definitions.md` already enumerates every scenario with R/G/R
checkboxes — the "N tests to make pass" denominator exists on paper. What's
missing is the one-shot bridge from that prose to runnable test stubs: today the
DEV hand-types each `it()` during its RED phase. `safeword codify <ticket>` reads
the scenarios and emits a native vitest `*.test.ts` skeleton — one test per
scenario, grouped by rule, lineage-named, Given/When/Then preserved as comments —
so a DEV who prefers arcade's front-loaded style can stand up the whole board in
one command. Optional and additive: the interleaved one-test-at-a-time flow is
unchanged.

## References

- Parent epic: 0AWSY8 (absorb arcade Phase 1). Arcade pair: JN39KG (decommission of `/codify-spec`).
- Decision (`/figure-it-out`, 2026-06-06): emit **native vitest skeletons, no Gherkin** — the only TS path that keeps vitest's native reporter/watch with zero new deps. Full rationale in `ticket.md` → Replan.
- **Refinement (this spec):** group each `describe(...)` by its **`## Rule:` heading text**, not by `<jtbd-id>.AC#`. Rules already group scenarios by the AC they prove (SCENARIOS.md define-behavior step 4), so the rule heading is the human-readable AC label; grouping by it mirrors the file's own structure, needs no free-text fallback, and keeps full lineage traceable via each `it()` name. Reversible/local — recorded here, no ADR.
- Reuses existing pure parser primitives: `computeSkipMask` (`markdown-sections.ts`, comment/fence skip) and `parseAcReferenceFromTitle` (`scenario-coverage.ts`). No new parsing framework.

## Personas

**Agent-Driven Developer (DEV)** — drives the BDD flow on a real project; after
the scenario-gate, wants a runnable test board scaffolded from the scenarios so
"3/12 passing" is visible from the first implement step.

## Vocabulary

**Test skeleton** — a generated `*.test.ts` whose tests have no bodies yet:
`it.todo(...)` pending markers by default, or `it(..., () => { throw … })`
failing bodies under `--red`. The DEV fills bodies in during implementation.

**Pending vs RED** — `it.todo` keeps the suite green (a pending inventory,
reconciling with safeword's commit-on-GREEN discipline); `--red` makes every stub
fail for a true-RED "make them pass" board. (`it.fails` is wrong — green-while-broken since vitest 4.1.)

## Jobs To Be Done

### codify.DEV1 — Scaffold every scenario into a runnable test board in one shot

**Persona:** Agent-Driven Developer (DEV)

> When I finish defining and gating a ticket's scenarios, I want to generate the
> whole vitest test file at once — one stub per scenario, traceable to its AC —
> so I can see a concrete "N tests to make pass" board before I start
> implementing, instead of hand-typing each test during its RED phase.

#### codify.DEV1.AC1 — Each scenario becomes exactly one test, grouped under its rule, lineage-named, with Given/When/Then preserved as comments

#### codify.DEV1.AC2 — Stubs are pending (`it.todo`) by default to keep the suite green; `--red` emits failing bodies for a true-RED board

#### codify.DEV1.AC3 — The skeleton prints to stdout by default; `--out <path>` writes a file but refuses to overwrite an existing one; missing or scenario-less input fails with a clear message

## Outcomes

- A DEV runs `safeword codify <ticket>` and gets a valid vitest file whose test count equals the scenario count, each test traceable to its AC by name.
- The default skeleton is committable as-is (green pending board); `--red` gives a failing board to drive implementation against.
- `--out` never silently clobbers a partially-filled test file; bad input never produces an empty/invalid test file.

## Open Questions

_None — the figure-it-out verdict resolved scope; the describe-grouping refinement is recorded under References above._
