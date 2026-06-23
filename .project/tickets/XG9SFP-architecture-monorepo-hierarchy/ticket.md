---
id: XG9SFP
slug: architecture-monorepo-hierarchy
type: feature
phase: intake
status: in_progress
created: 2026-06-23T02:34:25.862Z
last_modified: 2026-06-23T02:40:00.000Z
scope:
  - Monorepo detection + leaf discovery (reuse detectWorkspaces, expand globs via node:fs globSync, keep dirs with a package.json)
  - Derived root index at .project/architecture.generated.md (package set + each package's one-line purpose + inter-package dependency edges) with its own monorepoFingerprint and ownership/staleness machinery
  - Colocated leaf docs at packages/<pkg>/architecture.generated.md, one per package that has a src/ modules tree (empty-skeleton packages noop per CTAZT5 — no leaf doc), reusing shapeFingerprint + renderDocument + selfHeal verbatim
  - Orchestration selfHealProject(cwd): single-repo (no workspaces) → today's exact single-doc output; monorepo → root index + per-leaf self-heal, each fingerprinted independently (incremental — unchanged leaves are left untouched)
  - Slice-2 enforcement fan-out — `architecture --check`/`--stage` walk root + all leaves (check fails if ANY would change; stage stages every changed doc)
  - Dogfood — this repo transitions from noop to a committed root index + packages/cli leaf doc (website is listed in the root but noop as a leaf)
out_of_scope:
  - Non-TypeScript language packs (TS extractor only; additive later)
  - LLM prose generation (Slice 2/3 stay deterministic and LLM-free)
  - Guide split — architecture-guide.md state-vs-ADR separation (Slice 4)
  - Any change to the hand-curated paths.architecture ADR record
  - pnpm-workspace.yaml leaf discovery (this repo uses the workspaces array; add pnpm later if needed)
done_when:
  - A monorepo produces a thin derived root index listing every workspace package (name + one-line purpose + inter-package dep edges), each leaf with a src/ tree gets a colocated packages/<pkg>/architecture.generated.md independently fingerprinted, and adding a package updates the root without hand-editing
  - A single-repo project's output is byte-identical to today (no regression in the Slice-1/2 single-doc path)
  - `architecture --check` fails when any root-or-leaf doc is stale and passes when all are fresh/noop/foreign; `--stage` stages every changed doc; both honor architectureDocEnforcement
  - This repo (a monorepo) self-heals a committed root index + packages/cli leaf doc, and CI `--check` enforces them green
  - All scenarios in features/architecture-monorepo-hierarchy.feature pass via the BDD lane
---

# Architecture monorepo hierarchy (Slice 3 — derived root index + colocated leaves)

**Goal:** Extend the always-fresh architecture doc to monorepos with progressive
disclosure and no drift: a thin **derived root index** in `.project/` plus
**colocated per-package leaf docs**, each independently fingerprinted and
self-healing, so a monorepo stays navigable (nearest-wins) and no node silently
lies — inheriting the Slice-1 freshness guarantee and Slice-2 enforcement
per node.

**See:** [spec.md](./spec.md) for personas, jobs-to-be-done, and outcomes.

## Why

Slices 1–2 give the freshness + enforcement guarantee, but only for a single
`src/` tree — a monorepo root (no top-level `src/`) is `noop`, so safeword's own
repo currently has no architecture doc. A monorepo needs the guarantee per
package, structured hierarchically (root overview → leaf detail) so agents load
the nearest relevant context without drowning in one giant doc (cognitive load).

## Resolved design (epic QD5DTT decisions 4–6 + /figure-it-out, 2026-06-23)

**Topology (converged in the epic):** derived root index (`.project/`) + colocated
leaves (`packages/<pkg>/architecture.generated.md`), leaves discovered from the
workspace manifest (the discovery source IS the root fingerprint input — no new
config key).

**Orchestration — "heal target" generalization.** Extract the shared self-heal
machinery (ownership guard, fingerprint read/write, `decideAction`, reconcile-stamp
preservation) into `healTarget({ path, fingerprint, render })`. Three target
factories — single-repo, leaf, root-index — over one orchestrator
`selfHealProject(cwd)`:

- **No workspaces →** one single-repo target = today's output **byte-for-byte**
  (single-repo path provably unchanged; it's just the one-target case).
- **Workspaces →** one root-index target + one leaf target per package.

Rejected branching monorepo `if`s inside `selfHeal` — forks the hot path and is
how single-repo behavior silently drifts.

**Root index ≠ skeleton.** Own renderer (`## Packages` list + one-line purpose +
an inter-package dependency-edge section) and own `monorepoFingerprint` =
hash{ sorted package names + sorted inter-package dep edges }. Distinct from
`shapeFingerprint`. Leaf docs reuse `shapeFingerprint` + `renderDocument`
verbatim (a leaf is just a single-repo doc rooted at the package dir).

**Leaf discovery.** Reuse `detectWorkspaces(cwd)` → expand globs with `node:fs`
`globSync` → keep dirs containing a `package.json`. A leaf with no `src/` modules
→ empty skeleton → **noop** (CTAZT5 rule, reused — no special case): no leaf doc,
but the root index still lists the package.

**Incremental boundary is free.** Each leaf self-heals against its own recorded
fingerprint, so `decideAction` returns `unchanged` for untouched leaves; the root
re-renders only when the package set or edges move. Re-hash-all / rewrite-moved
falls out of reusing `decideAction` per target — no separate incremental engine.

**Enforcement fan-out (Slice 2).** `--check` fails if **any** target would change;
`--stage` stages **every** changed doc; both walk root+leaves via
`selfHealProject`, honoring `architectureDocEnforcement`.

**Dogfood impact.** This repo transitions from `noop` to a committed root index
(`.project/architecture.generated.md`, listing cli + website) + a
`packages/cli/architecture.generated.md` leaf. `website` (Astro, no `src/`
modules) is listed in the root but noop as a leaf. npm leakage handled: cli
allowlists `dist`+`templates`; website is `private`.

## Key decisions

1. **Heal-target generalization**, not in-place `if` branching — single-repo stays byte-identical.
2. **Leaf coverage = packages with a `src/` tree** (empty-skeleton packages noop, no leaf doc) — falls out of the existing noop rule, no new logic. Root index lists all packages regardless.
3. **Root fingerprint distinct** (`monorepoFingerprint` = package set + dep edges); leaves reuse `shapeFingerprint`.
4. **Colocated leaf path** `packages/<pkg>/architecture.generated.md` (epic decision 5).
5. **Full slice now** (not split 3a/3b).

## Open questions for define-behavior / scenario-gate

- **Fingerprint-input boundary (premortem — pin first):** the shared root
  `.dependency-cruiser.cjs` belongs to the **root** fingerprint, not every leaf's
  — leaves own only their `src/` + manifest deps + schema. Pin in/out precisely
  per input so a boundary-config edit fires the root once, not every leaf.
- **Inter-package edge derivation:** an edge A→B exists when package A's manifest
  depends on package B's workspace package name. Pin: dev+prod deps in, version
  ranges out.
- **Root ownership/foreign-doc + noop semantics:** a monorepo with workspaces but
  zero packages-with-src → root index still emits (packages exist) — root noop
  only when there are no workspace packages at all.
- **Single-repo regression guard:** an explicit scenario asserting a non-workspace
  project's doc is unchanged.

## Work Log

- 2026-06-23T02:34:25Z Started: Created ticket XG9SFP after Slice 2 (FPV0E4) closed.
- 2026-06-23T02:40:00Z Intake: topology was already converged in the QD5DTT epic
  (decisions 4–6). /figure-it-out resolved the implementation orchestration
  (heal-target generalization), root vs leaf fingerprint split, leaf discovery
  (detectWorkspaces + globSync), the free incremental boundary, and enforcement
  fan-out. User decisions: leaf coverage = packages-with-src (via reused noop),
  full slice now. Next: BDD define-behavior, first scenario pins the
  root/leaf fingerprint-input boundary.
