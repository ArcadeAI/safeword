@proof.vitest
# Proof: packages/cli/tests/review/job.test.ts
Feature: Durable independent review

  @finish-deep-reviews-in-background.TBU1.R1 @surface.safeword-cli @surface.claude-code @surface.openai-codex
  Rule: finish-deep-reviews-in-background.TBU1.R1 — A healthy review outlives its foreground courtesy wait

    Scenario: A quick review returns its verdict inline
      Given an independent reviewer completes within the courtesy wait
      When the builder starts a quality review
      Then the builder receives the completed review result

    Scenario: A slow healthy review continues as a durable job
      Given an independent reviewer remains active beyond the courtesy wait
      When the builder starts a quality review
      Then the builder receives a pending review handle

    Scenario: A detached review can be collected after its caller exits
      Given a pending review whose initiating process has exited
      When the builder checks the review status after it completes
      Then the builder receives the completed review result without rerunning it

  @finish-deep-reviews-in-background.TBU1.R2 @surface.safeword-cli
  Rule: finish-deep-reviews-in-background.TBU1.R2 — A collected result is bound to the source it reviewed

    @rejection
    Scenario: Source changes make a completed review stale
      Given a completed review bound to its starting source
      When the builder collects it after the reviewed source changes
      Then Safeword reports the review as stale instead of passing it

  @finish-deep-reviews-in-background.TBU1.R3 @surface.safeword-cli
  Rule: finish-deep-reviews-in-background.TBU1.R3 — A builder can stop a review that is no longer useful

    @rejection
    Scenario: A running review is canceled explicitly
      Given a review is still running in the background
      When the builder cancels that review
      Then Safeword preserves a canceled terminal result
