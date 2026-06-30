@architecture-unreadable-workspace
Feature: A present-but-unparseable workspace manager is surfaced, not dropped

  safeword unions every workspace manager when it builds the architecture map
  (#554). But a manager whose root manifest is PRESENT yet unparseable — a
  malformed go.work, an unreadable Cargo [workspace] members array, a flow-style
  pnpm-workspace.yaml — used to contribute zero packages with no marker, so a
  whole language could vanish silently. Coverage honesty: "incomplete is fine,
  silently wrong is not." A present manager safeword cannot read must be named,
  never dropped. Advisory only — it never blocks.

  Rule: An unparseable manager is surfaced in the root index alongside the readable ones

    @architecture-unreadable-workspace.UWP4XK.AC1
    Scenario: A malformed go.work next to a working JS package is named, not dropped
      Given a monorepo with a working JS package "web" and a malformed go.work
      When safeword generates the architecture doc
      Then the root index lists the package "web"
      And the root index notes "go.work" as an unreadable workspace config

    @architecture-unreadable-workspace.UWP4XK.AC2
    Scenario: An unreadable Cargo [workspace] members array next to a Python package is named
      Given a monorepo with a Python package "pytool" and a Cargo.toml whose [workspace] members are unreadable
      When safeword generates the architecture doc
      Then the root index lists the package "pytool"
      And the root index notes "Cargo.toml" as an unreadable workspace config

    @architecture-unreadable-workspace.UWP4XK.AC3
    Scenario: A flow-style pnpm-workspace.yaml next to a Go module is named
      Given a monorepo with a Go module "gosvc" and a flow-style pnpm-workspace.yaml
      When safeword generates the architecture doc
      Then the root index lists the package "gosvc"
      And the root index notes "pnpm-workspace.yaml" as an unreadable workspace config

  Rule: The surface is advisory and never a false alarm

    @architecture-unreadable-workspace.UWP4XK.AC4
    Scenario: The only-unparseable case is warned about without blocking the command
      Given a project whose only workspace config is a malformed go.work
      When safeword refreshes the architecture doc and captures its output
      Then the command succeeds
      And the output warns that "go.work" is an unreadable workspace config

    @architecture-unreadable-workspace.UWP4XK.AC5
    Scenario: A single crate with no [workspace] table raises no unreadable signal
      Given a monorepo with a Go module "gosvc" and a single-crate Cargo.toml with no workspace table
      When safeword generates the architecture doc
      Then the root index lists the package "gosvc"
      And the root index has no "Coverage gaps" advisory
