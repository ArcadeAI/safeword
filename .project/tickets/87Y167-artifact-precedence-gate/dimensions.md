# Dimensions: artifact-precedence-gate

Derived from spec.md (JTBD/ACs), the existing pre-tool-quality.ts chain, and the 0KYEBN gate's edge inventory.

| Dimension | Partitions |
| --- | --- |
| Gated write target | spec.md creation · dimensions.md creation · test-definitions.md creation · ticket.md phase-advance into implement · any other file (ungated) |
| Write kind | creation of a missing artifact (gated) · edit of an existing artifact (never gated) · payload with no reconstructable content (pass-through, G2 posture) |
| Ticket type | feature (gated) · task / patch / epic (exempt) · type absent or unparseable |
| Prerequisite state at write | all complete · earliest prerequisite missing · later prerequisite missing · multiple missing (earliest named) · present but incomplete (JTBD/AC gates fail) · satisfied via house `skip:` escape |
| Spec review stamp state (scenario authoring) | real stamp at current content · stamp at stale content (spec edited after review) · logged skip with reason · no stamp · reviewGate flag off (demand must still fire) / on (no double-demand) |
| Scenario review stamp state (implement entry) | real stamp at current content · stale (scenario source edited after review) · logged skip · no stamp · scenario source resolution: ledger names a `.feature` file vs ledger-only vs no scenario artifact yet |
| Phase-advance shape | forward into implement (gated) · forward into implement via phase_skips hatch (still gated; skip valve satisfies) · backward moves (free) · advances not targeting implement (not this gate) · phase unchanged (free) |
| Path scope | `<namespace-root>/tickets/**` (gated) · same filenames outside the namespace (ignored) |
| Denial content | earliest missing prerequisite named · forward next action stated · ordered-patch note where pre-edit-state applies (#385) |
