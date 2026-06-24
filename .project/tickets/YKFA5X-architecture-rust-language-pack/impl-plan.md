# Impl Plan: Rust language pack (YKFA5X)

**Status:** implemented

_Reconciled against what shipped: all five Decisions held as written (no mid-build
reversals) — directory-convention Rust extraction, hand-rolled TOML subset, a single
`cargo-manifest.ts` parser module, manifest-keyed dispatch, and black-box drift via
`--check`. Arch alignment holds (pure derive/parse, honest "not introspected" for a
root-only crate, JS/Go byte-identical). Two additions beyond the original plan are
recorded under Known deviations: the `runArchitecture` fixture lift and the
verify-phase rework of `readCargoWorkspaceMembers` (a /quality-review fix, not a
design change)._

## Approach

Outside-in TDD over the same three production seams ZD70P1 proved, plus a new
TOML-subset parser. The new risk vs Go is TOML (multi-line arrays, dependency
tables) — so the parser gets the hardest unit tests and degrades gracefully on
anything outside the documented subset. Build order — keystone (extraction) first so
single-crate Rust turns green, then discovery wires the workspace, then fingerprint
closes drift:

1. **TOML-subset parser** — `cargo-manifest.ts` (new): `readCargoWorkspaceMembers`
   (the `[workspace] members = [..]` array, multi-line + single-line), `readCargoPackageName`
   (`[package] name`), `readCargoDependencyNames` (keys under `[dependencies]` /
   `[dev-dependencies]` / `[build-dependencies]`, table-scoped). Dependency-free;
   returns empty/undefined on anything it can't parse. _Unit_ (`cargo-manifest.test.ts`).
   This co-locates all Cargo parsing in one module from the start (ZD70P1 deferred a
   `go-manifest.ts` for rule-of-three; with Rust this is the second consumer-language,
   but a SINGLE-language module is still right — a shared multi-manifest module waits
   for the Python slice to justify it).
2. **Extraction (keystone)** — `architecture-skeleton.ts`: dispatch on `Cargo.toml` →
   list `src/` subdirs AND `src/*.rs` files, minus `lib.rs`/`main.rs`. TS `src/`-dir and
   Go branches unchanged. _Unit_ (`architecture-skeleton.test.ts`). Turns scenario 1 green.
3. **Discovery** — `architecture-monorepo.ts`: `detectCargoWorkspace` (via the parser)
   appended to the `??` chain; `hasRecognizedManifest` gains `Cargo.toml`; `packageName`
   falls back to `readCargoPackageName`. _Unit_ (`architecture-monorepo.test.ts`).
   Turns scenarios 2, 3, 5 green.
4. **Fingerprint** — `architecture-fingerprint.ts`: union `readCargoDependencyNames`
   into the dependency set. _Unit_ (`architecture-fingerprint.test.ts`). Turns scenario 4 green.
5. **Black-box BDD** — `steps/architecture-rust-language-pack.steps.ts` over real
   fixtures; reuses the shared When/Then vocabulary + `architecture-fixtures.ts`. NEW
   step: `the doc does not list the module "X"` (negative of the Go positive). The
   Cargo-drift AC is proven via `architecture --check` reporting stale.

Test-layer rationale: TOML parse / extract / fingerprint are pure → unit; which docs
appear and what `--check` reports are a process-boundary contract → the `.feature` lane.

## Decisions

| Decision            | Choice                                                              | Alternatives considered            | Rejected because                                                                  |
| ------------------- | ------------------------------------------------------------------- | ---------------------------------- | --------------------------------------------------------------------------------- |
| Rust extraction     | src/ subdirs AND src/\*.rs files, minus lib.rs/main.rs roots        | Dir-only (reuse as-is)             | Rust modules are commonly FILES — dir-only leaves real crates "not introspected"  |
| Cargo.toml parsing  | Hand-rolled TOML subset (members array, package name, dep tables)   | A TOML library / `cargo metadata`  | Zero-dep posture; `cargo metadata` needs a toolchain. Degrade gracefully.         |
| Parser home         | One `cargo-manifest.ts` module for all Cargo parsing                | Inline per consumer (like Go)      | Three Cargo readers in one slice — co-locate now; multi-lang merge waits (Python) |
| Extraction dispatch | Manifest-keyed: Cargo.toml → Rust branch, else src-dir, else go.mod | Augment src-dir path conditionally | Manifest dispatch keeps each language's branch isolated, zero TS/Go regression    |
| Drift coverage      | Black-box scenario via `architecture --check` + a unit pin          | Unit only                          | The fingerprint is observable (frontmatter + `--check`), per ZD70P1 review        |

## Arch alignment

- **Deterministic, LLM-free engine** — TOML parse / extraction / fingerprint are pure
  derive/parse; no new source of truth, no LLM, no toolchain shell-out.
- **Never silently wrong** — a root-only crate stays the honest "not introspected"
  marker; Cargo `exclude` over-inclusion is visible, documented out-of-scope.
- **Polyglot promise** — Rust plugs into the same heal-target + fingerprint machinery
  as JS and Go; the third pack (Python) reuses the seam, and at that point the
  multi-manifest discovery/parse consolidation (ZD70P1's deferred trigger) is revisited.

## Known deviations

- Cargo parsing lives in a new `cargo-manifest.ts` rather than inline (Go kept its
  readers inline). Justified: three Cargo readers ship together, so co-location is
  warranted now; the cross-language merge of detect\* discovery still waits for Python.
- `runArchitecture` (the CLI-spawn step helper) was lifted from the Go step file into
  `steps/support/architecture-fixtures.ts` and is now imported by both the Go and Rust
  step files — a behavior-identical de-dup so the Rust lane didn't re-clone the logic.
- `readCargoWorkspaceMembers` was reworked during verify from a whole-file regex to a
  table-scoped, comment-stripped line scan (`workspaceMembersArrayBody`) after the
  /quality-review found the regex read the wrong `members` array (unscoped) and dropped
  members on a `]`-in-comment. A correctness fix within the same subset, not a scope or
  design change; two regression tests pin it.

## Assessment triggers

- **Python slice** lands → revisit merging `detectGoWork` / `detectPnpmWorkspaces` /
  `detectCargoWorkspace` into one multi-manifest discovery, and the per-language
  manifest modules into a shared dependency/identity reader.
- Inter-crate edges needed → requires a path/workspace-dep → crate-dir map (own slice).
- A crate uses `[workspace.dependencies]` inheritance or inline-table deps → revisit
  the dep-table parser (currently flat-key only).
