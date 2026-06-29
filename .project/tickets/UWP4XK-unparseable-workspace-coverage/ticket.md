---
id: UWP4XK
slug: unparseable-workspace-coverage
type: feature
phase: define-behavior
status: todo
created: 2026-06-29T19:30:00.000Z
last_modified: 2026-06-29T19:30:00.000Z
scope:
  - Distinguish "workspace manager absent" from "workspace manager present-but-unparseable" at the detector boundary in `architecture-monorepo.ts` (`detectGoWork`, `detectCargoWorkspace`, `detectUvWorkspace`, the JS package.json/pnpm detectors). Today each returns `string[] | undefined` and `undefined` collapses both cases, so a present-but-unreadable root manifest contributes zero packages with no marker.
  - SURFACE a present-but-unparseable workspace config (advisory only, never blocking) in two places: a `## Coverage gaps` advisory line in the rendered monorepo root index naming the unreadable config, and a `safeword architecture` / `architecture --check` warning naming the unreadable config.
  - Fold the unreadable-workspace set into `monorepoFingerprint` (only when non-empty, to avoid churning repos that have none) so the root-index advisory stays fresh as an unreadable config appears or is fixed.
out_of_scope:
  - Nested/recursive workspaces (a member that is itself a workspace root).
  - New language packs / manifest formats; per-leaf polyglot extraction (unchanged).
  - Any blocking gate — the surface is advisory like the rest of the architecture honesty layer.
  - Repairing or guessing the contents of an unparseable manifest; we only report it.
done_when:
  - A repo with a malformed `go.work` (a `use` directive that yields no member dir) alongside a working manager surfaces the `go.work` as unreadable — its presence is named, not silently dropped.
  - A repo with a `Cargo.toml` `[workspace]` whose `members` array can't be parsed surfaces `Cargo.toml` as unreadable; a `Cargo.toml` with NO `[workspace]` table (a single crate) stays silent (absent, not unreadable).
  - A repo with a flow-style `pnpm-workspace.yaml` surfaces `pnpm-workspace.yaml` as unreadable.
  - When at least one OTHER manager still yields packages, the rendered root index carries a `## Coverage gaps` advisory naming each unreadable config AND lists the packages the readable managers discovered (the readable side is never blinded by the unreadable one).
  - `safeword architecture` and `architecture --check` print a non-blocking warning naming each unreadable config; neither command's exit code changes because of it.
  - `monorepoFingerprint` moves when an unreadable config appears or is fixed, but a repo with no unreadable config (this repo) keeps its existing fingerprint — no dogfood churn beyond the one-time regeneration this ticket lands.
  - No regression: absent managers, single-manager monorepos, and single-repo projects are unchanged; `architecture --check` still passes on this repo.
---

# Surface a present-but-unparseable workspace manager (coverage honesty)

**Goal:** A workspace manager that is *present* at the repo root but whose member
list safeword cannot parse must be **surfaced**, not silently dropped. Today it
contributes zero packages and no marker — the same class of silent omission #554
fixed (a whole language vanishing from the map), one layer up.

**Origin:** GitHub #558, surfaced by the independent quality-review of #554
(MGWZ4P). Pre-existing: each detector degraded this way under the old first-match
chain too; explicitly out of scope for #554, filed so it isn't lost.

## Problem

`discoverLeafDirectories` unions all workspace managers (#554), but each detector
returns `string[] | undefined`, and `undefined` means **both "absent" and
"present-but-unparseable."** A malformed `go.work`, an unreadable Cargo
`[workspace] members`, or a flow-style `pnpm-workspace.yaml` returns `undefined`,
is filtered out, and contributes zero packages with no marker. The package set
vanishes at the **discovery** layer — *before* the ZRW21K "not introspected"
marker can fire (that marker is per-discovered-package; a manager that discovered
nothing has nothing to mark). The root index looks complete while silently
omitting, say, every Go service.

safeword's coverage-honesty principle is "incomplete is fine, silently wrong is
not." A present manager that can't be parsed should be surfaced.

## Decision

Distinguish the two cases at the detector boundary with a small discriminated
return (`absent` | `parsed` | `unreadable`), carrying the manager label and
config filename on the `unreadable` case so discovery can surface it. Reuse the
existing glob-expand + `hasRecognizedManifest` + `Set`-dedupe pipeline unchanged
— the readable managers still union exactly as before; the only addition is a
parallel `unreadable[]` channel. Surface it advisory-only (root-index line +
`--check`/command warning) and fold it into the root fingerprint (non-empty only)
so the advisory stays fresh. Never block.

## Next

`/bdd`: spec → dimensions → scenarios (malformed go.work, unreadable Cargo
members, flow-style pnpm — each surfaced, not silently empty) → independent
scenario review → TDD → verify → audit.
