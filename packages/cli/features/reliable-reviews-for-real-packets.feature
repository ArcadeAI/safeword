Feature: Keep independent reviews reliable for real ticket packets

  Cross-agent review must survive realistic bounded packets, tell the fallback
  reviewer exactly what a valid answer looks like, keep one genuinely
  independent attempt in reserve, and explain an exhausted route plainly.

  Exhaustive tables from scenario review — deadline arithmetic, the model
  grammar, the contract's field shapes, candidate-share maths — live in focused
  tests beside the code, where they are cheaper to run and read.

  @reliable-reviews-for-real-packets.TBU1.R1 @surface.claude-code
  Rule: reliable-reviews-for-real-packets.TBU1.R1 — Every review attempt gets the same documented deadline, set well above the slowest review anyone has observed

    Scenario: A representative ticket-sized review is given time to finish
      Given a reviewer that answers well inside its deadline
      When the independent review runs
      Then the review returns the reviewer's verdict

    @rejection
    Scenario: A packet over the accepted maximum is refused rather than reviewed
      Given a review packet larger than the accepted maximum
      When the independent review runs
      Then no reviewer is asked to review it
      And the command rejects the packet through a typed result

  @reliable-reviews-for-real-packets.TBU1.R2 @surface.claude-code
  Rule: reliable-reviews-for-real-packets.TBU1.R2 — A reviewer that never finishes is still stopped at its deadline and reported as a timeout

    Scenario: An explicitly configured deadline replaces the default
      Given an explicitly configured attempt deadline
      When the attempt deadline is derived
      Then the configured deadline is used

    @rejection
    Scenario: A reviewer that never answers is stopped and reported as a timeout
      Given a reviewer that never answers
      And no later route can complete either
      When the independent review runs
      Then the assigned reviewer route is reported as timed out

  @reliable-reviews-for-real-packets.TBU1.R3 @surface.claude-code
  Rule: reliable-reviews-for-real-packets.TBU1.R3 — A route's budget is split across its untried candidates, so one slow or stale executable cannot consume every other candidate's opportunity

    Scenario: A slow first reviewer executable still leaves the next one a chance
      Given two installed reviewer executables that both accept the review contract
      And the first executable never answers
      And the second executable answers promptly
      When the independent review runs
      Then the review returns the second executable's verdict
      And the stale executable was tried before the working executable

    @rejection
    Scenario: Every reviewer executable failing still reports a timeout
      Given two installed reviewer executables that never answer
      And no later route can complete either
      When the independent review runs
      Then the assigned reviewer route is reported as timed out

  @reliable-reviews-for-real-packets.TBU1.R4 @surface.claude-code
  Rule: reliable-reviews-for-real-packets.TBU1.R4 — However a reviewer ends, Safeword stops it and the descendants its platform lets it reach, never waits on what the system will not kill, never claims to have stopped what escaped, and never uses a late answer

    Scenario: Cleanup reaches every descendant the platform groups with the reviewer
      Given a reviewer that never answers and leaves a grandchild grouped with it
      When the independent review runs
      Then no process grouped with that reviewer is still running afterwards

    @rejection
    Scenario: A late answer after a timeout is ignored
      Given a reviewer that answers only after it was stopped for running out of time
      When the independent review runs
      Then the review is reported as timed out

  @reliable-reviews-for-real-packets.TBU2.R1 @surface.openai-codex
  Rule: reliable-reviews-for-real-packets.TBU2.R1 — A reviewer that supports typed output is given the exact result contract the check will enforce

    Scenario: A Codex answer that follows the contract is accepted
      Given an installed Codex reviewer that answers in the review result contract
      When the independent review runs
      Then the review returns the Codex reviewer's verdict

    Scenario: Supporting evidence stays separate from the work being reviewed
      Given a review target with supporting context
      And an installed Codex reviewer that answers in the review result contract
      When the independent review runs
      Then the reviewer receives the target as work and the evidence as context

    @rejection
    Scenario: A reviewer that cannot be given the contract is not asked to review
      Given the review result contract cannot be written
      When the independent review runs
      Then no reviewer is asked to review it

  @reliable-reviews-for-real-packets.TBU2.R2 @surface.openai-codex
  Rule: reliable-reviews-for-real-packets.TBU2.R2 — A reviewer executable that cannot honour the result contract never costs a later candidate its turn — skipped before launch when that is knowable, failed fast when it is not

    Scenario: A reviewer executable without typed output is skipped for one that has it
      Given an installed reviewer executable that cannot produce typed output
      And a second installed reviewer executable that can
      When the independent review runs
      Then the review returns the second executable's verdict

    @rejection
    Scenario: An installed incompatible reviewer explains how to recover
      Given an installed reviewer that cannot honor the review contract
      When the independent review runs
      Then the review is blocked because the installed reviewer is unsupported
      And the recovery tells the builder to update the reviewer
      And the incompatible reviewer is not asked to review

    @rejection
    Scenario: A missing reviewer explains how to recover
      Given no reviewer executable is installed
      When the independent review runs
      Then the review is blocked because the reviewer is not installed
      And the recovery tells the builder to install or update the reviewer

  @reliable-reviews-for-real-packets.TBU2.R3 @surface.openai-codex
  Rule: reliable-reviews-for-real-packets.TBU2.R3 — A result that violates the contract is still rejected, whatever produced it

    Scenario: An answer following the contract is accepted
      Given a reviewer answer that follows the result contract
      When the answer is checked
      Then the answer is accepted

    @rejection
    Scenario: An answer using a severity outside the contract is rejected
      Given a reviewer answer whose finding severity the contract does not permit
      When the answer is checked
      Then the answer is rejected as invalid reviewer output

  @reliable-reviews-for-real-packets.TBU3.R1 @surface.claude-code @surface.openai-codex
  Rule: reliable-reviews-for-real-packets.TBU3.R1 — An exhausted reviewer agent is retried on a configured alternate model before the author's own runtime

    Scenario: An exhausted reviewer agent is retried on its alternate model
      Given a configured alternate model for the reviewer agent
      And a review target with supporting context
      And the reviewer agent's default model never answers
      And the reviewer agent's alternate model answers promptly
      When the independent review runs
      Then the review returns the alternate model's verdict
      And the alternate model receives the same target and context roles

    @rejection
    Scenario: An alternate model that fails promptly falls back to the author's own runtime
      Given a configured alternate model for the reviewer agent
      And both reviewer models fail promptly
      And the author's own runtime answers promptly
      When the independent review runs
      Then the review reports that the check was not independent
      And both reviewer models were attempted before the author runtime completed

  @reliable-reviews-for-real-packets.TBU3.R2 @surface.claude-code
  Rule: reliable-reviews-for-real-packets.TBU3.R2 — A review completed by the reviewer agent on its alternate model is still a full cross-agent check, and Safeword's own review result names the model that reviewed

    Scenario: An alternate-model review still counts as a full independent check
      Given the reviewer agent's alternate model completed the review
      When the review result is reported
      Then the result reports a full cross-agent check
      And the result names the model it asked to review

    @rejection
    Scenario: A review by the author's own runtime is not a cross-agent check
      Given only the author's own runtime completed the review
      When the review result is reported
      Then the result does not report a full cross-agent check

  @reliable-reviews-for-real-packets.TBU3.R3 @surface.claude-code
  Rule: reliable-reviews-for-real-packets.TBU3.R3 — With no alternate model configured, routing is exactly what it is today, and Safeword never supplies a model name of its own

    Scenario: A model value within the grammar is used as configured
      Given a configured alternate model within the accepted grammar
      And the reviewer agent's default model never answers
      When the independent review runs
      Then the reviewer is asked to review on that model

    @rejection
    Scenario: An unusable configured model is treated as none configured
      Given a configured alternate model outside the accepted grammar
      And the reviewer agent's default model never answers
      When the independent review runs
      Then the reviewer is never asked for a review on an alternate model

  @reliable-reviews-for-real-packets.TBU3.R4 @surface.claude-code
  Rule: reliable-reviews-for-real-packets.TBU3.R4 — The default first route leaves at least the 120-second floor for a configured independent retry; every later route remains capped by the shared run bound

    Scenario: A route that uses its whole budget still leaves the next route its own
      Given a configured alternate model for the reviewer agent
      And the reviewer agent's default model never answers
      And the reviewer agent's alternate model answers promptly
      When the independent review runs
      Then the review returns the alternate model's verdict

    @rejection
    Scenario: The preferred route leaves a fundable alternate-model retry
      Given a configured alternate model for the reviewer agent
      And the reviewer agent's default model never answers
      When the independent review runs
      Then the alternate model still receives its own attempt

  @reliable-reviews-for-real-packets.TBU3.R5 @surface.claude-code
  Rule: reliable-reviews-for-real-packets.TBU3.R5 — Every route is tried in a fixed order; the run bound stops any route whose reviewer has not exited with valid output before its deadline

    Scenario: Every route is tried, in order, before the run gives up
      Given a configured alternate model for the reviewer agent
      And no route ever answers
      When the independent review runs
      Then the routes were attempted in their fixed order

    @rejection
    Scenario: The run bound wins over trying the remaining routes
      Given a configured alternate model for the reviewer agent
      And the run bound is reached while an early route is still working
      When the independent review runs
      Then the author's own runtime is never attempted

  @reliable-reviews-for-real-packets.TBU3.R6 @surface.claude-code @surface.openai-codex
  Rule: reliable-reviews-for-real-packets.TBU3.R6 — The public review command carries all of this end to end, and the required-review policy decides on what it reports

    Scenario Outline: The public review command completes through either agent's configured model tier
      Given a <author>-authored change with <reviewer> alternate model "<model>"
      When a builder runs the public review command
      Then the command reports a full cross-agent check by <reviewer> using "<model>"

      Examples:
        | author | reviewer | model                |
        | Claude | Codex    | codex-small-review   |
        | Claude | Codex    | codex-large-review   |
        | Codex  | Claude   | claude-small-review  |
        | Codex  | Claude   | claude-large-review  |

    @rejection
    Scenario: A required review refuses an author-runtime result
      Given a required cross-agent review policy
      And only the author's own runtime completed the review
      When a builder runs the public review command
      Then the command reports the required check as unsatisfied

  @reliable-reviews-for-real-packets.NTB1.R1 @surface.claude-code @surface.openai-codex
  Rule: reliable-reviews-for-real-packets.NTB1.R1 — When both routes fail, the explanation names each route's own cause, not one generic failure

    Scenario: A timeout and a rejected answer are explained as two distinct causes
      Given the assigned reviewer timed out
      And the fallback reviewer's answer did not follow the result contract
      When the exhausted-route result is reported
      Then the explanation says the assigned reviewer ran out of time
      And the explanation says the fallback reviewer's answer could not be accepted
      And the result offers exactly one next step to take

    @rejection
    Scenario: An exhausted run never claims a review happened
      Given the assigned reviewer timed out
      And the fallback reviewer's answer did not follow the result contract
      When the exhausted-route result is reported
      Then the result records no verdict

  @reliable-reviews-for-real-packets.NTB1.R2 @surface.claude-code
  Rule: reliable-reviews-for-real-packets.NTB1.R2 — An explanation never carries raw reviewer output, diagnostic noise, or credentials

    Scenario: An explanation is built only from Safeword's own failure classification
      Given a reviewer that fails while emitting a credential
      When the exhausted-route result is reported
      Then the explanation names only the route and its classified cause

    @rejection
    Scenario: Nothing a reviewer emits reaches the explanation
      Given a reviewer that fails while emitting a credential
      When the exhausted-route result is reported
      Then the explanation contains neither that output nor the credential

  @reliable-reviews-for-real-packets.NTB1.R3 @surface.claude-code
  Rule: reliable-reviews-for-real-packets.NTB1.R3 — A review that ran but was not independent still never satisfies a required cross-agent check

    Scenario: A preferred policy still returns a verdict labelled as not independent
      Given a preferred cross-agent review policy
      And only the author's own runtime completed the review
      When the review result is reported
      Then the review returns a verdict
      And the result reports that the check was not independent

    @rejection
    Scenario: A required cross-agent check is not satisfied by the author reviewing itself
      Given a required cross-agent review policy
      And only the author's own runtime completed the review
      When the review result is reported
      Then the required cross-agent check is not satisfied
