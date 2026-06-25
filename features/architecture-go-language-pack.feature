@architecture-go-language-pack
Feature: Go language pack — architecture discovery, extraction, fingerprint

  The generated architecture doc must introspect Go projects the same way it does
  TypeScript ones: a single-repo Go service and a go.work monorepo each get a real
  structural doc built from the Go layout (cmd/internal/pkg), Go dependency changes
  register as drift, and a polyglot repo introspects Go and JS together without
  disturbing the existing JS output. Incomplete is fine (a flat Go package stays
  honestly "not introspected"); silently wrong or JS-regressing is not.

  Rule: Go projects get real structural extraction and drift detection

    @architecture-go-language-pack.TB1.AC1
    Scenario: A single-repo Go project produces a module doc from its Go layout
      Given a single-repo Go project with cmd, internal, and pkg directories
      When safeword generates the architecture doc
      Then the generated doc is a single-repo module doc, not a package root index
      And the doc lists the module "cmd"
      And the doc lists the module "internal"
      And the doc lists the module "pkg"

    @architecture-go-language-pack.TB1.AC2
    Scenario: A go.work monorepo produces a root index and per-package leaf docs
      Given a go.work monorepo listing a Go package "svc" with a cmd/internal/pkg layout
      When safeword generates the architecture doc
      Then a root index lists the package "svc"
      And the package "svc" has its own colocated leaf doc

    @architecture-go-language-pack.TB1.AC1
    Scenario: A flat Go package with no recognized layout is marked, not introspected
      Given a go.work monorepo with a Go package "flat" that has only top-level Go files
      When safeword generates the architecture doc
      Then the package "flat" is marked "not introspected" in the root index
      And the package "flat" line does not show the "awaiting prose" placeholder
      And the package "flat" has no colocated leaf doc

    @architecture-go-language-pack.TB1.AC2
    Scenario: A go.work with an unreadable entry still introspects its readable packages
      Given a go.work monorepo listing a Go package "svc" with a cmd/internal/pkg layout alongside an unreadable use entry
      When safeword generates the architecture doc
      Then the command succeeds
      And a root index lists the package "svc"
      And the package "svc" has its own colocated leaf doc

    @architecture-go-language-pack.TB2.AC1
    Scenario: Adding a Go dependency makes the architecture doc go stale
      Given a single-repo Go project with cmd, internal, and pkg directories whose architecture doc has been generated
      When a require is added to its go.mod
      And safeword checks the architecture doc
      Then safeword reports the architecture doc is stale

  Rule: Polyglot repos introspect both languages without regressing JS

    @architecture-go-language-pack.TB2.AC2
    Scenario: A mixed JS and Go monorepo introspects both packages
      Given a monorepo whose workspaces include a JS package "web" with a src tree and a Go package "svc" with a cmd/internal/pkg layout
      When safeword generates the architecture doc
      Then the package "web" has its own colocated leaf doc
      And the package "svc" has its own colocated leaf doc

    @architecture-go-language-pack.TB2.AC3
    Scenario: A pure JS single-repo is unchanged by the Go extractor
      Given a single-repo project with a src tree and no workspace config
      When safeword generates the architecture doc
      Then the generated doc is a single-repo module doc, not a package root index
      And the doc lists the module "core"
