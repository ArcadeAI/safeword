---
id: 5X0DZA
slug: audit-reconcile-leaf-architecture-docs
type: task
phase: intake
status: in_progress
created: 2026-07-04T05:57:29.534Z
last_modified: 2026-07-04T05:57:29.534Z
epic: "730"
external_issue: https://github.com/ArcadeAI/safeword/issues/761
---

# Audit reconciles per-package leaf architecture.generated.md

**Goal:** Make the audit's ARCHITECTURE.md structural-drift check read each
package's leaf `architecture.generated.md` (the `src/`-module map), not just the
monorepo root index.

**Why:** The deterministic module-level map already exists and is self-healed —
it just isn't used. In a monorepo the audit reconciles against the root index's
`## Packages` (two package names) and stops, so real subsystem drift
(ARCHITECTURE.md describes a `src/` module that was renamed/removed) is
invisible. This is the enforcement half of "architecture.md stays current".

## Context

- The generator emits a tree: root index (`.project/architecture.generated.md`,
  `## Packages`) + one leaf per package (`packages/<pkg>/architecture.generated.md`,
  `## Modules` with a `###` heading per top-level `src/` dir).
- Verified live: `packages/cli/architecture.generated.md` has 13 subsystem
  headings (commands, packs, presets, retro, ticket-sync, tracker-sync,
  upstream-monitor, utils, …). Fresh, self-healed.
- The audit SKILL (`packages/cli/templates/skills/audit/SKILL.md`, section 5,
  Structural drift) reads only the namespace-root doc. For a monorepo that is
  the root index — packages only.
- Generator source: `architecture-skeleton.ts` (one level under `src/`),
  `architecture-document.ts` (`renderRootIndex` vs leaf skeleton docs).

## Scope

- Audit structural-drift step: when the namespace-root doc is a monorepo root
  index (`## Packages`), ALSO enumerate each `packages/<pkg>/architecture.generated.md`
  and reconcile ARCHITECTURE.md's subsystem-level claims (incl. Layers &
  Boundaries `directory` mappings like `packages/cli/src/packs/`) against those
  `###` headings — Orphaned / Missing / Drifted-layer-dir, report-only.
- Likely a small helper to discover + parse leaf docs (mirror the existing
  root-index heading parse). No generator change; no new detector.

## Out of scope

- Making the generator nest deeper than one level under `src/` ("Move B") —
  explicitly not doing this; diminishing returns, more churn.
- Auto-editing ARCHITECTURE.md prose (stays human-owned, report-only).

## Done when

- On a monorepo, audit flags a subsystem ARCHITECTURE.md documents but no leaf
  doc lists (orphaned), and a leaf `###` module ARCHITECTURE.md never mentions
  (missing).
- Reconciliation cites leaf-doc evidence, never overwrites prose.
- Single-repo behavior unchanged.

## Riskiest assumption / cheapest test

Assumption: leaf-doc `###` headings are a stable, parseable contract. Cheapest
test: parse this repo's `packages/cli/architecture.generated.md` +
`packages/website/...` and diff their module sets against ARCHITECTURE.md prose —
should surface any current subsystem gap immediately.

## Links

- Parent milestone: ArcadeAI/safeword#730 → Goal 14 "architecture.md + ADRs
  stay current" (#745). Natural GitHub parent.

## Work Log

- 2026-07-04T05:57:29.534Z Started: Created ticket 5X0DZA
- 2026-07-04 Filed: scoped from audit follow-up (the "Move A" finding). GitHub
  sub-issue nesting under #745/#730 pending GitHub re-auth.
