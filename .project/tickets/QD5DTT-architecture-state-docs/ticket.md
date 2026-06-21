---
id: QD5DTT
slug: architecture-state-docs
type: feature
phase: define-behavior
status: in_progress
created: 2026-06-21T03:20:41.930Z
last_modified: 2026-06-21T04:55:00.000Z
scope:
  - Slice 1 only (single-repo, never silently lies)
  - Deterministic skeleton extractor reusing DetectedArchitecture (boundaries.ts) — emits top-level src layout, deps, dependency-cruiser boundary config, schema files, each with code references and a one-line purpose floor
  - Shape-fingerprint over the skeleton inputs, stored in .project/architecture.md frontmatter (doc fingerprint + per-section reconciled stamps)
  - SessionStart self-heal — re-extract the skeleton (LLM-free) when the fingerprint moved; write per-section "stale" markers and orphan flags
out_of_scope:
  - Enforcement gates / blocking on markers (Slice 2)
  - Monorepo hierarchy — root index, workspace-discovered colocated leaves (Slice 3)
  - /architecture resync skill and architecture-guide.md state-vs-ADR split (Slice 4)
  - Non-TypeScript language packs
  - LLM prose generation or semantic repair (Slice 1 writes markers only, never rewrites prose)
done_when:
  - A fresh single-repo TS project gets a .project/architecture.md whose skeleton matches the real tree, with code references, a one-line purpose per node, and a frontmatter fingerprint
  - A structural change made outside any agent session is re-synced (skeleton) and/or its lagging prose flagged (stale marker) at the next SessionStart
  - The drift signal and self-heal are LLM-free — no model call in the path
---

# Always-fresh point-in-time architecture docs (monorepo-aware)

**Goal:** Guarantee every safeword project has an accurate, point-in-time `architecture.md` describing the system _as it is now_ — structural facts self-healing, any stale prose visibly flagged (never silently wrong), drift caught even from out-of-band human edits, and structured hierarchically so monorepos stay navigable.

**Why:** A stale architecture doc doesn't just sit there — agents reuse and build on it, so wrong context compounds (context poisoning) and degrades agent performance. Today safeword's `architecture.md` is a _decision log_ (ADRs, consulted before work), with no concept of freshness, no detection of out-of-band human changes, and no monorepo structure. We want a _state document_ that cannot silently lie.

**See:** [spec.md](./spec.md) for personas, jobs-to-be-done, and outcomes (to be authored in define-behavior).

## Scope

**In scope:**

- A new **state document** genre, separate from the ADR/decision log. `.project/architecture.md` = "what the system is now"; ADRs stay where they are = "why we decided X."
- A **deterministic structural extractor** (TS language pack first): emits the architecture skeleton from real files — top-level `src/` layout, dependency manifest, layer/boundaries config, schema/migration files — with code references. Zero LLM in this path (cannot hallucinate).
- **LLM prose tier**: the slow-moving narrative (what each layer is for, how it fits), updated incrementally per ticket or via an on-demand full resync (`/architecture` skill).
- **Shape-fingerprint drift detection** (IaC `terraform plan` model): hash architecture-relevant _shape_ (not bytes), store in doc frontmatter (`fingerprint`, `last_synced`); live-hash vs recorded = drift. LLM-free, cheap.
- **Multi-point firing** of the drift signal: SessionStart (self-heal structural facts + warn), pre-commit, stop hook, CI backstop. SessionStart coverage is what catches **human out-of-band changes** before they reach an agent's context.
- **Tiered enforcement**: high-signal _shape_ changes (new top-level dir, new layer, schema added/removed) gate; low-signal (dependency version bumps) warn. Config flag (`architectureFreshness`); SessionStart self-heal + warn defaults ON (free, non-blocking), commit/stop gate opt-in.
- **Monorepo structure** (hierarchical, progressive disclosure):
  - Thin **root index** at `.project/architecture.md` — _derived, never hand-maintained_: package list + each child's one-line purpose + inter-package dependency graph. Root fingerprint = {package set + dep edges}. Plus a small LLM "system overview" prose block (fingerprinted separately).
  - **Colocated leaf docs** at `packages/<pkg>/architecture.md` — each independently fingerprinted over _that package's_ inputs, self-healing, nearest-wins for agent navigation.
  - **Leaves discovered from the workspace manifest** (`package.json` workspaces / `pnpm-workspace.yaml`) — no new config key; the discovery source IS the root fingerprint input.

**Out of scope:**

- Non-TypeScript language packs (additive later; ship TS extractor first).
- Replacing or migrating the existing ADR/decision-log machinery (`architectureReviewGate`, reconcile records) — this is additive and separate.
- Auto-generating C4/Structurizr diagrams (C4 is borrowed as _vocabulary_ for tiers, not as an output format).
- A general "logical filesystem" abstraction over `paths.*` (K7N2QM deliberately refused this; honor it).

## Key Decisions (converged via three `/figure-it-out` sessions)

