# Dimensions: Go language pack (ZD70P1)

| Dimension          | Partitions                                                                                  | Source      |
| ------------------ | ------------------------------------------------------------------------------------------- | ----------- |
| Project shape      | single-repo (no workspaces) · go.work monorepo · JS-rooted monorepo containing a Go package | TB1, TB2    |
| Source layout      | Go layout (cmd/internal/pkg) · `src/` (JS/TS) · flat Go (only top-level .go, no recognized) | TB1.AC1     |
| Discovery source   | go.work `use` · package.json workspaces (JS) · none                                         | TB1.AC2     |
| go.work parse      | readable block/single-line `use` · one unreadable entry skipped, readable survive           | TB1.AC2     |
| Fingerprint input  | go.mod `require` set · package.json deps                                                    | TB2.AC1     |
| Regression surface | JS single-repo output · JS leaf output in a polyglot monorepo (must be unchanged)           | TB2.AC2/AC3 |

## Partition → scenario mapping

- single-repo × Go layout → TB1.AC1 (single module doc lists cmd/internal/pkg).
- go.work monorepo × Go layout → TB1.AC2 (root index + Go leaf doc).
- go.work monorepo × flat Go → TB1.AC1 honesty edge ("not introspected", no leaf).
- go.work × one unreadable entry → TB1.AC2 robustness (a readable sibling package
  is still introspected — proves the parser ran and skipped the bad entry, not the
  whole file; a pure-degrade "no leaves" assertion would pass vacuously today).
- JS-rooted monorepo × (src + Go layout) → TB2.AC2 (both introspected).
- single-repo × src → TB2.AC3 (JS module doc unchanged — regression guard).
- go.mod require add/remove → TB2.AC1, BLACK-BOX: the shape-fingerprint is written
  into the doc frontmatter and surfaced by `architecture --check`, so adding a
  require makes the doc go stale (`--check` reports it). A unit test pins the
  fingerprint composition beneath it. (Corrected from an earlier wrong "not
  observable in the rendered doc" claim — the scenario-gate review caught it.)

## Boundary notes

- **Extraction precedence:** `src/` wins when present (TS stays byte-identical);
  Go layout is read only when there is a `go.mod` and no `src/` tree.
- **Discovery precedence:** `package.json workspaces` ?? `pnpm-workspace.yaml` ??
  `go.work`. A JS-rooted monorepo containing a Go package still discovers the Go
  package because the keep-predicate is "has package.json OR go.mod".
- **Go identity:** leaf name = `go.mod` `module` directive, fallback directory
  basename (mirrors JS using package.json `name`).
- **Out of scope here:** inter-package Go edges (module-path→dir), both go.work and
  package.json workspaces at the repo root (JS wins — noted), go.mod `replace` /
  build tags / sub-modules, Rust and Python (separate WBM8JE slices).
