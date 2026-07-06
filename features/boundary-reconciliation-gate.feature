@boundary-reconciliation-gate
Feature: Boundary reconciliation gate — evidence checks re-run at commit and push, warn-and-record

  At the moments work leaves the machine, `safeword boundary` re-runs the
  workflow's evidence checks over the ticket artifacts in the change: phase
  legality (including tickets born past intake at rest), phase anchors, the
  R/G/R ledger, verify.md and impl-plan shape. Commit tier is content-only and
  sub-second; push tier adds history-backed SHA verification through the
  rebase-aware resolver. Findings are warnings appended to a local audit
  record — the command never blocks (exit 0 always; hard-blocking belongs to
  the server-side child of #810). Changes touching no ticket artifacts are
  silent no-ops, keeping safeword's promise that ordinary commits stay free.

  Rule: A commit touching ticket artifacts gets its evidence reconciled and recorded

    @boundary-reconciliation-gate.SM1.AC1
    Scenario: A staged ticket change with clean evidence passes quietly and is recorded
      Given a safeword project with a feature ticket whose staged evidence is consistent
      When the boundary command runs at the commit boundary
      Then it exits zero with no warnings
      And an audit entry records the passing verdicts

    @boundary-reconciliation-gate.SM1.AC1
    Scenario: A staged forward phase advance without an anchor is warned and recorded
      Given a feature ticket staged with a forward phase advance carrying no phase_anchors entry
      When the boundary command runs at the commit boundary
      Then it exits zero and warns that the entered phase is unanchored
      And an audit entry records the finding

    @boundary-reconciliation-gate.SM1.AC1
    Scenario: A feature ticket at rest born past intake is warned at the boundary
      Given a staged change touching a feature ticket that sits at phase implement with no phase_skips and no intake history
      When the boundary command runs at the commit boundary
      Then it exits zero and warns that the ticket was born past intake without justification

    @boundary-reconciliation-gate.SM1.AC1
    Scenario: A staged ticket.md with unparseable frontmatter is warned, never crashed on
      Given a staged ticket.md whose frontmatter does not parse
      When the boundary command runs at the commit boundary
      Then it exits zero and warns that the ticket cannot be classified

    @boundary-reconciliation-gate.SM1.AC1
    Scenario: Several tickets in one commit are each reconciled with verdicts grouped per ticket
      Given a staged change touching two tickets, one clean and one with an unanchored advance
      When the boundary command runs at the commit boundary
      Then the warnings name only the ticket with the finding
      And the audit entry carries per-ticket verdicts

    @boundary-reconciliation-gate.SM1.AC1
    Scenario: An invalid ledger annotation is warned at the commit boundary
      Given a staged test-definitions.md whose checked step carries a malformed annotation
      When the boundary command runs at the commit boundary
      Then it exits zero and warns about the ledger annotation

  Rule: A push additionally verifies evidence against reachable history

    @boundary-reconciliation-gate.SM1.AC2
    Scenario: A well-formed anchor that is not reachable from the pushed history is warned
      Given a ticket in the outgoing range whose entered-phase anchor is a well-formed SHA absent from history
      When the boundary command runs at the push boundary
      Then it exits zero and warns that the anchor is unreachable, naming forge and shallow clone as possible causes

    @boundary-reconciliation-gate.SM1.AC2
    Scenario: Anchors recorded before a rebase still verify after it
      Given a ticket whose anchor SHA was rewritten by a rebase but whose patch is reachable under a new SHA
      When the boundary command runs at the push boundary
      Then it exits zero with no anchor warning

    @boundary-reconciliation-gate.SM1.AC2
    Scenario: Only the entered phase's anchor is demanded on a multi-phase advance
      Given a ticket in the outgoing range that advanced several phases in one commitless sitting with one anchor for the current phase
      When the boundary command runs at the push boundary
      Then it exits zero with no anchor warning

    @boundary-reconciliation-gate.SM1.AC2
    Scenario: Ledger step SHAs are verified against the pushed history
      Given a ticket in the outgoing range whose ledger GREEN SHA is absent from history
      When the boundary command runs at the push boundary
      Then it exits zero and warns about the unreachable ledger SHA

  Rule: The gate is silent and free for changes that touch no ticket artifacts

    @boundary-reconciliation-gate.TB1.AC1
    Scenario: A commit touching only source code produces no output and no audit entry
      Given a staged change touching no ticket artifacts
      When the boundary command runs at the commit boundary
      Then it exits zero with no output
      And no audit entry is written

    @boundary-reconciliation-gate.TB1.AC1
    Scenario: A push whose outgoing range contains no ticket-artifact changes is a silent no-op
      Given an outgoing range with commits touching no ticket artifacts
      When the boundary command runs at the push boundary
      Then it exits zero with no output
      And no audit entry is written

    @boundary-reconciliation-gate.TB1.AC1
    Scenario: Outside a safeword project the command is a silent no-op
      Given a git repository with no safeword configuration
      When the boundary command runs at the commit boundary
      Then it exits zero with no output

  Rule: Findings never block — the local tier has no failing exit

    @boundary-reconciliation-gate.TB1.AC2
    Scenario: A commit boundary with multiple findings still exits zero
      Given a staged change whose ticket evidence produces several findings
      When the boundary command runs at the commit boundary
      Then it exits zero

    @boundary-reconciliation-gate.TB1.AC2
    Scenario: A push boundary with unreachable evidence still exits zero
      Given an outgoing range whose ticket evidence includes an unreachable anchor
      When the boundary command runs at the push boundary
      Then it exits zero

  Rule: Every reconciliation is durably recorded locally

    @boundary-reconciliation-gate.SM1.AC3
    Scenario: Audit entries accumulate across boundary runs
      Given two consecutive boundary runs over ticket-touching changes
      When the audit record is read
      Then it contains one entry per run with boundary, commit id, and per-check verdicts

    @boundary-reconciliation-gate.SM1.AC3
    Scenario: The audit record is created on first use when its directory is missing
      Given a safeword project that has never run the boundary command
      When the boundary command runs at the commit boundary over a ticket-touching change
      Then the audit record exists afterward with one entry
