# Impl Plan: Architecture monorepo hierarchy (Slice 3)

**Status:** planned

## Approach

Generalize the single-doc self-heal into a **heal target**, then orchestrate a
list of targets. The existing single-dir functions stay; the single-repo path
becomes the one-target case.

New module `architecture-monorepo.ts`:

- `discoverLeaves(cwd): LeafDir[]` — `detectWorkspaces` → expand globs with
  `node:fs` `globSync` → keep dirs with a `package.json` (deterministic sort).
- `extractMonorepoModel(cwd): { packages: PackageNode[]; edges: Edge[] }` —
  package name + one-line purpose (placeholder floor) + inter-package edges
  (A→B when A's manifest deps include B's package name; versions out).
- `monorepoFingerprint(model): string` — hash{ sorted package names + sorted
  edges + the shared boundary config }. The shared `.dependency-cruiser.cjs`
  belongs to the ROOT fingerprint, never a leaf's (premortem pin).
- `renderRootIndex(model, fingerprint, priorStamps)` — `## Packages` list +
  one-line purpose each + a dependency-edge section; same frontmatter
  ownership/fingerprint machinery as the leaf/single-repo doc.

Refactor `architecture-document.ts`:

- Extract `healTarget({ path, fingerprint, render }, existing-read)` from the
  body of `selfHeal` — the ownership guard, `decideAction`, fingerprint
  read/write, stamp preservation all move here unchanged.
- `selfHeal(cwd)` becomes `healTarget(singleRepoTarget(cwd))` — **byte-identical**
  output (asserted by a unit test: `selfHealProject(singleRepo)` bytes ===
  legacy `selfHeal` render for the same tree).
- New `selfHealProject(cwd): ProjectHealResult` (list of per-target results):
  no leaves → `[singleRepoTarget]`; leaves → `[rootIndexTarget, ...leafTargets]`.
  A leaf target roots `shapeFingerprint`/`extractSkeleton`/`renderDocument` at
  the package dir, writing `packages/<pkg>/architecture.generated.md`. An
  empty-skeleton leaf → `noop` (reused CTAZT5 rule) → no leaf doc.
- `planSelfHealProject(cwd)` — dry-run list of actions (drives `--check`).

Command `architecture.ts`:

- default → `selfHealProject(cwd)`, report per-node actions.
- `--check` → `planSelfHealProject`; exit non-zero iff **any** action is
  would-change; honor opt-out (short-circuit before walking).
- `--stage` → `selfHealProject`; `git add` **every** changed node's doc.

Build order (each green before the next):

1. `discoverLeaves` (+ globSync expansion) — unit. Foundation.
2. `extractMonorepoModel` + `monorepoFingerprint` (package set, edges, boundary
   config in root only) — unit. Pins the fingerprint-attribution scenario first.
3. `renderRootIndex` — unit (render + ownership frontmatter).
4. `healTarget` extraction + `selfHeal` byte-identity unit guard — unit/integration.
5. `selfHealProject` + `planSelfHealProject` orchestration — integration
   (temp monorepo fixture; per-node incremental, noop leaf, foreign leaf).
6. `--check`/`--stage` fan-out — integration (exit codes + git index across nodes).
7. Black-box cucumber steps + dogfood: regenerate this repo's root index +
   `packages/cli` leaf, commit them; CI `--check` already enforces.

Test layers: structure/fingerprint/render = unit (fast, deterministic);
orchestration + enforcement = integration (filesystem + git index are the
contract); `.feature` lane = end-to-end acceptance.

## Decisions

| Decision              | Choice                                                             | Alternatives considered             | Rejected because                                                               |
| --------------------- | ------------------------------------------------------------------ | ----------------------------------- | ------------------------------------------------------------------------------ |
| Orchestration         | `healTarget` generalization + `selfHealProject` list               | `if` branches inside `selfHeal`     | Forks the hot path; single-repo output silently drifts                         |
| Root fingerprint      | Distinct `monorepoFingerprint` (pkg set + edges + boundary config) | Reuse `shapeFingerprint` at root    | Root has no `src/`; its drift signal is the package graph, not src modules     |
| Boundary-config owner | Root fingerprint only                                              | Every leaf includes it              | A shared-config edit must fire the root once, not churn every leaf (premortem) |
| Leaf coverage         | Packages with a `src/` tree (empty → noop, no leaf doc)            | A doc for every package             | Birthing an empty leaf doc violates the CTAZT5 noop decision                   |
| Leaf doc path         | `packages/<pkg>/architecture.generated.md` (colocated)             | `packages/<pkg>/.project/...`       | Epic decision 5; avoids a `.project/` in every package; npm leakage handled    |
| Leaf discovery        | `detectWorkspaces` + `node:fs` `globSync`                          | New glob dependency; manual fs walk | globSync is in-node (no dep); detectWorkspaces already parses the manifest     |
| Single-repo guarantee | One-target case of the same orchestrator + byte-identity unit test | Trust structural-only assertions    | "byte-identical" is the load-bearing regression guard; assert it directly      |

## Arch alignment

Honors `ARCHITECTURE.md` (the `paths.architecture` record):

- **CLI owns the logic; hooks shell to it** — orchestration lives in the CLL
  (`selfHealProject`); the existing SessionStart and commit hooks shell to
  `safeword architecture` unchanged (they pick up monorepo support for free).
- **Reuse over reinvention** (`Reconciliation Engine` / Slice-1 spirit) — leaves
  reuse `extractSkeleton`/`shapeFingerprint`/`renderDocument`/`decideAction`
  verbatim; only the root index and discovery are new.
- **Monorepo Structure** (ARCHITECTURE.md §Monorepo Structure) — the doc topology
  mirrors the repo's existing `packages/*` workspace layout.

## Arch record note

No new cross-cutting ADR warranted — this extends the Slice-1 engine and the
established CLI/hook split along the already-recorded monorepo structure. If
pnpm-workspace.yaml or non-TS leaf discovery lands later, that may merit a record.

## Known deviations

- The root index is a **second renderer** alongside the skeleton renderer (not a
  generalization of it). Deliberate: a package graph and a module skeleton are
  different shapes; forcing one renderer to do both would be more complex than two
  small ones. Both share the frontmatter/ownership/fingerprint machinery.

## Assessment triggers

- **pnpm-workspace.yaml / non-TS packs** — leaf discovery and per-leaf extraction
  would need a second source; revisit `discoverLeaves`.
- **Deep nesting (packages within packages)** — current model is one level
  (root → leaves); nested workspaces would need a recursive target tree.
- **Large monorepos (many packages)** — re-hash-all is cheap today; if it isn't,
  a per-leaf mtime fast-path before hashing becomes worth it.
