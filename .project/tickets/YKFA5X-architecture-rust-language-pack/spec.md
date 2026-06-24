# Spec: Rust language pack — Cargo workspace discovery, src extraction, Cargo.toml fingerprint

## Intent

Teach the generated architecture state-doc to introspect Rust projects — a
single-crate library/binary and a Cargo workspace — so a crate gets real structural
extraction (its top-level `src/` modules, both files and directories) and Cargo
dependency-drift detection, rather than the honest-but-empty "not introspected"
marker. Second of the WBM8JE language packs; reuses the per-language seam ZD70P1
proved for Go and extends it to a TOML manifest.

## Intake Brief

- **Requested by:** WBM8JE epic continuation (the user, after ZD70P1 shipped) — the
  second of the three deferred language packs.
- **Cost of inaction:** A Rust project (single-crate or Cargo workspace) gets no
  architecture doc, or — in a mixed JS+Rust monorepo — its Rust crates stay marked
  "not introspected." The polyglot promise reads as "JS + Go only."
- **Reversibility:** Two-way door. Pure addition behind the existing manifest-keyed
  seam; JS/TS/Go behavior is regression-guarded and unchanged. No data-model or
  public-API change — the doc format and fingerprint inputs only gain Rust entries.

## References

- Parent epic **WBM8JE**; sibling **ZD70P1** (Go pack — the seam this reuses).
- Verified this session: doc.rust-lang.org/cargo/reference/workspaces.html
  (`[workspace] members` = path-glob array + `exclude`) and the Rust module layout
  (`src/<name>.rs` file OR `src/<name>/` dir; `lib.rs`/`main.rs` are roots).
- Seams: `architecture-skeleton.ts` (extraction), `architecture-monorepo.ts`
  (discovery), `architecture-fingerprint.ts` (drift).

## Personas

- **Technical Builder (TB)** — here, in its Rust/polyglot flavor: a developer running
  an AI coding agent on a repo (or monorepo) that mixes Rust with TypeScript/Go, or is
  pure Rust. TB is stack-agnostic by definition; they want the architecture doc to
  describe the Rust code, not skip it.

## Vocabulary

- **Cargo workspace** — a `Cargo.toml` with a `[workspace]` table whose `members`
  array lists member-crate directories (path globs); the Rust analogue of
  `package.json` workspaces / `go.work`.
- **Crate** — a Rust compilation unit with its own `Cargo.toml`; the leaf package.
- **Rust module** — a top-level item under `src/`: a `src/<name>.rs` file or a
  `src/<name>/` directory. `src/lib.rs` and `src/main.rs` are crate roots, not modules.
- **Introspected** — a crate with a recognized source layout (so it gets a real leaf
  doc), vs. "not introspected" (listed but explicitly undescribed).

## Jobs To Be Done

### architecture-rust-language-pack.TB1 — See my Rust crate's structure in the doc

**Persona:** Technical Builder (TB)

> When I generate the architecture doc for a Rust project, I want its top-level `src/`
> modules (files and directories) listed with the same structure a TypeScript or Go
> repo gets, so I can review and annotate the real shape instead of an empty placeholder.

#### architecture-rust-language-pack.TB1.AC1 — A single-crate Rust project produces a doc listing its top-level src/ modules (files and dirs), excluding the crate roots

#### architecture-rust-language-pack.TB1.AC2 — A Cargo workspace produces a root index plus a leaf doc per crate with a recognized layout

### architecture-rust-language-pack.TB2 — Catch Cargo dependency drift, and never lose my other-language docs

**Persona:** Technical Builder (TB)

> When a crate's Cargo dependencies change, I want the architecture doc to register the
> drift; and when my repo mixes Rust and JS, I want both introspected and my existing
> JS docs untouched, so the doc stays trustworthy across languages.

#### architecture-rust-language-pack.TB2.AC1 — Adding/removing a dependency in a crate's Cargo.toml moves that crate's shape-fingerprint

#### architecture-rust-language-pack.TB2.AC2 — A mixed JS+Rust monorepo introspects both, with the JS output byte-identical to today

#### architecture-rust-language-pack.TB2.AC3 — A pure JS/TS (or Go) repo's discovery, extraction, and fingerprint are unchanged (no regression)

## Outcomes

- A Rust project — single-crate or Cargo workspace — gets a real, structurally
  accurate architecture doc with zero hand-run commands, identical in shape to what
  npm/pnpm/go.work projects already get.
- Cargo dependency drift is a first-class drift signal (fingerprint moves).
- The polyglot promise holds across three languages: mixing Rust and JS introspects
  both; the JS half is provably unchanged.

## Open Questions

- none — resolved during intake against the read seams and Rust primary docs. The
  files-vs-dirs extraction fork is decided (files-and-dirs, per Rust convention); TOML
  edge cases (`exclude`, workspace-dep inheritance, inline-table deps, module nesting)
  are explicit out-of-scope limitations in ticket.md, not open questions.
