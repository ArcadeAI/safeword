# Impl Plan: Go language pack (ZD70P1)

Outside-in TDD. Three production seams + a black-box step file. Order is chosen so
the keystone (extraction) lands first and immediately turns single-repo Go scenarios
green, then discovery wires the monorepo, then fingerprint closes drift.

## Production changes (by axis)

### Axis 2 — Extraction (keystone): `architecture-skeleton.ts`

- `extractSkeleton(dir)`: keep the `src/` branch FIRST and unchanged (TS byte-identical).
  When `src/` is absent/empty AND `dir/go.mod` exists, enumerate the recognized Go
  layout dirs that are present — `cmd`, `internal`, `pkg` — as nodes, each
  `path: "<name>"`, sorted, placeholder purpose. Flat Go (none present) → `{nodes: []}`
  (stays "not introspected").
- Node `path` for Go is the bare dir name (no `src/` prefix); the renderer just
  prints it in a code span, so this is fine and platform-stable.

### Axis 1 — Discovery: `architecture-monorepo.ts`

- `detectGoWork(projectDirectory)`: dependency-free parse of `go.work`, mirroring
  `detectPnpmWorkspaces`. Collect `use` targets from both the block form
  `use (\n  ./a\n  ./b\n)` and single-line `use ./a`. Skip blanks, comments (`//`),
  and any entry that isn't a clean relative path (the "unreadable entry" is skipped,
  not fatal). Return the relative dirs, or `undefined` when no `use` target parses.
- `discoverLeafDirectories`: extend the source chain to
  `detectWorkspaces(...) ?? detectPnpmWorkspaces(...) ?? detectGoWork(...)`.
- Generalize the keep-predicate: keep a globbed dir if it has `package.json` OR
  `go.mod` (extract a `hasRecognizedManifest(dir)` helper). go.work `use` targets are
  exact dirs (not globs), but route them through the same glob/keep path for one
  code path — `globSync` on a literal relative path returns it.
- `packageName(dir)`: if no package.json name, and `go.mod` exists, read its `module`
  directive (first `module <path>` line); fallback basename. Keep JS path first.

### Axis 3 — Fingerprint: `architecture-fingerprint.ts`

- `readDependencyNames(dir)`: union the existing package.json dep names with
  `readGoModRequires(dir)` — the module paths from `go.mod`'s `require` block (both
  the `require (\n  path v1\n)` block and single-line `require path v1`), keys only,
  versions excluded. So a require add/remove moves `shapeFingerprint`. JS-only dirs
  are unaffected (no go.mod → empty Go set).

## Test changes

### Unit (RED→GREEN per axis, fast)

- `architecture-skeleton.test.ts`: Go layout extraction; src/ precedence; flat Go → empty.
- `architecture-monorepo.test.ts`: detectGoWork block + single-line + skip-bad-entry
  - no-use → undefined; discovery via go.work; mixed keep-predicate.
- `architecture-fingerprint.test.ts`: go.mod require add/removes the fingerprint;
  JS fingerprint untouched.

### Black-box BDD: `steps/architecture-go-language-pack.steps.ts`

- **Helper sharing (avoid jscpd clones with ZRW21K's steps):** the dir/rootDoc/
  leafDocExists/packageSection/writeJson helpers are near-identical to
  `steps/monorepo-coverage-honesty.steps.ts`. Extract them to
  `steps/support/architecture-fixtures.ts` and import from BOTH step files (refactor
  ZRW21K's file to import too — behavior-preserving, keeps the audit's 0-clone bar).
- Reuse the shared `When 'safeword generates the architecture doc'` and the generic
  Thens (`a root index lists the package`, `has its own colocated leaf doc`,
  `is marked "..." in the root index`, `line does not show the "..." placeholder`,
  `single-repo module doc`, `the command succeeds`) — do NOT redefine (cucumber
  global registry → duplicate-step error).
- New Go Givens (write go.mod/go.work/cmd/internal/pkg fixtures); new Thens
  `the doc lists the module "<name>"`, `safeword reports the architecture doc is stale`;
  new Whens `a require is added to its go.mod`, `safeword checks the architecture doc`
  (runs `architecture --check`, captures exit).
- **Scenario-4 fixture (review note):** a valid `use ./svc` PLUS one junk line the
  parser skips — proves partial-skip, not total-degrade.

## Known deviations

- `detectWorkspaces` (the sync-config truth source) stays untouched; go.work plugs in
  via the `??` chain in `discoverLeafDirectories` only — same scope guard ZRW21K used
  for pnpm.
- Out of scope (ticket.md): inter-package Go edges, both-config-at-root polyglot,
  go.mod replace / build tags / sub-modules, Rust/Python.
