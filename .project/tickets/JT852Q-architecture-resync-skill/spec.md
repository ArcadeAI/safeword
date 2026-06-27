# Spec: Architecture-doc prose persistence (JT852Q, layer A)

**Scope of this spec:** the deterministic prose-persistence engine change only.
Per-section prose in the generated docs survives heals; new nodes get the
placeholder; stamp-drift preserves prose but flags `⚠ stale`. No LLM (the
`/architecture` resync skill is deferred to RYKVR5).

## Intent

Today the generated architecture docs can never accumulate real description: the
deterministic self-heal rewrites every section's purpose to the placeholder on
every run (`extractSkeleton` hard-codes `PURPOSE_PLACEHOLDER`; `renderDocument`
renders it). Prose written by a human — or, later, by the LLM resync skill — is
clobbered at the next SessionStart or commit heal. This makes the doc a permanent
skeleton of placeholders. Prose persistence makes it a _living_ map: structure
still self-heals deterministically, but the narrative survives, so the doc can
grow real knowledge without a human re-writing it after every structural change.

## References

- Ticket JT852Q (resolved design: format evolution + parseSectionProse mechanism)
- Slice 1 (QD5DTT) — `selfHeal`, `renderDocument`, `parseSectionStamps`/`priorStamps`
  (the stamp-preservation pattern this mirrors), `PURPOSE_PLACEHOLDER`
- Slice 3 (XG9SFP) — leaf docs reuse `renderDocument`, so they inherit persistence
- RYKVR5 — the deferred LLM resync skill that writes prose into placeholder/stale
  sections; this ticket is its prerequisite

## Personas

- **Technical Builder (TB)** — curates the architecture doc across sessions and
  commits; harmed when every structural change resets the doc's descriptions to
  placeholders.
- **Non-Technical Builder (NTB)** — reads the doc to understand the system; a doc
  that is permanently placeholders tells them nothing.

## Vocabulary

- **Prose** — the per-section narrative (the module's purpose / "what it is for"),
  the human/LLM-owned block under a section's machine-owned heading, reconciled
  marker, and `` `path` `` code-reference.
- **Prose region** — the section body after the `` `path` `` line, excluding the
  reconciled marker and the `⚠ stale`/`⚠ orphaned` markers. This is what persists.
- **Placeholder** — `PURPOSE_PLACEHOLDER` ("No description yet — awaiting prose."),
  the prose a brand-new section is born with.
- **Round-trip** — heal of a doc whose structure is unchanged returns `unchanged`
  and leaves the prose byte-identical (parse/render are exact inverses).

## Jobs To Be Done

### architecture-resync-skill.TB1 — Keep the doc's descriptions across structural change

**Persona:** Technical Builder (TB)

> When I write a description of a module into the architecture doc and later the
> structure changes, I want my description preserved (and flagged if it may now
> lag), so the doc accumulates knowledge instead of resetting to placeholders.

#### architecture-resync-skill.TB1.AC1 — Prose survives a heal unchanged

A doc whose structure is unchanged heals to `unchanged`, with every section's
prose byte-identical — the heal is a no-op round-trip, never a prose reset.

#### architecture-resync-skill.TB1.AC2 — A new module is born with the placeholder

When a module is added, its new section carries the placeholder prose (awaiting
description); existing sections keep their prose.

#### architecture-resync-skill.TB1.AC3 — A structural change preserves prose but flags it stale

When the shape fingerprint moves, an existing section's prose is preserved
verbatim and marked `⚠ stale` (lagging, not lost) — never silently dropped and
never silently presented as current.

### architecture-resync-skill.NTB1 — Read a doc that actually describes the system

**Persona:** Non-Technical Builder (NTB)

> When I open the architecture doc to understand the system, I want it to show the
> descriptions that were written, not a wall of placeholders, so it is worth reading.

#### architecture-resync-skill.NTB1.AC1 — Written prose is what the doc shows

A section that has been given a real description renders that description (not the
placeholder) on every subsequent heal, including in monorepo leaf docs.

## Outcomes

- A generated doc given real per-section descriptions keeps them across
  SessionStart and commit heals; only brand-new sections show the placeholder.
- A structural change preserves existing prose and flags the affected section
  `⚠ stale` rather than resetting it.
- Single-repo and monorepo leaf docs both persist prose; the derived root index
  (no per-node prose) is unaffected.
- The heal is an exact round-trip: an unchanged doc with prose heals to
  `unchanged`, so enforcement `--check` does not churn.

## Open Questions

- none — format evolution + `parseSectionProse` mechanism resolved at intake
  (`/figure-it-out`); the round-trip property is the first define-behavior scenario.
