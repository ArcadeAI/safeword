# Behavior source for BY7RNR (GitHub #848). Its executable backing is Vitest
# hook coverage in packages/cli/tests/hooks/architecture-document-nudge.test.ts
# and architecture-document-nudge-parity.test.ts — git-backed tests over the standalone hook
# helper plus a differential parity test against the CLI resolver — and cucumber
# steps would duplicate that harness without adding confidence.
@architecture-narrative-blindspots
Feature: Architecture narrative reconciliation reaches configured narratives

  The AXRC4D reconcile loop assumed the human architecture narrative lives at
  root ARCHITECTURE.md. GitHub #848 showed a host whose narrative lives
  elsewhere (paths.architecture points at it). The narrative stays human-owned:
  architecture shape changes may prompt a reconciliation, but package coverage
  belongs exclusively to the generated map.

  Rule: The done-gate nudge resolves the narrative via paths.architecture

    @proof.vitest @architecture-narrative-blindspots.TB1.AC1
    Scenario: A configured non-root narrative gets the nudge when a ticket moves the shape
      Given a project whose narrative lives at "docs/agents/architecture.md" and is configured via paths.architecture
      And the generated architecture map's fingerprint moved since the branch base
      When the done-gate checks for narrative staleness
      Then the reconcile advisory fires

    @proof.vitest @architecture-narrative-blindspots.TB1.AC1
    Scenario: A configured decision-record directory counts as a narrative
      Given a project whose paths.architecture points at a directory of decision records
      And the generated architecture map's fingerprint moved since the branch base
      When the done-gate checks for narrative staleness
      Then the reconcile advisory fires

    @proof.vitest @architecture-narrative-blindspots.TB1.AC1
    Scenario: A configured narrative that is missing on disk draws no advisory
      Given a project whose paths.architecture points at a file that does not exist
      And there is no root ARCHITECTURE.md
      And the generated architecture map's fingerprint moved since the branch base
      When the done-gate checks for narrative staleness
      Then no reconcile advisory fires

    @proof.vitest @architecture-narrative-blindspots.TB1.AC1
    Scenario: An explicit configuration wins over a present root file even when its target is missing
      Given a project whose paths.architecture points at a file that does not exist
      And a root ARCHITECTURE.md exists
      And the generated architecture map's fingerprint moved since the branch base
      When the done-gate checks for narrative staleness
      Then no reconcile advisory fires

  Rule: Unconfigured hosts keep today's root-ARCHITECTURE.md behavior exactly

    @proof.vitest @architecture-narrative-blindspots.TB1.AC2
    Scenario: An unconfigured host with a root ARCHITECTURE.md still nudges on shape movement
      Given a project with a root ARCHITECTURE.md and no paths.architecture configured
      And the generated architecture map's fingerprint moved since the branch base
      When the done-gate checks for narrative staleness
      Then the reconcile advisory fires

    @proof.vitest @architecture-narrative-blindspots.TB1.AC2
    Scenario: An unconfigured host with no narrative anywhere stays silent
      Given a project with no root ARCHITECTURE.md and no paths.architecture configured
      And the generated architecture map's fingerprint moved since the branch base
      When the done-gate checks for narrative staleness
      Then no reconcile advisory fires

    @proof.vitest @architecture-narrative-blindspots.TB1.AC2
    Scenario: An unchanged fingerprint stays silent even with a configured narrative
      Given a project whose narrative lives at "docs/agents/architecture.md" and is configured via paths.architecture
      And the generated architecture map's fingerprint is unchanged since the branch base
      When the done-gate checks for narrative staleness
      Then no reconcile advisory fires

    @proof.vitest @architecture-narrative-blindspots.TB1.AC2
    Scenario: An unparseable config falls back to the root ARCHITECTURE.md
      Given a project with a root ARCHITECTURE.md and an unparseable .safeword/config.json
      And the generated architecture map's fingerprint moved since the branch base
      When the done-gate checks for narrative staleness
      Then the reconcile advisory fires

    @proof.vitest @architecture-narrative-blindspots.TB1.AC2
    Scenario: An empty-string paths.architecture behaves as unconfigured
      Given a project with a root ARCHITECTURE.md whose paths.architecture is an empty string
      And the generated architecture map's fingerprint moved since the branch base
      When the done-gate checks for narrative staleness
      Then the reconcile advisory names "ARCHITECTURE.md" as the document to reconcile

  Rule: The advisory names the narrative it is asking the builder to reconcile

    @proof.vitest @architecture-narrative-blindspots.TB1.AC3
    Scenario: A configured narrative is named in the advisory text
      Given a project whose narrative lives at "docs/agents/architecture.md" and is configured via paths.architecture
      And the generated architecture map's fingerprint moved since the branch base
      When the done-gate checks for narrative staleness
      Then the reconcile advisory names "docs/agents/architecture.md" as the document to reconcile

    @proof.vitest @architecture-narrative-blindspots.TB1.AC3
    Scenario: The root fallback is named as ARCHITECTURE.md
      Given a project with a root ARCHITECTURE.md and no paths.architecture configured
      And the generated architecture map's fingerprint moved since the branch base
      When the done-gate checks for narrative staleness
      Then the reconcile advisory names "ARCHITECTURE.md" as the document to reconcile

  Rule: The installed prompts direct agents to the configured narrative

    @proof.vitest @architecture-narrative-blindspots.TB1.AC4
    Scenario: The architecture review prompt resolves the narrative via paths.architecture
      Given the installed architecture review prompt
      When its narrative-resolution instructions are inspected
      Then it directs the agent to the paths.architecture narrative with root ARCHITECTURE.md as the fallback

    @proof.vitest @architecture-narrative-blindspots.TB1.AC4
    Scenario: The audit skill's structural-drift check resolves the narrative via paths.architecture
      Given the installed audit skill
      When its structural-drift instructions are inspected
      Then its structural-drift check directs the agent to the paths.architecture narrative with root ARCHITECTURE.md as the fallback
