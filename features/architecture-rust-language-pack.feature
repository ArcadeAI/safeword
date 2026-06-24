@architecture-rust-language-pack
Feature: Rust language pack — Cargo workspace discovery, src extraction, Cargo.toml fingerprint

  The generated architecture doc must introspect Rust projects the same way it does
  TypeScript and Go ones: a single-crate project and a Cargo workspace each get a real
  structural doc built from the crate's top-level src/ modules (files AND directories,
  excluding the lib.rs/main.rs roots), Cargo dependency changes register as drift, and
  a polyglot repo introspects Rust and JS together without disturbing the JS output.
  Incomplete is fine (a root-only crate stays honestly "not introspected"); silently
  wrong or JS-regressing is not.

  Rule: Rust projects get real structural extraction and drift detection

    @architecture-rust-language-pack.TB1.AC1
    Scenario: A single-crate Rust project lists its src modules, files and dirs, not the root
      Given a single-crate Rust project with a module file "config", a module dir "handlers", and a lib.rs root
      When safeword generates the architecture doc
      Then the generated doc is a single-repo module doc, not a package root index
      And the doc lists the module "config"
      And the doc lists the module "handlers"
      And the doc does not list the module "lib"

    @architecture-rust-language-pack.TB1.AC2
    Scenario: A Cargo workspace produces a root index and per-crate leaf docs
      Given a Cargo workspace listing a crate "svc" with src modules
      When safeword generates the architecture doc
      Then a root index lists the package "svc"
      And the package "svc" has its own colocated leaf doc

    @architecture-rust-language-pack.TB1.AC1
    Scenario: A crate with only a root file is marked, not introspected
      Given a Cargo workspace with a crate "bare" that has only a lib.rs root
      When safeword generates the architecture doc
      Then the package "bare" is marked "not introspected" in the root index
      And the package "bare" line does not show the "awaiting prose" placeholder
      And the package "bare" has no colocated leaf doc

    @architecture-rust-language-pack.TB2.AC1
    Scenario: Adding a Cargo dependency makes the architecture doc go stale
      Given a single-crate Rust project with src modules whose architecture doc has been generated
      When a dependency is added to its Cargo.toml
      And safeword checks the architecture doc
      Then safeword reports the architecture doc is stale

  Rule: Polyglot repos introspect every language without regressing JS

    @architecture-rust-language-pack.TB2.AC2
    Scenario: A mixed JS and Rust monorepo introspects both packages
      Given a monorepo whose workspaces include a JS package "web" with a src tree and a Rust crate "svc" with src modules
      When safeword generates the architecture doc
      Then the package "web" has its own colocated leaf doc
      And the package "svc" has its own colocated leaf doc

    @architecture-rust-language-pack.TB2.AC3
    Scenario: A pure JS single-repo is unchanged by the Rust extractor
      Given a single-repo project with a src tree and no workspace config
      When safeword generates the architecture doc
      Then the generated doc is a single-repo module doc, not a package root index
      And the doc lists the module "core"
