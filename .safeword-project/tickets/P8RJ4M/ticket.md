---
id: P8RJ4M
slug: arcade-coexistence-conventions
title: 'Reconcile arcade `.project/` and architecture-tracking conventions with safeword'
type: feature
phase: intake
status: in_progress
created: 2026-05-26T03:20:00.000Z
last_modified: 2026-05-26T03:20:00.000Z
---

# Reconcile arcade `.project/` and architecture-tracking conventions with safeword

**Goal:** Decide how safeword behaves for customers who also run arcade — specifically how shared inputs (personas, glossary) and architecture-tracking patterns reconcile when both tools want to author or read the same project knowledge.

**Why:** [DZ2NM5](../DZ2NM5/ticket.md) locked in strict `.safeword-project/` ownership for personas/glossary on the basis that safeword-only customers benefit from a self-contained, prefix-namespaced install. That leaves arcade-overlap customers (currently: this user) with duplicate-maintenance — arcade writes `.project/personas.md` and `.project/glossary.md`, safeword reads `.safeword-project/personas.md` and `.safeword-project/glossary.md`. Without a reconciliation story the same persona has to be authored twice, or one tool's view goes stale. Similar problem for architecture: arcade has a three-surface model (per-area `arch.md` rules, `docs/docs/arch/*.md` canonical, `.project/arch-proposals/`), safeword's pattern is one living `architecture.md` per package. When both tools coexist neither owns the canonical source.

**Discovered while:** designing DZ2NM5 (Phase 0 merge). The prefix rule landed cleanly for safeword-only customers but punted on cross-tool coexistence.

**Sibling tickets:**

- [DZ2NM5](../DZ2NM5/ticket.md) — Phase 0 product-layer merge. P8RJ4M does NOT block DZ2NM5; the latter ships with strict `.safeword-project/` ownership and the bridge work is layered on top later.
- [M6D315](../M6D315/ticket.md) — Phase 2 merge with ADR consultation / architecture-check work. Architecture-convention reconciliation lives here in P8RJ4M; M6D315 owns the consultation-gate implementation against whatever single-tool architecture file safeword ends up with.

## Scope

### Cross-tool persona/glossary reconciliation

- Decide bridge model for users who have BOTH arcade and safeword installed:
  - Arcade-primary (safeword reads from `.project/personas.md` and `.project/glossary.md` when those exist; ignores its own copies)?
  - Safeword-primary (arcade reads from `.safeword-project/`)?
  - Independent (both tools write their own; user maintains the two — current default)?
  - Sync gesture (a `safeword sync` command that copies/merges arcade's view into safeword's, or vice versa)?
- Detection mechanism — how does safeword know arcade is also installed? `.project/` folder presence? `arcade.toml`? A user config flag?
- Conflict resolution — when both files exist with divergent content, what wins?

### Architecture convention alignment

- Arcade's pattern: per-area `arch.md` (Cursor/Claude rules with path scopes), `docs/docs/arch/*.md` (canonical decisions), `.project/arch-proposals/*.md` (in-flight proposals).
- Safeword's pattern (per `architecture-guide.md`): one living `architecture.md` per project/package, updated in place; ADRs explicitly contrasted as legacy.
- Decide whether safeword adopts arcade's per-area model for monorepo customers, or arcade users adopt safeword's single-doc model, or each tool keeps its own and they coexist with explicit pointers.
- If per-area: how is the path scope declared? Safeword would need a rules-auto-load equivalent or a heavier consultation-gate.
- Where do arcade's `arch-proposals/` and `docs/docs/arch/` fit in safeword's model — does safeword consume them, ignore them, or recommend migrating them to safeword's shape?

### Documentation

- Clear guidance for customers running both tools — where to author each file type, which tool reads which.
- A "you have both tools installed" detection + onboarding nudge in `safeword setup`.

## Out of scope

- Anything in [DZ2NM5](../DZ2NM5/ticket.md). That epic owns the safeword-only product-layer merge; this ticket layers the bridge on top.
- Implementing the architecture consultation-gate itself (that's [M6D315](../M6D315/ticket.md) territory).
- Migrating arcade's internal conventions (this ticket is about safeword's behavior when arcade is present, not about changing arcade).
- Multi-tool coexistence beyond arcade. If a third tool wants to read `.project/` later, that's a separate ticket.

## Open questions

- **Bridge direction default** — for the common case of "user runs both tools," is arcade-primary, safeword-primary, or independent the right default? Driver lean: independent for v1 (no magic), with explicit user opt-in to a bridge.
- **Detection signal** — `.project/` folder presence is the cheap signal but accidentally fires for users who happen to have a `.project/` folder for other reasons. Need a stronger arcade-installed marker.
- **Architecture model unification** — does safeword copy arcade's per-area path-scoped pattern (more powerful, requires building rules-auto-load) or stay with single-doc + consultation gate? Driver lean: stay single-doc for v1, revisit if monorepo customers ask for per-area.
- **Sync gesture necessity** — is `safeword sync` a real need, or can users symlink themselves out of duplicate-maintenance? Driver lean: symlink for v1, build sync if it becomes a pain point.
- **Timing** — does this ship next to DZ2NM5 (so arcade-overlap customers get a clean coexistence story from day one) or after DZ2NM5 lands and adoption surfaces real pain? Driver lean: after, with this ticket open as the known follow-up.

## Done when

- A documented decision exists for each open question above.
- Safeword behavior when `.project/personas.md` exists is specified — read, ignore, warn, or prompt — with rationale.
- Architecture-convention coexistence documented: which model safeword adopts, how it handles arcade's three-surface artifacts when present.
- `safeword setup` is updated if a detection-and-onboarding gesture is part of the resolution.
- Customer-facing guidance landed in safeword docs explaining the coexistence story.

## Related

- [DZ2NM5](../DZ2NM5/ticket.md) — parent context; this ticket extracted from D3 resolution.
- [M6D315](../M6D315/ticket.md) — architecture-consultation implementation lands there once this ticket decides the model.
- [MBGQ89](../MBGQ89/ticket.md) — ticket-schema fields for cross-ticket dependencies; precedent for "discovered during this work, tracked standalone."

## Work Log

- 2026-05-26T03:20:00.000Z Started: Created ticket P8RJ4M. Extracted from DZ2NM5 D3 resolution after the `.project/` fallback was removed in favor of strict `.safeword-project/` ownership.
