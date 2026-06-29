# Test definitions (R/G/R ledger) — UWP4XK

Behavior: a workspace manager PRESENT at the root but unparseable is surfaced
(root-index `## Coverage gaps` advisory + `architecture`/`--check` warning),
never silently dropped. Black-box scenarios in
`features/architecture-unreadable-workspace.feature`; detector precision in
`tests/utils/architecture-monorepo.test.ts`. Dimensions in dimensions.md.

## Black-box scenarios (acceptance lane — `@architecture-unreadable-workspace`)

- [x] **AC1 — malformed go.work + working JS** (`…UWP4XK.AC1`) [J1.AC1/AC3, D2(a), D3(b)]
  - RED (pre-fix): go.work returns `undefined`, contributes nothing, no marker; root
    index lists `web` only, NO advisory. Failure: "root index has no Coverage gaps".
  - GREEN: root index lists `web` AND a `## Coverage gaps` advisory names `go.work`.
- [x] **AC2 — unreadable Cargo [workspace] members + uv Python** (`…UWP4XK.AC2`) [J1.AC1/AC3, D2(b), D3(b)]
  - RED: Cargo `undefined` (absent==unparseable), dropped silently; no advisory.
  - GREEN: lists `pytool` AND advisory names `Cargo.toml`.
- [x] **AC3 — flow-style pnpm + Go module** (`…UWP4XK.AC3`) [J1.AC1/AC3, D2(d), D3(b)]
  - RED: pnpm flow-style → `undefined`, dropped; no advisory (today's silent
    "degrades gracefully" path in monorepo-coverage-honesty).
  - GREEN: lists `gosvc` AND advisory names `pnpm-workspace.yaml`.
- [x] **AC4 — only-unparseable case is warned, not blocked** (`…UWP4XK.AC4`) [J1.AC4, D3(a), D6]
  - RED: a lone malformed go.work → single-repo doc, zero signal, command silent.
  - GREEN: command exits 0 AND its output warns that `go.work` is unreadable
    (the warning channel covers the no-root-index path).
- [x] **AC5 — absent is not a false alarm** (`…UWP4XK.AC5`) [J1.AC2, D4(b)]
  - Negative case: a single-crate `Cargo.toml` (no `[workspace]`) must NOT raise an
    advisory. GREEN: lists `gosvc`, no `## Coverage gaps` section.

Each scenario is Arrange-Observe-Decide-Independent: the Given builds the repo, the
When runs the real CLI, the Then reads only observable output (the rendered doc or the
command's stdout/stderr) — no package internals.

## Unit tests (detector precision — tests/utils/architecture-monorepo.test.ts)

- [x] **U1 — malformed go.work is unreadable, not absent** [D1(c), D2(a)]
  - RED: detector returned `undefined`; `discoverWorkspaces` had no `unreadable` field.
    GREEN: `{ patterns: [], unreadable: [{go.work}] }`.
- [x] **U2 — Cargo [workspace] present, members unparseable → unreadable** [D1(c), D2(b)]
- [x] **U3 — uv [tool.uv.workspace] present, members unparseable → unreadable** [D1(c), D2(c)]
- [x] **U4 — flow-style pnpm → unreadable** [D1(c), D2(d)]
- [x] **U5 — package.json `workspaces` of wrong shape → unreadable** [D1(c), D2(e)]
- [x] **U6 — a malformed manager never blinds the readable ones** [J1.AC3, D3(b)]: JS
  `web` + malformed go.work → patterns keep `packages/*`, leaves keep `web`, unreadable
  records `go.work`. The coverage-honesty property (#554 union survives one bad manager).
- [x] **U7 — single-crate Cargo.toml (no [workspace]) raises no signal** [J1.AC2, D4(b)]
- [x] **U8 — explicitly-empty `workspaces: []` is absent, not unreadable** [D4(d)]
- [x] **model — `extractMonorepoModel` exposes `unreadableWorkspaces`** [feeds render + fingerprint]
- [x] **U9 — fingerprint moves when an unreadable manager appears** [D5(b)]
- [x] **U9b — fingerprint does NOT move for a clean repo (no churn)** [D5(a)]: the
  unreadable key is contributed only when non-empty, so a readable-only repo keeps its hash.

## Reconcile note

Coverage honesty (no silent drop) is the union of U1–U6 + AC1–AC4: every present
cross-ecosystem manager that can't be parsed reaches a surface (doc advisory and/or
command warning). U7/U8 + AC5 pin the absent/empty boundary so the advisory is never a
false alarm. U9/U9b keep the doc advisory fresh without churning clean repos.
