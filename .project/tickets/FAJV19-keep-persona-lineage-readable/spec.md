# Spec: Keep persona lineage readable for builders

## Intent

Make persona lineage recognizable at a glance without turning upgrades into a
breaking identifier migration. New persona codes should carry enough mnemonic
signal to distinguish roles while existing codes continue to resolve.

## Intake Brief

- **Requested by:** Project owner, after reviewing personas.md and the Gherkin lineage it produces.
- **Cost of inaction:** Two-letter defaults remain ambiguous and collision-prone as persona inventories grow; generated lineage stays harder to scan than necessary.
- **Reversibility:** Cross-cutting public-format change. Generation is reversible, but rewriting persisted lineage is not, so legacy codes remain compatible and historical IDs stay untouched.

## References

- `personas-file (7YN5QB)` — introduced the current 2–6 character code model.
- `persona-gate-code-derivation (G9BXE9)` — mirrors derivation in installed hooks.
- Cucumber tags carry lineage from JTBD Rules into executable scenarios.

## Personas

- Technical Builder (TBU)
- Safeword Maintainer (SWM)

## Surfaces

Affected:

- Claude Code
- OpenAI Codex
- Cursor

Unaffected:

- Runtime application behavior — persona codes shape planning artifacts and installed guidance, not generated application code.

## Vocabulary

- **Automatic code:** The 3–4 letter code safeword derives for a persona without an override.
- **Explicit code:** A builder-chosen 2–4 letter code carried into new lineage unchanged.
- **Legacy code:** A persisted 5–6 character code accepted for compatibility but not recommended for new personas.

## Jobs To Be Done

### keep-persona-lineage-readable.TBU1 — Recognize who a requirement serves

**Persona:** Technical Builder (TBU)

> When I read or author a persona-backed requirement, I want its short code to
> be mnemonic and stable, so I can follow the same persona through JTBDs and
> executable Gherkin without decoding an ambiguous two-letter token.

#### keep-persona-lineage-readable.TBU1.R1 — Newly derived persona codes are canonical 3–4 letter identifiers

#### keep-persona-lineage-readable.TBU1.R2 — Existing explicit persona codes remain valid lineage anchors

### keep-persona-lineage-readable.SWM1 — Maintain one lineage convention across runtimes

**Persona:** Safeword Maintainer (SWM)

> When I change persona-code authoring, I want the CLI, installed hooks, and BDD
> guidance to agree, so every supported agent produces the same requirement and
> Gherkin lineage.

#### keep-persona-lineage-readable.SWM1.R1 — One resolved code flows unchanged from personas.md through JTBD and Gherkin lineage

## Rave Moment

skip: table-stakes — identifier readability is important maintenance hygiene,
not a standalone delight moment.

## Outcomes

- New persona names resolve to predictable 3–4 letter codes.
- Builders can choose a natural 2–4 letter acronym explicitly.
- Existing explicit codes continue to pass checks and resolve in old specs.
- Examples show the same code in the persona header, JTBD ID, Rule ID, and Gherkin tag.
- Supported agent runtimes receive identical authoring guidance.

## Open Questions

None.
