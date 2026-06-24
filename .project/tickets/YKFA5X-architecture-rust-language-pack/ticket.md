---
id: YKFA5X
slug: architecture-rust-language-pack
type: feature
phase: scenario-gate
status: in_progress
created: 2026-06-24T04:07:49.850Z
last_modified: 2026-06-24T04:12:00.000Z
scope:
  - Rust module extraction — extractSkeleton, when a directory has a `Cargo.toml`, lists the top-level `src/` modules = subdirectories AND `src/*.rs` files (excluding the crate roots `lib.rs` / `main.rs`), so a real Rust crate (whose modules are commonly files, not dirs) is introspected instead of marked "not introspected"
  - Cargo workspace discovery — detectCargoWorkspace parses `[workspace] members = [globs]` (a dependency-free TOML-subset parse of the multi-line and single-line array forms), appended to the `??` discovery chain after the JS and Go sources
  - Generalized leaf predicate — discoverLeafDirectories keeps a discovered directory that has a recognized manifest (`package.json` OR `go.mod` OR `Cargo.toml`)
  - Cargo fingerprint input — the shape-fingerprint's dependency set includes the `[dependencies]` / `[dev-dependencies]` / `[build-dependencies]` table keys (names, not versions), so Rust dependency drift moves the crate's fingerprint
  - Rust crate identity — a crate's name comes from its Cargo.toml `[package] name` (fallback: directory basename), mirroring JS `name` / Go `module`
  - Tests (unit + black-box BDD over real Rust fixtures: single-crate Rust, Cargo workspace, mixed JS+Rust monorepo) and a no-regression guarantee for JS/TS/Go repos
out_of_scope:
  - Cargo `[workspace] exclude` — a member glob plus an excluded crate may over-list the excluded crate; a noted limitation (over-inclusion is visible, not silently dropped)
  - Inter-crate dependency EDGES in the root index (mapping a `path`/workspace dependency back to a crate directory) — Rust leaves render with no edges in this slice; defer to a follow-up
  - Module CONTENTS / nesting — only the TOP-level `src/` modules are listed; `src/foo/bar.rs`, a module's internals, and `mod.rs` resolution are out
  - `[workspace.dependencies]` inheritance, target-specific deps, optional/feature deps, build-target tables — out (the three flat dependency tables cover the common case)
  - Mixed ROOT polyglot where both a Cargo `[workspace]` and `package.json` workspaces sit at the repo root — JS wins the `??` chain; a noted limitation
  - Python language pack — separate WBM8JE slice
  - Changing the JS/TS/Go discovery, extraction, or fingerprint behavior in any observable way (pure addition; regression-guarded)
done_when:
  - A single-crate Rust project (Cargo.toml + src/ with module files and/or dirs) produces an architecture doc listing those modules — today it produces nothing
  - A Cargo workspace produces a root index + a colocated leaf doc per crate that has src/ modules — the same shape an npm/pnpm/go.work monorepo gets
  - A dependency added to or removed from a crate's Cargo.toml `[dependencies]` moves that crate's shape-fingerprint (drift is caught)
  - A mixed JS+Rust monorepo introspects both the JS and the Rust packages; the JS packages are byte-identical to today
  - JS/TS and Go behavior is unchanged (no regression); `safeword architecture --check` still passes on this repo
  - All scenarios in features/architecture-rust-language-pack.feature pass via the BDD lane; full suite green
---

# Rust language pack — Cargo workspace discovery, src extraction, Cargo.toml fingerprint

**Goal:** Teach the generated architecture doc to introspect **Rust** projects —
single-crate and Cargo workspace — so a crate gets real structural extraction (its
top-level `src/` modules, files _and_ dirs) and Cargo dependency-drift detection,
instead of the "not introspected" marker. Second WBM8JE language pack; reuses the
seam ZD70P1 proved for Go.

**See:** [spec.md](./spec.md) for personas, jobs-to-be-done, and outcomes.

## Parent epic

Second slice of **WBM8JE** (per-language extractors), after **ZD70P1** (Go). The
three-axis seam — discovery source + manifest-keyed `extractSkeleton` branch +
manifest dependency set — is now proven twice; Python is the third slice.

## Resolved design (grounded in the seams + Rust conventions)

Verified against doc.rust-lang.org/cargo (this session): `[workspace] members =
["crates/*", …]` is an array of path globs; a Rust module is `src/<name>.rs` OR
`src/<name>/` (dir), with `src/lib.rs` / `src/main.rs` the crate roots. So, unlike
Go (dirs only) and TS (dirs by convention), **Rust needs files-and-dirs extraction**
— dir-only would leave most real crates "not introspected".

1. **Extraction** — `extractSkeleton`: dispatch on `Cargo.toml` → list `src/`
   subdirectories AND `src/*.rs` files, minus the `lib.rs`/`main.rs` roots. (TS
   `src/`-dir and Go branches unchanged; a pure TS/Go repo never has a Cargo.toml.)
2. **Discovery** — `detectCargoWorkspace` (TOML-subset `members` array parse) appended
   to the `??` chain; keep-predicate gains `Cargo.toml`.
3. **Fingerprint** — union the `[dependencies]`/`[dev-dependencies]`/`[build-dependencies]`
   table keys into the dependency set.

**Rejected:** a TOML library dependency (the zero-dep posture holds — parse only the
documented subset and degrade gracefully, like the go.mod/pnpm hand-parses); a Rust
AST/`cargo metadata` shell-out (heavy, needs a toolchain); inter-crate edges and
module nesting (their own concerns).

## Open questions

- none — the files-vs-dirs extraction fork is resolved (files-and-dirs, per Rust
  convention); TOML edge cases (`exclude`, workspace-dep inheritance, multi-line
  inline tables) are explicit out-of-scope limitations, not open questions.

## Work Log

- 2026-06-24T04:07:49.850Z Started: Created ticket YKFA5X.
- 2026-06-24T04:12:00Z Intake: sliced WBM8JE → Rust pack second (TOML manifest seam;
  src/ extraction partly reused). Verified Cargo workspace + Rust module layout
  against primary docs. Key resolved fork: Rust extraction lists src/ files AND dirs
  (Rust modules are commonly files), a manifest-keyed branch mirroring Go. TOML
  hand-parsed (zero-dep posture; only a transitive `toml` exists, unsafe to rely on,
  and the CLI must run under Node). Next: define-behavior.
