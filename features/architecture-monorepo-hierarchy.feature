@architecture-monorepo-hierarchy
Feature: Hierarchical architecture docs for monorepos (Slice 3)

  Extends the always-fresh architecture doc to monorepos with progressive
  disclosure: a thin derived root index (.project/architecture.generated.md) maps
  every workspace package, and each package with a src/ tree carries a colocated
  leaf doc (packages/<pkg>/architecture.generated.md) fingerprinted over its own
  structure. Every node self-heals and is enforced independently (Slices 1–2 per
  node), and a single-repo project is byte-identical to before.

  Rule: A monorepo gets a derived root index over its packages

    @architecture-monorepo-hierarchy.NTB1.AC1
    Scenario: The root index lists every package with a purpose and the dependency edges
      Given a monorepo with packages core and web where web depends on core
      When the architecture docs are generated
      Then the root index lists the packages core and web
      And the root index records a dependency edge from web to core
      And each listed package carries a one-line purpose

    @architecture-monorepo-hierarchy.NTB1.AC1
    Scenario: The root index is still written when no package has a src tree
      Given a monorepo with packages site and docs that have no src modules
      When the architecture docs are generated
      Then the root index is written listing the packages site and docs
      And no leaf docs are written

    @architecture-monorepo-hierarchy.NTB1.AC2
    Scenario: Adding a package updates the root index without hand-editing
      Given a monorepo whose root index already lists packages core and web
      When a new package billing is added and the architecture docs are regenerated
      Then the root index lists the package billing
      And the root index still lists the packages core and web

    @architecture-monorepo-hierarchy.NTB1.AC2
    Scenario: Removing a package drops it from the root index
      Given a monorepo whose root index already lists packages core and web
      When the package web is removed and the architecture docs are regenerated
      Then the root index no longer lists the package web
      And the root index still lists the package core

  Rule: Each package's structure is a colocated, independently-fingerprinted leaf

    @architecture-monorepo-hierarchy.TB1.AC1
    Scenario: A package with a src tree gets a colocated leaf doc with its own fingerprint
      Given a monorepo with a package core that has a src tree
      When the architecture docs are generated
      Then a leaf doc is written at packages/core/architecture.generated.md
      And the leaf doc's fingerprint matches the core package's own structure

    @architecture-monorepo-hierarchy.TB1.AC2
    Scenario: A package with no modules gets a root entry but no leaf doc
      Given a monorepo with a package site that has no src modules
      When the architecture docs are generated
      Then no leaf doc is written for the site package
      And the root index still lists the package site

  Rule: Freshness is attributed per node

    @architecture-monorepo-hierarchy.TB1.AC3
    Scenario: A change in one package re-syncs only that package's leaf
      Given a monorepo whose docs are all freshly generated
      When a module is added inside the package core and the docs are regenerated
      Then the leaf doc for core is re-synced to the change
      And the leaf doc for the unchanged package web is left untouched

    @architecture-monorepo-hierarchy.TB2.AC1
    Scenario Outline: A change moves only the fingerprint of the node that owns it
      Given a monorepo whose docs are all freshly generated
      When the monorepo changes by <change>
      Then the <node> doc is re-synced
      And the <other> doc is left untouched

      Examples:
        | change                                    | node | other |
        | adding a module inside one package        | leaf | root  |
        | adding a new package to the workspace     | root | leaf  |
        | adding an inter-package dependency edge   | root | leaf  |

    @architecture-monorepo-hierarchy.TB2.AC1
    Scenario: Editing the shared boundary config re-syncs the root and no leaf
      Given a monorepo whose docs are all freshly generated
      When the shared dependency-cruiser boundary config is edited
      Then the root index is re-synced
      And every leaf doc is left untouched

  Rule: Enforcement fans out across root and every leaf

    @architecture-monorepo-hierarchy.TB2.AC2
    Scenario: The check fails when any single leaf is stale
      Given a monorepo whose docs are all freshly generated
      And one package has a structural change not yet reflected in its leaf doc
      When the architecture check runs across the monorepo
      Then the monorepo check exits non-zero

    @architecture-monorepo-hierarchy.TB2.AC2
    Scenario: The check passes when the root and every leaf are fresh
      Given a monorepo with a root index and two fresh leaf docs
      When the architecture check runs across the monorepo
      Then the monorepo check exits zero

    @architecture-monorepo-hierarchy.TB2.AC2
    Scenario: Staging refreshes and stages every changed node at once
      Given a monorepo whose docs are all freshly generated
      And both the package set and one package's structure have changed
      When the agent commits the monorepo
      Then the root index and the changed leaf doc are both staged
      And the monorepo commit is not blocked

    @architecture-monorepo-hierarchy.TB2.AC2
    Scenario: A foreign doc at a node path is left untouched and does not fail the check
      Given a monorepo whose docs are all freshly generated
      And a leaf path holds a doc with no safeword generator marker
      When the architecture check runs across the monorepo
      Then the monorepo check exits zero
      And the foreign leaf doc is left untouched

    @architecture-monorepo-hierarchy.TB2.AC2
    Scenario: Opting out passes the check even when a leaf is stale
      Given a monorepo with architectureDocEnforcement disabled
      And one package has a structural change not yet reflected in its leaf doc
      When the architecture check runs across the monorepo
      Then the monorepo check exits zero

  Rule: Single-repo behavior is unchanged

    @architecture-monorepo-hierarchy.TB2.AC3
    Scenario: A project with no workspaces produces exactly the single-repo doc
      Given a single-repo project with a src tree and no workspaces
      When the architecture docs are generated
      Then exactly one doc is written, at the single-repo location
      And that doc is byte-identical to the single-repo self-heal output for the same tree
      And no colocated leaf docs are written