1. **State doc separate from ADR log.** Different genres rot differently; keep them apart.
2. **Refresh = deterministic skeleton + LLM prose** (not full LLM regen, not incremental-only). The fastest-drifting facts are mechanically extractable; the LLM writes only the slow-moving prose. Skeleton is also the fingerprinted artifact — one source of truth.
3. **Drift = IaC-style shape-fingerprint**, fired at session/commit/stop/CI. Cheap enough to run on every entry point, which is the only way to catch unwitnessed human changes. Semantic LLM comparison is the _repair_ step, never the primary signal.
4. **Monorepo = hierarchical, per-node fingerprinted, root derived from children.** Local drift attribution; progressive disclosure is structural, not cosmetic. Inherits agent nearest-wins navigation.
5. **Leaves colocate with packages; root index in `.project/`.** Colocation reduces drift (doc edited in same PR as code) and matches safeword's existing colocated subdirectory-context-file pattern. Map (index) = project knowledge in `.project/`; territory (leaves) = with the code. Honors the namespace invariant rather than bending it.
6. **Prose-freshness contract = advisory prose + deterministic staleness markers + a structured floor.** The skeleton is fingerprintable; narrative prose is not. So the guarantee is reframed honestly: structural facts are always fresh, and any lagging prose is always _visibly flagged_ — the doc may be incomplete but never _silently_ wrong. Mechanism: each prose section stamps `reconciled: <skeleton-fingerprint>` (fingerprint-of-record); deterministic self-heal rewrites the skeleton, marks any section whose stamp drifted `⚠ stale: structure changed <date>`, and flags orphan prose (describes a node that no longer exists) for deletion — all LLM-free. **Floor:** every skeleton node carries a one-line `purpose` that is itself a structural fact (presence + orphan mechanically checkable). **Escalation rule** (from lint-design research — _if any phase informs, a later phase must block on the same thing_): SessionStart informs (writes markers, warn, default ON); the stop/CI gate blocks on the same markers when enabled. Markers are per-section, keyed to that section's own node fingerprint, so they don't banner the whole doc (avoids warning-fatigue).

**Evidence base:** stale-context-degrades-agents (arxiv 2509.18970 hallucination survey; LLM staleness → context poisoning); IaC drift detection (terraform plan); doc colocation reduces drift (Docsie, Gaudion); hierarchical AGENTS.md Level1/Level2 context loading; progressive disclosure 3-layer index→details→deep-dive (NN/g); cognitive-load trap — disclosure done wrong relocates complexity (NN/g); staleness-marking of generated content is prior art (USPTO 11531822); inform-early/block-later-on-the-same-thing + warning-fatigue (neugierig "rethinking errors/warnings", ESLint-warnings-anti-pattern).

## First scenarios to write (define-behavior)

- **Per-tier fingerprint contents.** Root = package set + dep edges. Leaf = that package's `src/` dirs + deps + **dependency-cruiser config** + schema files. Pin precisely (in/out for each input) — this single choice sets the gate's signal-to-noise. _NB (found in main-merge analysis): the repo enforces boundaries via dependency-cruiser (`.dependency-cruiser.cjs` → generated `.safeword/depcruise-config.cjs`), **not** `eslint-plugin-boundaries` (which is docs-only). Fingerprint the dependency-cruiser config, not eslint config._
- **Skeleton-fresh + prose-stale interaction** (resolved by Decision 6, now writable): when self-heal rewrites a skeleton section whose prose `reconciled` stamp no longer matches the live fingerprint, the section is marked `⚠ stale` and the orphan check flags prose describing a now-deleted node. Both markers are deterministic (no LLM).
- **Escalation boundary:** SessionStart writes markers + warns (never blocks); the stop/CI gate blocks while unresolved markers remain (opt-in). Prove warn-only still can't let the doc silently lie (markers always written) and that the later phase blocks on the same markers.

## Open questions for define-behavior / scenario-gate

- Self-heal performance on large monorepos: SessionStart re-hashes all nodes (cheap) but self-heals only nodes whose fingerprint moved (build-cache style). Confirm the incremental boundary.
- npm-publish leakage of colocated `architecture.md`: `files: ["dist"]` allowlist excludes it automatically; otherwise setup adds a package ignore. Confirm setup behavior.
- Config surface: `architectureFreshness` flag shape; which sub-behaviors default ON vs opt-in.
- Guide split: `architecture-guide.md` currently conflates state + decisions. Decide how to split state-doc guidance from ADR guidance without duplicating.

## Reuse + conventions (found during main-merge analysis, 2026-06-21)

