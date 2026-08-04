Feature: Keep independent reviews reliable for real ticket packets

  Cross-agent review must survive realistic bounded packets, tell the fallback
  reviewer exactly what a valid answer looks like, keep one genuinely
  independent attempt in reserve, and explain an exhausted route plainly.

  @reliable-reviews-for-real-packets.TBU1.R1 @surface.claude-code
  Rule: reliable-reviews-for-real-packets.TBU1.R1 — A review's time budget scales with the size of the packet it must read, up to a documented maximum

    Scenario: A representative ticket-sized review is given time to finish
      Given a five-file review packet of about 58 KB
      And the assigned reviewer answers after 111 seconds
      When the independent review runs
      Then the review returns the reviewer's verdict

    Scenario: A small packet keeps a smaller budget than a large one
      Given a single-file review packet of about 3 KB
      And a five-file review packet of about 58 KB
      When each packet's review budget is derived
      Then the larger packet is allowed more time than the smaller one

    @rejection
    Scenario: A reviewer answering past the documented maximum is still stopped
      Given a review packet at the largest size the coordinator accepts
      And the assigned reviewer answers only after the documented maximum budget
      When the independent review runs
      Then the review is reported as timed out

  @reliable-reviews-for-real-packets.TBU1.R2 @surface.claude-code
  Rule: reliable-reviews-for-real-packets.TBU1.R2 — A reviewer that never finishes is still stopped inside that maximum and reported as a timeout

    @rejection
    Scenario: A reviewer that never answers is stopped and reported as a timeout
      Given an assigned reviewer that never produces an answer
      When the independent review runs
      Then the review is reported as timed out

    Scenario: An explicitly configured budget replaces the size-derived one
      Given an explicitly configured review budget
      And a five-file review packet of about 58 KB
      When the review budget is derived
      Then the configured budget is used instead of the size-derived budget

  @reliable-reviews-for-real-packets.TBU1.R3 @surface.claude-code
  Rule: reliable-reviews-for-real-packets.TBU1.R3 — One slow or stale reviewer executable cannot consume every other installed candidate's opportunity

    Scenario: A slow first reviewer executable still leaves the next one a chance
      Given two installed reviewer executables that both accept the review contract
      And the first executable never answers
      And the second executable answers promptly
      When the independent review runs
      Then the review returns the second executable's verdict

    @rejection
    Scenario: Every reviewer executable failing still reports a timeout
      Given two installed reviewer executables that both accept the review contract
      And neither executable ever answers
      When the independent review runs
      Then the review is reported as timed out

  @reliable-reviews-for-real-packets.TBU2.R1 @surface.openai-codex
  Rule: reliable-reviews-for-real-packets.TBU2.R1 — A reviewer that supports typed output is given the exact result contract the check will enforce

    Scenario: The Codex reviewer is told the exact shape its answer must take
      Given an installed Codex reviewer that supports typed output
      When the independent review runs
      Then the Codex reviewer is given the review result contract

    Scenario: The contract handed out matches the contract enforced
      Given the review result contract handed to a reviewer
      When an answer is checked against the enforced contract
      Then every field and severity the contract permits is accepted
      And nothing the contract forbids is accepted

    Scenario: A Codex answer that follows the contract is accepted
      Given an installed Codex reviewer that answers in the review result contract
      When the independent review runs
      Then the review returns the Codex reviewer's verdict

    @rejection
    Scenario: A reviewer that cannot be given the contract is not asked to review
      Given an installed Codex reviewer that supports typed output
      And the review result contract cannot be handed to it
      When the independent review runs
      Then no review is requested from that reviewer

  @reliable-reviews-for-real-packets.TBU2.R2 @surface.openai-codex
  Rule: reliable-reviews-for-real-packets.TBU2.R2 — A reviewer executable that cannot honor the result contract is skipped rather than tried and rejected

    Scenario: A reviewer executable without typed output is skipped for one that has it
      Given an installed reviewer executable that cannot produce typed output
      And a second installed reviewer executable that can
      When the independent review runs
      Then the review returns the second executable's verdict

    @rejection
    Scenario: No reviewer executable supporting typed output means no reviewer is available
      Given every installed reviewer executable cannot produce typed output
      When the independent review runs
      Then the review reports that no compatible reviewer is installed

  @reliable-reviews-for-real-packets.TBU2.R3 @surface.openai-codex
  Rule: reliable-reviews-for-real-packets.TBU2.R3 — A result that violates the contract is still rejected, whatever produced it

    @rejection
    Scenario: An answer using a severity outside the contract is rejected
      Given a reviewer answer whose finding severity is not permitted by the contract
      When the answer is checked
      Then the answer is rejected as invalid reviewer output

    @rejection
    Scenario: An answer carrying an extra field is rejected
      Given a reviewer answer carrying a field the contract does not define
      When the answer is checked
      Then the answer is rejected as invalid reviewer output

  @reliable-reviews-for-real-packets.TBU3.R1 @surface.claude-code @surface.openai-codex
  Rule: reliable-reviews-for-real-packets.TBU3.R1 — An exhausted reviewer agent is retried on a configured alternate model before the author's own runtime

    Scenario: An exhausted reviewer agent is retried on its alternate model
      Given a configured alternate model for the reviewer agent
      And the reviewer agent's default model never answers
      And the reviewer agent's alternate model answers promptly
      When the independent review runs
      Then the review returns the alternate model's verdict

    @rejection
    Scenario: An alternate model that also fails falls back to the author's own runtime
      Given a configured alternate model for the reviewer agent
      And neither the reviewer agent's default nor alternate model answers
      And the author's own runtime answers promptly
      When the independent review runs
      Then the review reports that the check was not independent

  @reliable-reviews-for-real-packets.TBU3.R2 @surface.claude-code
  Rule: reliable-reviews-for-real-packets.TBU3.R2 — A review completed by the reviewer agent on its alternate model is still a full cross-agent check, and the result names the model that actually reviewed

    Scenario: An alternate-model review still counts as a full independent check
      Given the reviewer agent's alternate model completed the review
      When the review result is reported
      Then the result reports a full cross-agent check
      And the result names the model that produced the verdict

    Scenario: A required cross-agent check is satisfied by an alternate-model review
      Given a required cross-agent review policy
      And the reviewer agent's alternate model completed the review
      When the review result is reported
      Then the required cross-agent check is satisfied

    @rejection
    Scenario: An alternate model of the author's own runtime is not a cross-agent check
      Given the author's own runtime completed the review on an alternate model
      When the review result is reported
      Then the result does not report a full cross-agent check

  @reliable-reviews-for-real-packets.TBU3.R3 @surface.claude-code
  Rule: reliable-reviews-for-real-packets.TBU3.R3 — With no alternate model configured, routing is exactly what it is today, and Safe Word never supplies a model name of its own

    Scenario: No configured alternate model keeps today's routing
      Given no configured alternate model for the reviewer agent
      And the reviewer agent never answers
      And the author's own runtime answers promptly
      When the independent review runs
      Then the review reports that the check was not independent

    @rejection
    Scenario: Safe Word never chooses a model on the builder's behalf
      Given no configured alternate model for the reviewer agent
      When the independent review runs
      Then the reviewer is asked for a review without any model selection

  @reliable-reviews-for-real-packets.TBU3.R4 @surface.claude-code
  Rule: reliable-reviews-for-real-packets.TBU3.R4 — Each attempted route gets its own bounded budget, so an exhausted first attempt cannot leave the retry with no time to run

    Scenario: The alternate-model retry gets its own budget
      Given a configured alternate model for the reviewer agent
      And the reviewer agent's default model uses its entire budget without answering
      And the reviewer agent's alternate model answers promptly
      When the independent review runs
      Then the review returns the alternate model's verdict

    @rejection
    Scenario: Every route exhausting its own budget ends the run
      Given a configured alternate model for the reviewer agent
      And no route ever answers
      When the independent review runs
      Then the review reports that no route completed
      And no further route is attempted

  @reliable-reviews-for-real-packets.NTB1.R1 @surface.claude-code @surface.openai-codex
  Rule: reliable-reviews-for-real-packets.NTB1.R1 — When both routes fail, the explanation names each route's own cause, not one generic failure

    Scenario: A timeout and a rejected answer are explained as two distinct causes
      Given the assigned reviewer timed out
      And the fallback reviewer's answer did not follow the result contract
      When the exhausted-route result is reported
      Then the explanation says the assigned reviewer ran out of time
      And the explanation says the fallback reviewer's answer was not in the required form

    Scenario: A missing reviewer and a timed-out fallback are explained as two distinct causes
      Given the assigned reviewer is not installed
      And the fallback reviewer timed out
      When the exhausted-route result is reported
      Then the explanation says the assigned reviewer is not installed
      And the explanation says the fallback reviewer ran out of time

    @rejection
    Scenario: An exhausted run never claims a review happened
      Given the assigned reviewer timed out
      And the fallback reviewer's answer did not follow the result contract
      When the exhausted-route result is reported
      Then the result records no verdict

  @reliable-reviews-for-real-packets.NTB1.R2 @surface.claude-code
  Rule: reliable-reviews-for-real-packets.NTB1.R2 — An explanation never carries raw reviewer output, diagnostic noise, or credentials

    @rejection
    Scenario: Reviewer diagnostic noise never reaches the explanation
      Given a reviewer that fails while printing diagnostic noise containing a credential
      When the exhausted-route result is reported
      Then the explanation contains neither the diagnostic noise nor the credential

  @reliable-reviews-for-real-packets.NTB1.R3 @surface.claude-code
  Rule: reliable-reviews-for-real-packets.NTB1.R3 — A review that ran but was not independent still never satisfies a required cross-agent check

    @rejection
    Scenario: A required cross-agent check is not satisfied by the author reviewing itself
      Given a required cross-agent review policy
      And only the author's own runtime completed the review
      When the review result is reported
      Then the required cross-agent check is not satisfied

    Scenario: A preferred policy still returns a verdict labelled as not independent
      Given a preferred cross-agent review policy
      And only the author's own runtime completed the review
      When the review result is reported
      Then the review returns a verdict
      And the result reports that the check was not independent
