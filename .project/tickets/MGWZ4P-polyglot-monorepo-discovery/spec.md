# Spec: Support any monorepo — union workspace managers (MGWZ4P)

## Jobs To Be Done

### MGWZ4P.J1 — A complete map of a polyglot monorepo

**Persona:** Technical Builder (TB)

When I run safeword on a polyglot monorepo that declares packages with more than
one workspace manager at once (e.g. `package.json` `workspaces` for the JS apps
**and** `go.work` for the Go services), I want the generated root index to list
**every** package regardless of which manager declares it, so I can trust the
architecture doc as a complete map instead of a silent subset that hides whole
languages. (The Non-Technical Builder feels this hardest — they can't audit the
diff to notice the Go services are missing.)

#### MGWZ4P.J1.AC1 — Cross-ecosystem managers are unioned

A repo declaring packages with two or more different-ecosystem managers at the
root (JS `workspaces` + `go.work`; or `go.work` + Cargo `[workspace]` + uv
`[tool.uv.workspace]`) lists **every** manager's packages in the root index — none
is silently dropped at the discovery layer.

#### MGWZ4P.J1.AC2 — JS precedence is preserved (cross-ecosystem only)

`package.json` `workspaces` still wins over `pnpm-workspace.yaml` when both are
present — they are alternative managers for the *same* JS ecosystem, not additive.
The union is cross-ecosystem only; pnpm's dirs are not unioned into an
npm-authoritative repo.

#### MGWZ4P.J1.AC3 — No double-counting

A single directory legitimately matched by two managers (a maturin package under
both a Cargo `[workspace]` and a uv workspace glob) is listed once.

#### MGWZ4P.J1.AC4 — No regression

Single-manager monorepos, single polyglot packages, and single-repo projects are
unchanged; `architecture --check` still passes on this repo.

## Problem

`discoverLeafDirectories` is first-match-wins across the manager detectors:

```text
detectWorkspaces ?? detectPnpmWorkspaces ?? detectGoWork ?? detectCargoWorkspace ?? detectUvWorkspace
```

The first non-undefined result wins; the rest are never consulted. A repo
declaring packages with two+ managers at once gets only the first manager's
packages. The others vanish at the **discovery** layer — before the ZRW21K
"not introspected" marker can fire — so the root index looks complete while
silently omitting, say, every Go service. A coverage-honesty hole, not just a
missing feature.

## Design (refined from the intake "union all + dedupe")

Reviewing the existing precedence test sharpened the intake's "union all":
`package.json` `workspaces` and `pnpm-workspace.yaml` are **alternative JS
managers** for the same ecosystem — a repo uses one, not both — and the ZRW21K
rule (package.json wins) must stay. Dedupe alone does NOT preserve that when the
two JS configs point at *different* dirs. So the rule is:

- **Within JS**: keep precedence — `detectWorkspaces` (package.json) **else**
  `detectPnpmWorkspaces`. Exactly one JS pattern set.
- **Across ecosystems**: **union** that JS set with `go.work`, Cargo
  `[workspace]`, and uv `[tool.uv.workspace]` — disjoint package sets (Go dirs
  carry `go.mod`, Rust `Cargo.toml`, Python `pyproject.toml`), so they add.
- **Dedupe** the final leaf-dir set (the existing `Set<string>`) — handles a single
  dir matched by two managers.

Concretely: `patterns = [ (detectWorkspaces ?? detectPnpmWorkspaces), detectGoWork,
detectCargoWorkspace, detectUvWorkspace ].filter(present).flat()`. The existing
glob-expand + `hasRecognizedManifest` + Set-dedupe loop is unchanged, so each leaf
is still kept only when it carries a recognized manifest and is extracted by its
own language branch. Union only **widens** the leaf set — contained blast radius.

## Out of scope

Per-leaf polyglot extraction (already works); new language packs / manifest
formats; nested/recursive workspaces (note any limitation, don't expand); the
ARCHITECTURE.md reconcile feature (AXRC4D).
