# Behavior source for BY7RNR (GitHub #848). The TB1 rules (done-gate nudge
# resolution) are @wip like bash-ledger-write-gate: their executable backing is
# Vitest hook coverage — git-backed integration tests over the standalone hook
# helper plus a differential parity test against the CLI resolver — and cucumber
# steps would duplicate that harness without adding confidence. The TB2 rules
# (CLI drift advisory) run in this lane against the real `safeword architecture`
# command, like architecture-unreadable-workspace.
@architecture-narrative-blindspots
Feature: Architecture narrative reconciliation reaches configured narratives and pre-existing drift

  The AXRC4D reconcile loop assumed the human architecture narrative lives at
  root ARCHITECTURE.md and that drift only appears when a ticket moves the
  shape. GitHub #848 showed a host where both assumptions fail at once: the
  narrative lives elsewhere (paths.architecture points at it), and the map
  disagreed with the narrative from day one — six generated packages, two whole
  product clusters, absent from the doc every agent session loads as ground
  truth. Nothing fired. The narrative stays human-owned: everything here is
  advisory, nothing blocks, no exit code changes.

  Rule: The done-gate nudge resolves the narrative via paths.architecture

    @wip @architecture-narrative-blindspots.TB1.AC1
    Scenario: A configured non-root narrative gets the nudge when a ticket moves the shape
      Given a project whose narrative lives at "docs/agents/architecture.md" and is configured via paths.architecture
      And the generated architecture map's fingerprint moved since the branch base
      When the done-gate checks for narrative staleness
      Then the reconcile advisory fires

    @wip @architecture-narrative-blindspots.TB1.AC1
    Scenario: A configured decision-record directory counts as a narrative
      Given a project whose paths.architecture points at a directory of decision records
      And the generated architecture map's fingerprint moved since the branch base
      When the done-gate checks for narrative staleness
      Then the reconcile advisory fires

    @wip @architecture-narrative-blindspots.TB1.AC1
    Scenario: A configured narrative that is missing on disk draws no advisory
      Given a project whose paths.architecture points at a file that does not exist
      And there is no root ARCHITECTURE.md
      And the generated architecture map's fingerprint moved since the branch base
      When the done-gate checks for narrative staleness
      Then no reconcile advisory fires

  Rule: Unconfigured hosts keep today's root-ARCHITECTURE.md behavior exactly

    @wip @architecture-narrative-blindspots.TB1.AC2
    Scenario: An unconfigured host with a root ARCHITECTURE.md still nudges on shape movement
      Given a project with a root ARCHITECTURE.md and no paths.architecture configured
      And the generated architecture map's fingerprint moved since the branch base
      When the done-gate checks for narrative staleness
      Then the reconcile advisory fires

    @wip @architecture-narrative-blindspots.TB1.AC2
    Scenario: An unconfigured host with no narrative anywhere stays silent
      Given a project with no root ARCHITECTURE.md and no paths.architecture configured
      And the generated architecture map's fingerprint moved since the branch base
      When the done-gate checks for narrative staleness
      Then no reconcile advisory fires

    @wip @architecture-narrative-blindspots.TB1.AC2
    Scenario: An unchanged fingerprint stays silent even with a configured narrative
      Given a project whose narrative lives at "docs/agents/architecture.md" and is configured via paths.architecture
      And the generated architecture map's fingerprint is unchanged since the branch base
      When the done-gate checks for narrative staleness
      Then no reconcile advisory fires

    @wip @architecture-narrative-blindspots.TB1.AC2
    Scenario: An unparseable config falls back to the root ARCHITECTURE.md
      Given a project with a root ARCHITECTURE.md and an unparseable .safeword/config.json
      And the generated architecture map's fingerprint moved since the branch base
      When the done-gate checks for narrative staleness
      Then the reconcile advisory fires

  Rule: The advisory names the narrative it is asking the builder to reconcile

    @wip @architecture-narrative-blindspots.TB1.AC3
    Scenario: A configured narrative is named in the advisory text
      Given a project whose narrative lives at "docs/agents/architecture.md" and is configured via paths.architecture
      And the generated architecture map's fingerprint moved since the branch base
      When the done-gate checks for narrative staleness
      Then the reconcile advisory names "docs/agents/architecture.md" as the document to reconcile

    @wip @architecture-narrative-blindspots.TB1.AC3
    Scenario: The root fallback is named as ARCHITECTURE.md
      Given a project with a root ARCHITECTURE.md and no paths.architecture configured
      And the generated architecture map's fingerprint moved since the branch base
      When the done-gate checks for narrative staleness
      Then the reconcile advisory names "ARCHITECTURE.md" as the document to reconcile

  Rule: The installed prompts direct agents to the configured narrative

    @wip @architecture-narrative-blindspots.TB1.AC4
    Scenario: The architecture review prompt resolves the narrative via paths.architecture
      Given the installed architecture review prompt
      Then it directs the agent to the paths.architecture narrative with root ARCHITECTURE.md as the fallback

    @wip @architecture-narrative-blindspots.TB1.AC4
    Scenario: The audit skill's structural-drift check resolves the narrative via paths.architecture
      Given the installed audit skill
      Then its structural-drift check directs the agent to the paths.architecture narrative with root ARCHITECTURE.md as the fallback

  Rule: Generated packages absent from the narrative are surfaced on every architecture run

    @architecture-narrative-blindspots.TB2.AC1
    Scenario: Packages the narrative never mentions are named in the run output
      Given a monorepo with JS packages "web" and "billing"
      And a root ARCHITECTURE.md narrative that mentions only "web"
      When safeword refreshes the architecture doc and captures its output
      Then the command succeeds
      And the output advises that the narrative does not mention "billing"

    @architecture-narrative-blindspots.TB2.AC1
    Scenario: A configured narrative location is scanned instead of the root file
      Given a monorepo with JS packages "web" and "billing"
      And a narrative at "docs/architecture.md" configured via paths.architecture that mentions only "web"
      When safeword refreshes the architecture doc and captures its output
      Then the command succeeds
      And the output advises that the narrative does not mention "billing"

    @architecture-narrative-blindspots.TB2.AC1
    Scenario: A long list of missing packages is capped with a tail count
      Given a monorepo with 8 JS packages none of which the root ARCHITECTURE.md narrative mentions
      When safeword refreshes the architecture doc and captures its output
      Then the command succeeds
      And the drift advisory names at most 6 packages and reports 2 more

  Rule: A reconciled or absent narrative draws no drift advisory

    @architecture-narrative-blindspots.TB2.AC2
    Scenario: A narrative mentioning every package stays silent
      Given a monorepo with JS packages "web" and "billing"
      And a root ARCHITECTURE.md narrative that mentions "web" and "billing"
      When safeword refreshes the architecture doc and captures its output
      Then the command succeeds
      And the output carries no narrative drift advisory

    @architecture-narrative-blindspots.TB2.AC2
    Scenario: A scoped package mentioned by its short name counts as mentioned
      Given a monorepo with the scoped JS package "@acme/design-system"
      And a root ARCHITECTURE.md narrative that mentions only "design-system"
      When safeword refreshes the architecture doc and captures its output
      Then the command succeeds
      And the output carries no narrative drift advisory

    @architecture-narrative-blindspots.TB2.AC2
    Scenario: A project with no narrative anywhere stays silent
      Given a monorepo with JS packages "web" and "billing" and no narrative document
      When safeword refreshes the architecture doc and captures its output
      Then the command succeeds
      And the output carries no narrative drift advisory

    @architecture-narrative-blindspots.TB2.AC2
    Scenario: A single-repo modules map is never scanned for narrative drift
      Given a single-repo project with source modules and a root ARCHITECTURE.md narrative that mentions none of them
      When safeword refreshes the architecture doc and captures its output
      Then the command succeeds
      And the output carries no narrative drift advisory

  Rule: The drift advisory never changes an exit code

    @architecture-narrative-blindspots.TB2.AC3
    Scenario: A staleness check passes with current docs despite narrative drift
      Given a monorepo with JS packages "web" and "billing"
      And a root ARCHITECTURE.md narrative that mentions only "web"
      And the generated architecture docs are current
      When safeword checks architecture staleness and captures its output
      Then the command succeeds
      And the output advises that the narrative does not mention "billing"

    @architecture-narrative-blindspots.TB2.AC3
    Scenario: A commit-time stage run succeeds despite narrative drift
      Given a monorepo with JS packages "web" and "billing" under git
      And a root ARCHITECTURE.md narrative that mentions only "web"
      When safeword stages the architecture docs and captures its output
      Then the command succeeds
      And the output advises that the narrative does not mention "billing"
