# Dimensions: Rust language pack (YKFA5X)

| Dimension          | Partitions                                                                                       | Source      |
| ------------------ | ------------------------------------------------------------------------------------------------ | ----------- |
| Project shape      | single-crate (no workspace) · Cargo workspace · JS-rooted monorepo containing a Rust crate       | TB1, TB2    |
| Source layout      | Rust modules (src/ files + dirs) · `src/` (JS/TS) · only crate root (lib.rs/main.rs, no modules) | TB1.AC1     |
| Module kind (Rust) | `src/<name>.rs` file · `src/<name>/` dir · `src/lib.rs` / `src/main.rs` root (excluded)          | TB1.AC1     |
| Discovery source   | Cargo `[workspace] members` · package.json workspaces (JS) · go.work · none                      | TB1.AC2     |
| Fingerprint input  | Cargo `[dependencies]`/`[dev-dependencies]`/`[build-dependencies]` keys · package.json deps      | TB2.AC1     |
| Regression surface | JS single-repo output · JS leaf output in a polyglot monorepo (must be unchanged)                | TB2.AC2/AC3 |

## Partition → scenario mapping

- single-crate × Rust modules (file + dir) → TB1.AC1 (module doc lists both, roots excluded).
- Cargo workspace × Rust modules → TB1.AC2 (root index + Rust leaf doc).
- single-crate × only crate root → TB1.AC1 honesty edge ("not introspected", no modules).
- JS-rooted monorepo × (src + Rust crate) → TB2.AC2 (both introspected).
- single-repo × src → TB2.AC3 (JS module doc unchanged — regression guard).
- Cargo `[dependencies]` add/remove → TB2.AC1, BLACK-BOX: the dependency set feeds the
  shape-fingerprint, written into the doc frontmatter and surfaced by `architecture
--check`, so adding a dep makes the doc go stale (`--check` reports it). A unit test
  pins the fingerprint composition beneath it. (Same observable-drift split ZD70P1 used.)

## Boundary notes

- **Extraction (Rust):** modules = top-level `src/` subdirectories AND `src/*.rs` files,
  minus `lib.rs`/`main.rs` (crate roots). A crate with only a root file → empty skeleton
  → honest "not introspected". `mod.rs` and nested `src/foo/bar.rs` are not top-level, so
  not listed (module nesting is out of scope).
- **Extraction precedence:** dispatch on manifest — a `Cargo.toml` directory uses the
  Rust branch; TS `src/`-dir and Go (`go.mod`) branches are unchanged. A pure TS/Go repo
  has no Cargo.toml, so its output is byte-identical.
- **Discovery precedence:** `package.json workspaces` ?? `pnpm-workspace.yaml` ??
  `go.work` ?? Cargo `[workspace]`. A JS-rooted monorepo containing a Rust crate still
  discovers the crate (keep-predicate is "has package.json OR go.mod OR Cargo.toml").
- **Crate identity:** name = Cargo.toml `[package] name`, fallback directory basename.
- **Out of scope here:** Cargo `exclude`, inter-crate edges, module nesting/`mod.rs`,
  `[workspace.dependencies]` inheritance / inline-table / feature / target deps, both a
  Cargo workspace and package.json workspaces at the repo root (JS wins), Python pack.
