# Verify: Rust language pack (YKFA5X)

## Verify Checklist

**Test Suite:** ✅ Full suite green — 3419 passed / 5 skipped (226 files, VITEST_EXIT=0). 26 new unit tests (cargo-manifest 13, skeleton 5, monorepo 5, fingerprint 3).
**Gherkin:** ✅ 6 new Rust scenarios pass; 20 architecture scenarios green together (6 Rust + 7 Go + 7 monorepo), 0 failures.
**Build:** ✅ Success (CLI runs from source in the BDD lane; dogfood `--check` exits 0).
**Lint:** ✅ Clean (eslint per-file; the two block-parsers and scanners under the complexity bar, iterator helpers + linear regexes).
**Scenarios:** All 6 scenarios R/G/R (0afd962).
**Dep Drift:** ✅ Clean — zero new dependencies (Cargo.toml parsed by a hand-rolled subset reader).
**Parent Epic:** WBM8JE (per-language extractors); second slice after ZD70P1 (Go).
**Reconcile:** ✅ No pattern deviation — Cargo plugs into `discoverLeafDirectories` via the `??` chain, `extractSkeleton` via a manifest-keyed branch (like Go), and the fingerprint dependency set (like go.mod). The `cargo-manifest.ts` module co-locates all three Cargo readers (impl-plan "Known deviations" — three readers shipping together justify a module now; the cross-language merge waits for Python).

## Evidence

- **Independent scenario-gate review** (fresh context, `/review-spec`): PASS-WITH-NITS. Verified every scenario is RED today for a NEW-behavior reason (file extraction / Cargo discovery / keep-predicate / Cargo fingerprint), AODI, marker-distinctness, and drift-observability. Addressed the required fix (recorded the new `does not list the module` step in the ledger) + both nits (file-module Givens, load-bearing-RED note).
- **Three-axis extraction + parser** — verified by unit + black-box fixtures:
  - **Parser:** `cargo-manifest.ts` reads the `[workspace] members` array (multi-line + inline), the `[package] name` (table-scoped, not fooled by `[[bin]]`), and dependency keys across the three flat tables + `[dependencies.<name>]` sub-tables. 13 unit tests; degrades to empty/undefined outside the documented subset.
  - **Extraction:** `extractSkeleton` dispatches on `Cargo.toml` to list `src/` files AND dirs, minus `lib.rs`/`main.rs` (proven against the dir-only baseline); `src/`-dir (TS) and `go.mod` (Go) branches unchanged.
  - **Discovery/identity:** `detectCargoWorkspace` is the fourth `??` source; the keep-predicate accepts a Cargo-only directory; crate name from `[package] name`.
  - **Fingerprint:** Cargo dependency keys join the shape set (versions excluded) — proven black-box via `architecture --check` going stale on a dep add.
- **Audit:** 0 errors / 1 accepted warning — config in sync, depcruise 0 violations (159 modules, no cycles), no new dead code, zero new deps. The one jscpd clone is the 13-line import block shared by the Go and Rust step files (import boilerplate that appeared _because_ the real `runArchitecture` logic was deduped into `architecture-fixtures`) — benign, not logic duplication, and the repo broadly tolerates clones (not a CI gate).
- **Dogfood:** this TS repo's `architecture --check` exits 0 with zero doc changes — the Rust pack is a pure addition (no Cargo.toml here), no JS/TS/Go regression.

## Scope honesty

Per ticket.md out_of_scope, these are explicit, visible limitations: Cargo `[workspace] exclude` (over-inclusion, not silent drop), inter-crate edges (no edges rendered for Rust leaves), module nesting / `mod.rs`, `[workspace.dependencies]` inheritance and inline-table/feature/target deps, and both-config-at-root polyglot (JS wins the `??` chain). A root-only crate stays the honest "not introspected" marker.

## Audit

Audit passed — 0 errors, 1 accepted warning (import-boilerplate clone). No circular
dependencies or layer violations, no new dead code, no logic duplication, config in
sync, zero new dependencies, test quality verified.
