# Dimensions: Architecture-doc prose persistence (JT852Q, layer A)

| Dimension         | Partitions (equivalence classes + boundaries)                                       | Source                    |
| ----------------- | ----------------------------------------------------------------------------------- | ------------------------- |
| Section lifecycle | existing-with-prose · brand-new · removed (orphan)                                  | TB1.AC1/AC2/AC3           |
| Heal trigger      | structure unchanged (round-trip) · structure moved (fingerprint drift)              | round-trip vs stale (TB1) |
| Prose content     | placeholder (default) · real written prose · multi-paragraph prose (forward-compat) | NTB1.AC1, premortem       |
| Doc topology      | single-repo doc · monorepo leaf doc · monorepo root index (no per-node prose)       | XG9SFP reuse (NTB1.AC1)   |
| Idempotency       | heal once vs heal twice (parse/render fixed point)                                  | premortem (round-trip)    |

## Partition → scenario mapping

- **existing-with-prose × unchanged** → TB1.AC1 round-trip: prose byte-identical, action `unchanged`.
- **heal twice (idempotency)** → TB1.AC1 boundary: second heal also `unchanged` (parse/render are inverses).
- **brand-new × moved** → TB1.AC2: new section gets the placeholder; existing sections keep prose.
- **existing-with-prose × moved** → TB1.AC3: prose preserved verbatim + `⚠ stale` marker.
- **real prose rendered (not placeholder)** → NTB1.AC1 single-repo.
- **monorepo leaf persists prose** → NTB1.AC1 leaf topology.
- **root index unaffected** → NTB1.AC1 boundary: root index has no per-node prose, untouched.
- **multi-paragraph prose** → forward-compat boundary: a paragraph survives a heal intact (proves the prose region isn't one-line-capped).

## Boundary notes

- **Round-trip is the load-bearing property** (premortem): heal must be a fixed
  point on an unchanged doc, else `--check` churns forever. Tested explicitly +
  via heal-twice.
- **Placeholder vs written**: a section whose prose IS the placeholder stays
  placeholder (idempotent); only a real description is what NTB1 cares about.
- **Orphan** sections carry no prose (the module is gone) — orphan marker only,
  no prose to preserve. Reuses existing Slice-1 behavior; not a new scenario.
