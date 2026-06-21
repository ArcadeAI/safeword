---
id: QD5DTT
slug: architecture-state-docs
type: feature
phase: intake
status: in_progress
created: 2026-06-21T03:20:41.930Z
last_modified: 2026-06-21T03:20:41.930Z
---

# Always-fresh point-in-time architecture docs (monorepo-aware)

**Goal:** Guarantee every safeword project has an accurate, point-in-time `architecture.md` describing the system _as it is now_ — self-healing on its structural facts, drift-detected at every context-entry point, and structured hierarchically so monorepos stay navigable.

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

**Evidence base:** stale-context-degrades-agents (arxiv 2509.18970 hallucination survey; LLM staleness → context poisoning); IaC drift detection (terraform plan); doc colocation reduces drift (Docsie, Gaudion); hierarchical AGENTS.md Level1/Level2 context loading; progressive disclosure 3-layer index→details→deep-dive (NN/g); cognitive-load trap — disclosure done wrong relocates complexity (NN/g).

## Open questions for define-behavior / scenario-gate

- **Exact fingerprint contents per tier.** Root = package set + dep edges. Leaf = that package's `src/` dirs + deps + boundaries config + schema files. Pin precisely (in/out for each input) — this single choice sets the gate's signal-to-noise. _First scenario to write._
- Self-heal performance on large monorepos: SessionStart re-hashes all nodes (cheap) but self-heals only nodes whose fingerprint moved (build-cache style). Confirm the incremental boundary.
- npm-publish leakage of colocated `architecture.md`: `files: ["dist"]` allowlist excludes it automatically; otherwise setup adds a package ignore. Confirm setup behavior.
- Config surface: `architectureFreshness` flag shape; which sub-behaviors default ON vs opt-in.
- Guide split: `architecture-guide.md` currently conflates state + decisions. Decide how to split state-doc guidance from ADR guidance without duplicating.

## Acceptance Criteria (draft — refine in spec)

- [ ] A fresh TS project gets a `.project/architecture.md` whose structural facts match the real tree, with code references and a frontmatter fingerprint.
- [ ] A structural change made _outside any agent session_ is detected and flagged (or self-healed) at the next SessionStart.
- [ ] A monorepo produces a thin derived root index + colocated per-package leaves, each independently fingerprinted; adding a package updates the root without hand-editing.
- [ ] The drift signal is LLM-free and runs at SessionStart, pre-commit, stop, and CI.
- [ ] Enforcement is tiered (shape→gate, version→warn) and config-gated; defaults don't block the common path.

## Work Log

- 2026-06-21T03:20:41Z Started: Created ticket QD5DTT.
- 2026-06-21T03:21:00Z Context: Design converged across three `/figure-it-out` sessions (refresh method, drift enforcement, monorepo structure + leaf placement). Captured decisions + evidence above. Next: define-behavior → author spec.md (personas/JTBD), then test-definitions.md leading with the per-tier fingerprint-contents scenario.
