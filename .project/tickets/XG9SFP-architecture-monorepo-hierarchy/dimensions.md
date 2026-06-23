# Dimensions: Architecture monorepo hierarchy (Slice 3)

| Dimension               | Partitions (equivalence classes + boundaries)                                                         | Source                         |
| ----------------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------ |
| Project topology        | single-repo (no workspaces) · monorepo (workspaces present)                                           | regression guard (TB2.AC3)     |
| Node type               | root index · leaf with `src/` · leaf with no modules (noop) · foreign (unowned) doc                   | topology (NTB1/TB1)            |
| Change locus            | one leaf's `src/` · package set (add/remove pkg) · inter-package edge · shared boundary config · none | fingerprint boundary (TB2.AC1) |
| Enforcement surface     | self-heal (session) · `--check` (exit code) · `--stage` (git index)                                   | Slice-2 fan-out (TB2.AC2)      |
| Fingerprint attribution | leaf src/manifest/schema → leaf only · package set + edges + boundary config → root only              | premortem pin (TB2.AC1)        |

## Partition → scenario mapping

- monorepo × root index → NTB1.AC1 (lists packages + purposes + edges).
- monorepo × add package → NTB1.AC2 (root updates, no hand-edit).
- leaf with src → TB1.AC1 (colocated, independently fingerprinted).
- leaf no modules → TB1.AC2 (root entry, noop leaf).
- change one leaf → TB1.AC3 (only that leaf re-syncs; others untouched).
- fingerprint attribution → TB2.AC1 (boundary/package-set moves root not leaves; leaf src moves leaf not root).
- enforcement fan-out → TB2.AC2 (--check fails if any stale / passes if all fresh; --stage stages every changed).
- single-repo → TB2.AC3 (byte-identical, no root index / no leaves).

## Boundary notes

- **noop per-leaf** is the reused CTAZT5 rule: a package with no `src/` modules →
  empty skeleton → no leaf doc, but a root-index entry. The boundary between
  "leaf emitted" and "leaf noop".
- **Root noop** only when there are zero workspace packages at all (a monorepo
  with packages but none having `src/` still emits a root index listing them).
- **Incremental boundary:** unchanged leaves return `unchanged` (no rewrite);
  the assertion is "other leaves untouched" on a single-leaf change.
- **Single-repo regression** is the load-bearing guard — exercised explicitly so
  the heal-target generalization can't drift the one-doc path.
