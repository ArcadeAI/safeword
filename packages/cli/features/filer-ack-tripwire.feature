# BDD source for GH644A (#658 — filer ack + bare-drain tripwire). Proven by the
# vitest suite (unit + hook wiring; fs and the filing post seam are the only
# mocked boundaries) — hook-internal state transitions the cucumber black-box
# lane can't drive. `@manual` excludes it from the acceptance lane while keeping
# it readable by codify / review-spec / safeword check.
@filer-ack-tripwire @manual
Feature: Filer ack + bare-drain tripwire — a drained spool no longer self-certifies

  GH628F's stop gate treats a drained spool as proof of filing, and #644 G7
  observed a cooperative agent forging that ack by draining inline. The filer now
  stamps a per-signature ack (naming the issue) before draining, and the gate
  converts an unacked removal into one deduped self-report signal — destroyed
  findings become counted telemetry, never silence, and honest filing is never
  punished.

  Rule: Unacked removals trip once per batch; acked removals stay silent

    @filer-ack-tripwire.SM1.AC1
    Scenario: A dispatched signature vanishing without an ack captures one RetroBareDrain signal
      Given the gate dispatched a batch and snapshotted its signatures
      And a dispatched signature is later gone from the spool with no ack recorded
      When the gate evaluates again
      Then exactly one RetroBareDrain self-report signal is captured for the batch
      And the gate's dispatch decision for the evaluation is unchanged

    @filer-ack-tripwire.SM1.AC1
    Scenario: A tripped batch does not trip again
      Given a batch that already captured its RetroBareDrain signal
      When the gate evaluates again with the same unacked removal
      Then no further signal is captured

    @filer-ack-tripwire.SM1.AC2
    Scenario: Removals covered by shape-valid ack lines trip nothing
      Given every removed signature has a {signature, issue} line in the ack file
      When the gate evaluates again
      Then no RetroBareDrain signal is captured

    @filer-ack-tripwire.SM1.AC2
    Scenario: Malformed ack lines are skipped without crashing or false-acking
      Given an ack file mixing torn lines with one shape-valid ack
      When the gate evaluates again
      Then only the validly acked signature is treated as filed

  Rule: Absent or pre-upgrade state fails open

    @filer-ack-tripwire.SM1.AC3
    Scenario: A GH628F-era marker without a signature snapshot disarms the tripwire
      Given an attempt marker written before this feature, carrying no signatures
      When the gate evaluates after a bare drain
      Then no signal is captured and the gate behaves as before

    @filer-ack-tripwire.SM1.AC3
    Scenario: Capture-off suppresses the tripwire
      Given selfReport.capture is false
      When the gate detects an unacked removal
      Then no signal is captured

  Rule: The filer acks before it drains

    @filer-ack-tripwire.SM2.AC2
    Scenario: The filing seam records an ack per successful post before draining
      Given two spooled drafts where the post succeeds for one and throws for the other
      When the filing seam runs
      Then the successful draft has an ack line and is drained
      And the failed draft has no ack and stays spooled

    @filer-ack-tripwire.SM2.AC1
    Scenario: Shipped prompts carry the ack procedure and drain prohibition
      Given the installed filer agent definitions and the dispatch text
      Then both agent definitions instruct ack-after-post-before-drain
      And the dispatch text states that only the filer drains the spool
