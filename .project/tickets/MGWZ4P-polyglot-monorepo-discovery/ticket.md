---
id: MGWZ4P
slug: polyglot-monorepo-discovery
type: feature
phase: intake
status: todo
created: 2026-06-29T01:09:00.000Z
last_modified: 2026-06-29T01:09:00.000Z
scope:
  - Make `discoverLeafDirectories` (architecture-monorepo.ts) UNION every workspace manager present at the repo root instead of first-match-wins. Today it is `detectWorkspaces ?? detectPnpmWorkspaces ?? detectGoWork ?? detectCargoWorkspace ?? detectUvWorkspace` — the first non-undefined result wins and the rest are never consulted. Change to: run all detectors, concatenate their glob-pattern lists, expand all, and dedupe leaf directories (the existing `Set<string>` already dedupes). A polyglot monorepo that declares packages with more than one manager at once (e.g. `package.json` workspaces for JS + `go.work` for Go + Cargo `[workspace]` for Rust) then discovers leaves from ALL of them.
  - Preserve the one real precedence case via dedupe, not ordering: `package.json` `workspaces` and `pnpm-workspace.yaml` describe the SAME JS package set, so overlapping globs must not double-count (the `Set` of absolute leaf dirs handles this for free). Cross-language managers point at DIFFERENT dirs, so they add rather than collide.
  - Coverage honesty (ZRW21K extended to the discovery layer): a package set declared by a present-but-unparsed or unmatched manager must never be SILENTLY omitted. With union, nothing is dropped — that is the core fix. Additionally, if a workspace glob resolves to a directory with no recognized manifest, keep today's behavior (skip / "not introspected"), never a false-complete root index.
done_when:
  - A monorepo with BOTH a `package.json` `workspaces` (JS) AND a `go.work` (Go) at the root lists JS and Go packages together in the root index — neither language is omitted.
  - The same holds for any mix of the five managers (npm/yarn/bun `workspaces`, pnpm-workspace.yaml, go.work, Cargo `[workspace]`, uv `[tool.uv.workspace]`).
  - Overlapping JS configs (`package.json` `workspaces` + `pnpm-workspace.yaml` pointing at the same dirs) do not double-count a package.
  - Single-manager monorepos, single polyglot packages (maturin), and single-repo projects are unchanged — no regression; `architecture --check` still passes on this repo.
  - No package set declared by a present manager is silently dropped from the root index (the coverage-honesty guarantee now holds at the discovery layer, not just the marker layer).
out_of_scope:
  - Per-leaf polyglot extraction (a single package mixing languages, e.g. maturin pyproject + Cargo) — already works via the manifest-keyed `extractSkeleton` dispatch and the union fingerprint.
  - Adding new language packs / new manifest formats — this ticket only changes how the EXISTING managers are combined.
  - The ARCHITECTURE.md reconcile feature (ticket AXRC4D) — but note the dependency below.
  - Nested / recursive workspaces (a workspace whose members are themselves workspaces) unless it falls out for free — note any limitation rather than expanding scope.
---

# Support any monorepo shape — union all workspace managers in discovery

**Goal:** A polyglot monorepo should be fully introspected no matter how many
workspace managers it uses at once, with no language's packages silently missing
from the generated architecture doc.

## Why

`discoverLeafDirectories` is first-match-wins across the workspace-manager
detectors (`detectWorkspaces ?? detectPnpmWorkspaces ?? detectGoWork ??
detectCargoWorkspace ?? detectUvWorkspace`). A repo that declares packages with
more than one manager at once — e.g. a JS `package.json` `workspaces` alongside a
`go.work` for Go services — gets ONLY the first manager's packages. The others
are invisible.

This is worse than a missing feature: it is a **coverage-honesty hole**. The
dropped packages aren't shown with a "not introspected" marker (the ZRW21K
guarantee) — they vanish at the *discovery* layer, before the marker logic runs,
so the root index looks complete while silently omitting, say, every Go service.

Per-package polyglot (maturin) and single-manager monorepos (one pnpm/npm
workspace, Nx/Turborepo, a single go.work) already work. The gap is specifically
**two or more managers active at the repo root simultaneously**.

## Approach (small, low-risk)

Union, don't short-circuit: collect glob patterns from every detector that fires,
expand them all, dedupe leaf dirs via the existing `Set`. Unioning only WIDENS the
leaf set, and each leaf is still kept only when `hasRecognizedManifest` is true and
extracted by its own language branch — so the blast radius is contained. The
former "package.json wins" precedence becomes a dedupe concern (same JS dirs from
two JS configs collapse to one), not an ordering one.

## Dependency

Ticket **AXRC4D** (reconcile ARCHITECTURE.md against the generated doc) consumes
the generated doc as ground truth. If discovery is incomplete (this gap), the
generated doc is itself blind to the dropped packages and reconcile inherits the
hole. Land this first, or sequence them together.

## Next

Run `/bdd` — multiple flows (JS+Go, JS+Rust, all-five mix, overlapping JS configs,
single-manager no-regression, dir-without-manifest) want scenarios, not a patch.
