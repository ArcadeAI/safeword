@proof.vitest
# Proof: packages/cli/tests/review/job.test.ts, packages/cli/tests/review/runtime.test.ts,
# packages/cli/tests/cli-protocol/review-wiring.test.ts
Feature: Durable independent review

  @finish-deep-reviews-in-background.TBU1.R1 @surface.safeword-cli
  Rule: finish-deep-reviews-in-background.TBU1.R1 — A healthy review outlives its foreground courtesy wait

    Scenario: A quick review returns its verdict inline
      Given a scripted independent reviewer returns an approved result before the controlled courtesy deadline
      When the builder starts a quality review
      Then the builder receives that approved result inline

    Scenario: A slow healthy review continues as a durable job
      Given a scripted independent reviewer remains blocked through the controlled courtesy deadline
      When the builder starts a quality review
      Then the builder receives a pending handle with the runnable `safeword review status <review id>` command

    Scenario: A detached review can be collected after its caller exits
      Given a pending review whose caller exited while its scripted reviewer remained blocked
      When the reviewer is released and the builder checks its status
      Then the builder receives the reviewer-produced result without a second reviewer invocation

  @finish-deep-reviews-in-background.TBU1.R2 @surface.safeword-cli
  Rule: finish-deep-reviews-in-background.TBU1.R2 — A collected result is bound to the source it reviewed

    Scenario: An unchanged reviewed source keeps its completed result
      Given a completed review whose targets and context remain unchanged
      When the builder collects that review
      Then Safeword returns the completed result instead of marking it stale

    Scenario: An unrelated source change does not stale a completed review
      Given a completed review bound to one reviewed source
      When the builder changes a source outside that review and collects it
      Then Safeword returns the completed result instead of marking it stale

    Scenario: Restoring a reviewed source's identical content keeps its completed result
      Given a completed review bound to one reviewed source's original content
      When the builder changes and restores that source to identical content before collecting it
      Then Safeword returns the completed result instead of marking it stale

    @rejection
    Scenario: Source changes make a completed review stale
      Given a completed review bound to one reviewed source
      When the builder changes that reviewed source and collects it
      Then Safeword reports the review as stale instead of passing it

    @rejection
    Scenario: A tampered completed review result is not accepted
      Given a completed review record whose saved result was modified
      When the builder collects that review
      Then Safeword reports the record as invalid instead of returning a result

    @rejection
    Scenario: A tampered completed review binding is not accepted
      Given a completed review record whose saved source binding was modified
      When the builder collects that review
      Then Safeword reports the record as invalid instead of returning a result

    @rejection
    Scenario: A changed bound context makes a completed review stale
      Given a completed review bound to an unchanged target and one context file
      When the builder changes only that context file and collects the review
      Then Safeword reports the review as stale instead of passing it

    @rejection
    Scenario: Deleting a reviewed source makes a completed review stale
      Given a completed review bound to one reviewed source
      When the builder deletes that reviewed source and collects the review
      Then Safeword reports the review as stale instead of passing it

  @finish-deep-reviews-in-background.TBU1.R3 @surface.safeword-cli
  Rule: finish-deep-reviews-in-background.TBU1.R3 — A builder can stop a review that is no longer useful

    @rejection
    Scenario: A running review is canceled explicitly
      Given a review is still running in the background
      When the builder cancels that review
      Then Safeword preserves a canceled terminal result

    Scenario: Canceling a running review terminates its reviewer
      Given a scripted reviewer is still running for a pending review
      When the builder cancels that review
      Then that reviewer process is no longer running

    Scenario: A late reviewer result cannot replace a canceled result
      Given a canceled review whose worker later tries to save an approved result
      When the builder collects that review
      Then Safeword reports the review as canceled instead of approved

    Scenario: Canceling a completed review preserves its completed result
      Given a completed review with a reviewer-produced result
      When the builder cancels that completed review and then collects it
      Then Safeword returns the original completed result instead of canceling it

    @rejection
    Scenario: Canceling an unknown review is rejected
      Given no review exists for a requested review identifier
      When the builder cancels that review
      Then Safeword reports that the review was not found

    @rejection
    Scenario Outline: Collecting a malformed or unknown review is rejected
      Given no review exists for the requested review identifier <review_id>
      When the builder checks that review's status
      Then Safeword reports that the review was not found instead of reporting it pending

      Examples:
        | review_id                            |
        | not-a-uuid                           |
        | ../outside-the-review-store          |
        | aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa |

  @finish-deep-reviews-in-background.TBU1.R4 @surface.safeword-cli
  Rule: finish-deep-reviews-in-background.TBU1.R4 — A background review reaches a terminal result when it cannot complete

    @rejection
    Scenario: A detached reviewer that exits without a result fails terminally
      Given a pending review whose detached reviewer exits without recording a result
      When the builder checks the review status
      Then Safeword reports a terminal worker-exited failure instead of leaving the review pending

    @rejection
    Scenario: A reviewer that exceeds its controlled absolute deadline fails terminally
      Given a scripted independent reviewer remains blocked through a controlled absolute deadline
      When that worker records its outcome at the deadline and the builder checks the review status
      Then Safeword reports a terminal timed-out review result instead of leaving the review pending
