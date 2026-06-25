# Test Definitions: Go language pack (ZD70P1)

Feature source: `features/architecture-go-language-pack.feature`

test-definitions.md is the R/G/R ledger. The black-box `.feature` lane proves the
observable doc-coverage behaviors — including Go dependency drift, which IS
observable (the shape-fingerprint is written into the doc frontmatter and surfaced
by `architecture --check`'s exit code; the scenario-gate review corrected an earlier
wrong "not observable" claim). Fine-grained parser/extractor internals are pinned by
unit tests as a secondary layer, listed under "Unit-pinned" below.

## Rule: Go projects get real structural extraction and drift detection

### Scenario: A single-repo Go project produces a module doc from its Go layout

- [x] RED 8677fe9
- [x] GREEN 8677fe9
- [x] REFACTOR 8677fe9

### Scenario: A go.work monorepo produces a root index and per-package leaf docs

- [x] RED 8677fe9
- [x] GREEN 8677fe9
- [x] REFACTOR 8677fe9

### Scenario: A flat Go package with no recognized layout is marked, not introspected

- [x] RED 8677fe9
- [x] GREEN 8677fe9
- [x] REFACTOR 8677fe9

### Scenario: A go.work with an unreadable entry still introspects its readable packages

- [x] RED 8677fe9
- [x] GREEN 8677fe9
- [x] REFACTOR 8677fe9

### Scenario: Adding a Go dependency makes the architecture doc go stale

- [x] RED 8677fe9
- [x] GREEN 8677fe9
- [x] REFACTOR 8677fe9

## Rule: Polyglot repos introspect both languages without regressing JS

### Scenario: A mixed JS and Go monorepo introspects both packages

- [x] RED 8677fe9
- [x] GREEN 8677fe9
- [x] REFACTOR 8677fe9

### Scenario: A pure JS single-repo is unchanged by the Go extractor

- [x] RED 8677fe9
- [x] GREEN 8677fe9
- [x] REFACTOR 8677fe9

## Unit-pinned (secondary — fine-grained internals beneath the black-box scenarios)

- **TB2.AC1 fine-grain — fingerprint composition:** adding/removing a `require`
  module path in a `go.mod` changes `shapeFingerprint` for that directory while a
  JS package's fingerprint is untouched. (Black-box coverage: the "goes stale"
  scenario above.) `architecture-fingerprint.test.ts`.
- **detectGoWork parse:** block `use (...)`, single-line `use ./x`, comments, an
  unreadable directive skipped while readable entries survive, and a fully
  unreadable file → `undefined` (no workspaces). `architecture-monorepo.test.ts`.
- **extractSkeleton Go layout:** `go.mod` + `cmd`/`internal`/`pkg` → those modules;
  `src/` still wins when present (TS byte-identical); flat Go (no recognized dirs)
  → empty skeleton. `architecture-skeleton.test.ts`.
