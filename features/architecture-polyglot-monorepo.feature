@architecture-polyglot-monorepo
Feature: Polyglot monorepo coverage — union all workspace managers

  When a monorepo declares packages with more than one workspace manager at once
  (e.g. package.json workspaces for JS and go.work for Go), the generated root
  index must list EVERY package, not just the first manager's. Workspace managers
  for different language ecosystems are additive — dropping one silently omits a
  whole language from the map. (Within JS, package.json still wins over pnpm —
  those are alternatives, not additions; proven in monorepo-coverage-honesty.)

  Rule: Cross-ecosystem workspace managers are unioned in discovery

    @architecture-polyglot-monorepo.MGWZ4P.AC1
    Scenario: A JS + Go monorepo lists both the JS package and the Go module
      Given a monorepo whose package.json workspaces list a JS package "web" and whose go.work lists a Go module "gosvc"
      When safeword generates the architecture doc
      Then the root index lists the package "web"
      And the root index lists the package "gosvc"

    @architecture-polyglot-monorepo.MGWZ4P.AC2
    Scenario: A Go + Rust + Python monorepo with no JS lists all three
      Given a polyglot monorepo with a Go module "gosvc", a Rust crate "rscore", and a Python package "pytool"
      When safeword generates the architecture doc
      Then the root index lists the package "gosvc"
      And the root index lists the package "rscore"
      And the root index lists the package "pytool"
