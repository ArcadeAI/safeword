# Test definitions (R/G/R ledger) — MGWZ4P

Behavior: `discoverLeafDirectories` unions cross-ecosystem workspace managers
(JS-precedence within JS, then union go.work + Cargo + uv), so a polyglot
monorepo's every package is discovered. Black-box scenarios in
`features/architecture-polyglot-monorepo.feature`; precision in
`tests/utils/architecture-monorepo.test.ts`. Dimensions in dimensions.md.

## Black-box scenarios (acceptance lane)

- [x] **AC1 — JS + Go union** (`architecture-polyglot-monorepo.MGWZ4P.AC1`) [J1.AC1, D1(d)]
  - RED: root index lists `web` but NOT `gosvc` ("root index does not list gosvc"). Confirmed RED.
  - GREEN: union → root index lists both `web` and `gosvc`.
- [x] **AC2 — Go + Rust + Python union, no JS** (`architecture-polyglot-monorepo.MGWZ4P.AC2`) [J1.AC1, D1(e)]
  - RED: lists `gosvc` (first manager) but NOT `rscore`/`pytool`. Confirmed RED.
  - GREEN: union → lists `gosvc`, `rscore`, `pytool`.

## Unit tests (discovery precision — tests/utils/architecture-monorepo.test.ts)

- [x] **U1 — JS + go.work union** [J1.AC1, D1(d)]: package.json workspaces (`packages/web`) + go.work (`./svc` with go.mod) → both dirs discovered.
  - RED: only `packages/web` (first-match). GREEN: both.
- [x] **U2 — Go + Cargo + uv union (no JS)** [J1.AC1, D1(e)]: go.work + Cargo `[workspace]` + uv `[tool.uv.workspace]` → all three member dirs discovered.
  - RED: only the go.work members. GREEN: all three.
- [x] **U3 — JS precedence preserved** [J1.AC2, D2(c)]: package.json workspaces (`packages/*`) + pnpm-workspace.yaml (`apps/*`), different dirs → only the package.json side; pnpm's `apps/*` NOT unioned in. Must stay GREEN.
- [x] **U4 — same-dir dedupe** [J1.AC3, D3(b)]: a single member dir matched by two managers (a maturin dir under both a Cargo `[workspace]` and a uv workspace glob) appears once.
  - GREEN: length 1, not 2.
- [x] **U5 — no-regression** [J1.AC4, D1(b),(c)]: a single-manager monorepo (go.work only) and a single-repo project (no workspace config) return exactly today's result. Stays GREEN.
- [x] **U6 — all managers compose** [J1.AC1, D1(f)] (scenario-gate finding #1): JS `workspaces` + go.work + Cargo `[workspace]` + uv `[tool.uv.workspace]` ALL at the root → all four ecosystems' leaves discovered. The partition where JS-precedence and cross-ecosystem union compose; pins the "any mix of the five" done_when.
  - RED: only the JS side (first-match). GREEN: all four.
- [x] **U7 — over-broad glob attributes once** [J1.AC3, D3(b)] (scenario-gate finding #2): a Cargo `members=["*"]` whose glob also sweeps a JS `packages/web` dir → `web` is listed exactly once (the `Set` + per-leaf `hasRecognizedManifest` keep the blast radius contained; a dir is a leaf if any manager's glob matches it and it has a recognized manifest — surfaced once regardless of which manager claimed it).

## Reconcile note

Coverage honesty (no silent drop) is the union of U1/U2 + AC1/AC2: every present
cross-ecosystem manager's packages reach the root index — the property the above
collectively prove.
