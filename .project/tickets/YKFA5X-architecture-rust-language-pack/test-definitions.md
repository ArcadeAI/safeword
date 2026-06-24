# Test Definitions: Rust language pack (YKFA5X)

Feature source: `features/architecture-rust-language-pack.feature`

test-definitions.md is the R/G/R ledger. The black-box `.feature` lane proves the
observable doc-coverage behaviors — including Cargo dependency drift, which is
observable (the shape-fingerprint is written into the doc frontmatter and surfaced by
`architecture --check`). Fine-grained TOML-subset parser and extractor internals are
pinned by unit tests as a secondary layer, listed under "Unit-pinned" below.

## Rule: Rust projects get real structural extraction and drift detection

### Scenario: A single-crate Rust project lists its src modules, files and dirs, not the root

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A Cargo workspace produces a root index and per-crate leaf docs

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A crate with only a root file is marked, not introspected

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Adding a Cargo dependency makes the architecture doc go stale

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: Polyglot repos introspect every language without regressing JS

### Scenario: A mixed JS and Rust monorepo introspects both packages

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A pure JS single-repo is unchanged by the Rust extractor

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## New step definitions (on the critical path — must be authored at RED)

- **`the doc does not list the module "X"`** — NEW negative Then (the existing Go
  step only has the positive `the doc lists the module "X"`). Asserts
  `assert.doesNotMatch(rootDoc(world), /^### X$/m)`. Scenario 1's root-exclusion
  assertion (`lib.rs` not listed) depends on it; without it that step no-ops as
  undefined/pending. Rust-specific Givens (single-crate, Cargo workspace, file/dir
  modules, root-only crate, mixed JS+Rust) are also new and live in the new
  `steps/architecture-rust-language-pack.steps.ts`.

## Scenario notes (coverage honesty)

- **Scenario 1's load-bearing RED is the `config` (file) assertion.** A Rust crate
  with a module DIR already gets a `## Modules` doc today, so `lists "handlers"`,
  `single-repo module doc`, and `does not list "lib"` all pass pre-implementation;
  only `lists the module "config"` (a `src/config.rs` FILE) is RED today. Do NOT
  weaken the fixture to a dir-only module — that would make the scenario vacuous.

## Unit-pinned (secondary — fine-grained internals beneath the black-box scenarios)

- **TB2.AC1 fine-grain — Cargo dependency fingerprint:** adding/removing a key in a
  crate's `[dependencies]` / `[dev-dependencies]` / `[build-dependencies]` changes
  `shapeFingerprint` for that directory while a JS package's fingerprint is untouched;
  a version bump does NOT move it (versions excluded). `architecture-fingerprint.test.ts`.
- **detectCargoWorkspace parse:** `[workspace] members = [..]` multi-line and
  single-line array forms, comments, quotes; a Cargo.toml with no `[workspace]` table →
  `undefined`; a member glob expands like the JS/Go globs. `architecture-monorepo.test.ts`.
- **extractSkeleton Rust layout:** `Cargo.toml` + `src/<name>.rs` files AND `src/<name>/`
  dirs → those modules, `lib.rs`/`main.rs` excluded; a crate with only a root file →
  empty skeleton; `src/`-dir (TS) and `go.mod` (Go) branches unchanged.
  `architecture-skeleton.test.ts`.
- **Crate identity:** name from `[package] name`, fallback basename. `architecture-monorepo.test.ts`.
