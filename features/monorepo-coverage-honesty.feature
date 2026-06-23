@monorepo-coverage-honesty
Feature: Honest monorepo coverage — pnpm discovery + un-introspected marker

  The generated architecture doc must cover pnpm monorepos (which store their
  workspace list in pnpm-workspace.yaml, not package.json), and the derived root
  index must never list a package safeword couldn't introspect as if it were a
  described-but-empty module. Incomplete is fine; silently wrong is not.

  Rule: A pnpm monorepo is discovered, without changing existing discovery

    @monorepo-coverage-honesty.TB1.AC1
    Scenario: A pnpm monorepo produces a root index and per-package leaf docs
      Given a pnpm monorepo whose pnpm-workspace.yaml lists a package "web" with a src tree
      When the architecture doc is generated
      Then a root index lists the package "web"
      And the package "web" has its own colocated leaf doc

    @monorepo-coverage-honesty.TB1.AC2
    Scenario: A single repo with no workspace config stays a single-repo doc
      Given a single-repo project with a src tree and no workspace config
      When the architecture doc is generated
      Then the generated doc is a single-repo module doc, not a package root index
      And no colocated leaf docs are generated

    @monorepo-coverage-honesty.TB1.AC2
    Scenario: An npm-workspaces monorepo is still discovered
      Given an npm monorepo whose package.json workspaces list a package "web" with a src tree
      When the architecture doc is generated
      Then a root index lists the package "web"
      And the package "web" has its own colocated leaf doc

    @monorepo-coverage-honesty.TB1.AC2
    Scenario: package.json workspaces win when both config files are present
      Given a monorepo whose package.json workspaces list "web" and whose pnpm-workspace.yaml lists "svc"
      When the architecture doc is generated
      Then the root index lists the package "web"
      And the root index does not list the package "svc"

    @monorepo-coverage-honesty.TB1.AC1
    Scenario: A pnpm-workspace.yaml the parser cannot read degrades gracefully
      Given a pnpm monorepo whose pnpm-workspace.yaml uses unparseable flow-style packages
      When the architecture doc is generated
      Then the command succeeds
      And no colocated leaf docs are generated

  Rule: The root index is honest about packages it cannot introspect

    @monorepo-coverage-honesty.TB2.AC1
    Scenario: A package with no recognized source layout is marked, not placeholdered
      Given a pnpm monorepo with a package "svc" that has no src tree
      When the architecture doc is generated
      Then the package "svc" is marked "not introspected" in the root index
      And the package "svc" line does not show the "awaiting prose" placeholder
      And the package "svc" has no colocated leaf doc

    @monorepo-coverage-honesty.TB2.AC2
    Scenario: In a mixed monorepo, only the un-introspected package carries the marker
      Given a pnpm monorepo with a package "web" that has a src tree and a package "svc" that has no src tree
      When the architecture doc is generated
      Then the package "svc" is marked "not introspected" in the root index
      And the package "web" is not marked "not introspected" in the root index
      And the package "web" has its own colocated leaf doc
