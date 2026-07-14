# Dimensions: Audit checks namespace domain docs (N0W5KG)

| Dimension            | Partitions                                                                                          | Source   |
| -------------------- | --------------------------------------------------------------------------------------------------- | -------- |
| Doc kind             | personas.md · surfaces.md · glossary.md                                                              | TB1      |
| Doc state            | empty (zero `##` entries, scaffold only) · populated                                                | TB1.R3   |
| Reference status     | referenced-and-defined (clean) · referenced-but-undefined (drift) · defined-but-unreferenced (fine) | TB1.R1/R2 |
| Persona ref source   | ticket spec.md `**Persona:**` line (comment-stripped) — feature-tag source dropped (ticket-ID noise) | TB1.R2   |
| Content type         | structural/observable (surface slug, persona code) · human-curated prose (term meaning, description) | TB1.R4   |

## Partition → scenario mapping

- surfaces × referenced-but-undefined → **R1** (E008): `@surface.safeword-cli` tag in a `.feature`, no `## Safeword CLI` in surfaces.md.
- surfaces × referenced-and-defined → **R1 clean**: every `@surface.<slug>` resolves → no finding.
- personas × referenced-but-undefined × spec source → **R2** (E009): a spec `**Persona:** Foo (FOO)` with no `## … (FOO)` in personas.md.
- personas × referenced-but-undefined × feature source → **R2** (E009): a scenario names a persona code absent from personas.md.
- personas × referenced-and-defined → **R2 clean**: no finding.
- (any doc) × empty → **R3** (W008): zero `##` entries → warn + offer to fill from template, naming path + stake.
- (any doc) × populated → **R3 clean**: not reported empty.
- glossary × human-curated prose × plausibly-stale → **R4**: never an error; at most advisory warn.
- personas/surfaces × description prose × plausibly-stale → **R4**: never an error.

## Boundary notes

- **defined-but-unreferenced is NOT drift.** A surface/persona defined in the
  inventory but not yet referenced by any scenario is legitimate (inventory can
  lead usage) → no finding. Only referenced-but-undefined is the observable
  dead-ref.
- **Empty ≠ missing.** Install ships all three docs at scaffold state; the file
  is never absent. "Empty" = present with zero parsed `##` entries. The HTML
  comment scaffold does not count as an entry (mirrors DISCOVERY.md's rule).
- **Structure vs content boundary (R4).** Observable = a slug/code token that
  does or doesn't have a matching heading (deterministic by reading). Human
  judgment = whether a definition/description is still *accurate* — audit never
  adjudicates this; class-2 emits only observable facts.
- **Read-only.** The W008 fill offer names the template and the stake; it writes
  nothing during the audit pass (decided via /figure-it-out).
- Out of scope here: glossary term-drift heuristics, auto-drafting entries,
  gating/blocking, and any new CLI code (health.ts already validates structure).