- **Extractor reuse:** safeword already has layer detection — `boundaries.ts` (`DetectedArchitecture`) and `depcruise-config.ts` (`generateDependencyCruiseConfigFile`). Slice 1's deterministic extractor should **reuse `DetectedArchitecture`**, not reinvent layer detection. Shrinks Slice 1 from "build extractor" to "reuse detection → emit skeleton → fingerprint."
- **ESLint-10 NOTE narrowed:** main #300 dropped ESLint 9 for ESLint 10. This is **moot for the repo's own boundary enforcement** (dependency-cruiser, not eslint). It only touches the customer-facing `eslint-plugin-boundaries` instructions in `architecture-guide.md` → reconcile in **Slice 4** (guide split). `eslint-plugin-boundaries` ↔ ESLint 10 compat still unverified (Slice 4 concern, not Slice 1).
- **Lint convention:** unicorn 68 (merged #300) enforces no abbreviations — implement code uses full words (`DependencyCruise`, not `DepCruise`).

## Acceptance Criteria (draft — refine in spec)

- [ ] A fresh TS project gets a `.project/architecture.md` whose structural facts match the real tree, with code references and a frontmatter fingerprint.
- [ ] **Structural drift is self-healed:** a structural change made _outside any agent session_ is mechanically re-extracted at the next SessionStart, so structural facts are never stale (no "or" — facts are always fresh).
- [ ] **Prose drift is marked, never silent:** when a section's `reconciled` stamp no longer matches the live skeleton fingerprint, self-heal writes a per-section `⚠ stale` marker and flags orphan prose — deterministically, regardless of enforcement level. Warn-only defaults still cannot let the doc silently lie.
- [ ] **Escalation holds:** SessionStart informs (markers + warn, never blocks); the stop/CI gate blocks while unresolved markers remain (opt-in). A later phase blocks on the same signal an earlier phase informed on.
- [ ] A monorepo produces a thin derived root index + colocated per-package leaves, each independently fingerprinted; adding a package updates the root without hand-editing.
- [ ] The drift signal is LLM-free and runs at SessionStart, pre-commit, stop, and CI.
- [ ] Enforcement is tiered (shape→gate, version→warn) and config-gated; defaults don't block the common path.

## Delivery Slices (each ships value alone; decompose into child tickets at spec time)

Addresses the "epic wearing a feature label" packaging note. `/bdd` runs on **Slice 1 only**; the rest are follow-on tickets.

- **Slice 1 — single-repo "never silently lies"** _(the vertical increment that stands alone)_: deterministic extractor + skeleton + shape-fingerprint + per-node `purpose` floor + SessionStart self-heal that **writes staleness markers**. No gates, no monorepo, no rich prose tooling. Delivers the core guarantee on its own.
- **Slice 2 — enforcement escalation:** tiered gate (shape→gate, version→warn) blocking on the same markers at stop/CI; `architectureFreshness` config surface.
- **Slice 3 — monorepo hierarchy:** derived root index + workspace-discovered colocated leaves, per-node fingerprints, incremental self-heal.
- **Slice 4 — ergonomics:** `/architecture` on-demand full-resync skill + `architecture-guide.md` state-vs-ADR split.

## Work Log

- 2026-06-21T03:20:41Z Started: Created ticket QD5DTT.
- 2026-06-21T03:21:00Z Context: Design converged across three `/figure-it-out` sessions (refresh method, drift enforcement, monorepo structure + leaf placement). Captured decisions + evidence above.
- 2026-06-21T04:55:00Z Complete: intake (Slice 1) — drafted spec.md (NTB1/TB1 JTBDs + ACs), `/self-review` Tier 1 passed and stamped (notes: NTB1.AC1↔TB1.AC1 partition, TB1.AC2-as-coverage, add a no-src/unparseable failure scenario), set scope/out_of_scope/done_when, advanced phase → define-behavior. SM deliberately excluded (enforcement is Slice 2).
- 2026-06-21T04:42:00Z Merged origin/main (#300 ESLint 10, #297). Re-ran `bun ci` (clean). Impact analysis via `/figure-it-out`: #300 is semantically inert for the ticket (unicorn renames + test churn, no behavior change). But forensics found the repo enforces boundaries via **dependency-cruiser, not eslint-plugin-boundaries** (latter is docs-only) → repointed the fingerprint input + named `boundaries.ts`/`DetectedArchitecture` as extractor reuse (shrinks Slice 1), narrowed the ESLint-10 NOTE to the Slice 4 guide split, recorded the no-abbreviation convention. No decision reversed.
- 2026-06-21T04:35:00Z Review + figure-it-out: `/quality-review` flagged epic-sized scope + a prose-freshness hole in "cannot silently lie" (prose can't be shape-fingerprinted). Resolved via Decision 6 (advisory prose + deterministic staleness markers + `purpose` floor + inform-early/block-later escalation; evidence: USPTO 11531822, neugierig rethinking-errors, ESLint-warnings-anti-pattern). Split AC #2 into self-heal/marker/escalation criteria, added Delivery Slices (scopes `/bdd` to Slice 1). Verified dependency-cruiser 17.4.3 alive; noted ESLint 10 currency check for eslint-plugin-boundaries at implement. Next: `/bdd` on Slice 1 → spec.md then per-tier fingerprint scenario.
