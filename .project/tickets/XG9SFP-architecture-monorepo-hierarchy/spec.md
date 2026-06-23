# Spec: Architecture monorepo hierarchy (Slice 3)

**Scope of this spec:** Slice 3 only (see ticket → Scope). Monorepo detection +
leaf discovery, a derived root index, colocated per-package leaf docs, the
heal-target orchestration, and Slice-2 enforcement fan-out across root+leaves.
Single-repo behavior stays byte-identical. No non-TS packs, no LLM prose, no
guide split (Slice 4).

## Intent

Slices 1–2 deliver always-fresh, enforced architecture facts — but only for one
`src/` tree, so a monorepo root is `noop` (safeword's own repo has no doc today).
Slice 3 extends the guarantee to monorepos with progressive disclosure: a thin
**derived root index** maps the packages, and each package carries a **colocated
leaf doc** fingerprinted over its own structure. Agents load the nearest relevant
context (nearest-wins) instead of one giant doc (cognitive load), and every node
self-heals and is enforced independently — no node silently lies.

## References

- Epic QD5DTT (decisions 4–6: hierarchical/per-node fingerprinted, root derived
  from children, leaves colocate; evidence base — progressive disclosure NN/g,
  doc colocation, content-hash incremental builds)
- Slice 1 (QD5DTT/#316) — `extractSkeleton`, `shapeFingerprint`, `selfHeal`,
  `decideAction`, ownership marker, the `noop` rule (CTAZT5/#331)
- Slice 2 (FPV0E4) — `planSelfHeal`, `isWouldChangeAction`, `architecture
--check`/`--stage`, `architectureDocEnforcement`
- Reuse: `detectWorkspaces` (workspace-manifest parsing), `node:fs` `globSync`
  (glob expansion, no new dep)

## Personas

- **Technical Builder (TB)** — drives an agent across a monorepo; needs each
  package's architecture fresh and navigable per-package, and needs the existing
  single-repo behavior untouched.
- **Non-Technical Builder (NTB)** — needs a map of the whole system (which
  packages exist, what each is for, how they depend on each other) without
  reading code.

## Vocabulary

- **Root index** — the derived `.project/architecture.generated.md` in a
  monorepo: the package set, each package's one-line purpose, and inter-package
  dependency edges. Never hand-maintained.
- **Leaf doc** — a colocated `packages/<pkg>/architecture.generated.md`,
  fingerprinted over that package's own structure (a single-repo doc rooted at
  the package dir).
- **Heal target** — a `{ path, fingerprint, render }` unit the self-heal
  machinery operates on; single-repo, leaf, and root-index are the three factories.
- **monorepoFingerprint** — hash of {sorted package names + sorted inter-package
  dependency edges}; the root index's drift signal, distinct from `shapeFingerprint`.
- **Inter-package edge** — A→B when package A's manifest depends on package B's
  workspace package name (versions out).

## Jobs To Be Done

### architecture-monorepo-hierarchy.NTB1 — See the whole system's package map without reading code

**Persona:** Non-Technical Builder (NTB)

> When I open a monorepo to orient myself, I want an accurate map of which
> packages exist, what each is for, and how they depend on each other — kept
> current automatically — so I can understand the system without reading code.

#### architecture-monorepo-hierarchy.NTB1.AC1 — The root index lists every package with its purpose and dependency edges

A monorepo produces a derived root index naming every workspace package, each
with a one-line purpose, plus the inter-package dependency edges.

#### architecture-monorepo-hierarchy.NTB1.AC2 — Adding a package updates the root index with no hand-editing

When a workspace package is added, the next self-heal lists it in the root index
without any manual edit.

### architecture-monorepo-hierarchy.TB1 — Navigate each package's architecture independently

**Persona:** Technical Builder (TB)

> When my agent works inside one package of a monorepo, I want that package's
> architecture described in a doc colocated with its code and fingerprinted over
> its own structure, so the agent loads the nearest relevant context and a change
> in one package doesn't churn the others.

#### architecture-monorepo-hierarchy.TB1.AC1 — Each package with a src tree gets a colocated, independently-fingerprinted leaf doc

A package containing a `src/` modules tree gets a `packages/<pkg>/architecture.generated.md`
whose fingerprint covers that package's own structure.

#### architecture-monorepo-hierarchy.TB1.AC2 — A package with no modules gets a root entry but no leaf doc

A package with no `src/` modules is listed in the root index (name + purpose) but
gets no leaf doc (empty-skeleton noop).

#### architecture-monorepo-hierarchy.TB1.AC3 — A change in one package re-syncs only that package's leaf

A structural change inside one package re-syncs that package's leaf doc and
leaves every other leaf untouched (per-node, incremental).

### architecture-monorepo-hierarchy.TB2 — Keep the whole hierarchy fresh and enforced without regressing single-repo

**Persona:** Technical Builder (TB)

> When I commit or run CI on a monorepo, I want every node — root and each leaf —
> checked for staleness and auto-fixed the same way Slice 2 does for one doc, and
> I want my existing single-repo projects to behave exactly as before.

#### architecture-monorepo-hierarchy.TB2.AC1 — The root index re-syncs when the package set or edges change, not when only a leaf's internals change

The root fingerprint moves on a package-set or inter-package-edge change (and on
the shared boundary config), and does NOT move when only a leaf's internal `src/`
changes; conversely a leaf's fingerprint moves on its own `src/` change.

#### architecture-monorepo-hierarchy.TB2.AC2 — Enforcement fans out across root and every leaf

`architecture --check` fails when any node (root or leaf) is stale and passes
when all are fresh/noop; `--stage` stages every changed node. Honors the opt-out.

#### architecture-monorepo-hierarchy.TB2.AC3 — A single-repo project's doc is unchanged

A project with no workspaces produces exactly the Slice-1/2 single-doc output —
no root index, no leaf docs, byte-identical to today.

## Outcomes

- A monorepo self-heals a root index + one leaf per package-with-`src/`; adding a
  package updates the root with no hand-edit.
- A change in one package re-syncs only that leaf; a package-set/edge/boundary
  change re-syncs the root; unaffected nodes stay untouched.
- `architecture --check`/`--stage` enforce every node; `architectureDocEnforcement: false` opts the whole project out.
- A non-workspace project is byte-identical to today (no regression).
- This repo (a monorepo) self-heals a committed root index + `packages/cli` leaf;
  `website` is listed in the root but noop as a leaf.

## Open Questions

- defer: exact root↔leaf fingerprint-input boundary (root owns the shared
  `.dependency-cruiser.cjs` + package set + edges; leaves own only their `src/` +
  manifest deps + schema). Resolved as the first define-behavior scenario.
- defer: pnpm-workspace.yaml leaf discovery — out of scope this slice (repo uses
  the workspaces array); add later if needed.
