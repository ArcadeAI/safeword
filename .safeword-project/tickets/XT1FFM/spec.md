# Spec: Adopt slug.persona.AC.scenario numbering for traceability

## Intent

31W8M3 gave each Acceptance Criterion an id (`<slug>.<persona-code><JTBD#>.AC<#>`),
but scenarios still live under free-text headings with no machine-checkable link
to the AC they prove. This feature extends the id one rung down — each scenario's
name carries its full lineage (`…AC<#>.<scenario_name>`, snake_case) — and adds a
`safeword check` report so coverage gaps (an AC with no scenario, a scenario with
no AC) surface without a human cross-referencing by eye.

## References

- Parent epic: DZ2NM5; arcade pair QEKGBK (arcade's canonical scheme — kept snake-exact for fidelity).
- Depends on 31W8M3 (AC layer) — shipped; `parseAcsByJtbd` (hook-side) parses AC ids.
- Coverage report rides the existing `safeword check` advisory model (persona/glossary drift), not a hard gate (converged 2026-05-30).

## Personas

**Agent-Driven Developer (DEV)** — traces a failing or revisited scenario back to
the capability it proves, and learns at a glance whether every AC is covered.

## Vocabulary

**Scenario lineage** — the `<jtbd-id>.AC<#>.<scenario_name>` id that ties a
scenario to its AC, JTBD, and persona. (Project `glossary.md` is bootstrapped;
this term is feature-local.)

## Jobs To Be Done

### cross-reference-numbering.DEV1 — Trace a scenario to the capability it proves

**Persona:** Agent-Driven Developer (DEV)

> When a scenario fails or I revisit a feature's coverage, I want each scenario's
> name to carry the acceptance criterion it proves, so I can see at a glance which
> capability is at risk and whether every AC actually has a test behind it.

#### cross-reference-numbering.DEV1.AC1 — Each scenario name encodes its AC lineage in the `<jtbd-id>.AC<#>.<scenario_name>` scheme

#### cross-reference-numbering.DEV1.AC2 — `safeword check` reports every AC with no scenario and every scenario whose AC-reference matches no AC

## Outcomes

- A reader of `test-definitions.md` can map any scenario to its AC/JTBD/persona from the name alone.
- `safeword check` surfaces uncovered ACs and orphan scenarios as advisory findings, no eyeball cross-referencing required.
