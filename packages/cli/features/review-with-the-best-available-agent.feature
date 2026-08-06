Feature: Always return the best available review

  Review assurance may degrade when capabilities are absent, but the main agent
  still receives bounded findings and the result never overstates independence.

  @review-with-the-best-available-agent.TBU1.R1 @surface.claude-code @surface.openai-codex @surface.cursor @manual
  Rule: review-with-the-best-available-agent.TBU1.R1 — Every independent reviewer precedes every degraded route

    @review-with-the-best-available-agent.NTB1.R1
    Scenario: The first available opposite local agent completes the review
      Given an opposite local agent can review the accepted packet
      When the review ladder runs
      Then the builder receives that agent's findings
      And the result explains that an independent reviewer completed the review

    @rejection @review-with-the-best-available-agent.NTB1.R1
    Scenario: A failed opposite agent falls through to another independent reviewer
      Given the first opposite local agent cannot complete the review
      And another independent local agent can complete it
      And a degraded reviewer is also available
      When the review ladder runs
      Then the builder receives the second agent's findings
      And no degraded reviewer is used
      And the result explains that an independent reviewer completed the review

  @review-with-the-best-available-agent.TBU1.R2 @surface.claude-code @surface.openai-codex @surface.cursor @manual
  Rule: review-with-the-best-available-agent.TBU1.R2 — Same-agent headless review is the first degraded route

    @rejection @review-with-the-best-available-agent.NTB1.R1
    Scenario: Exhausted independent routes use a same-agent headless review
      Given no independent local reviewer can complete the review
      And the author's headless CLI can review the accepted packet
      And a fresh-context in-session reviewer is also available
      When the review ladder runs
      Then the builder receives the headless review's findings
      And the in-session reviewer is not used
      And the result explains that the same agent reviewed in a separate process
      And the result explains that the review was not independent

  @review-with-the-best-available-agent.TBU1.R3 @surface.claude-code-cloud @manual
  Rule: review-with-the-best-available-agent.TBU1.R3 — Host-native review covers environments without a usable CLI

    @rejection @review-with-the-best-available-agent.NTB1.R1
    Scenario: Claude Code Cloud still completes a review without external agent CLIs
      Given Claude Code Cloud has no usable external agent CLI
      And a fresh-context read-only Claude reviewer is available in the session
      When the review ladder runs
      Then the builder receives the in-session review's findings
      And the result explains that a fresh context reviewed with the same agent
      And the result explains that the review was not independent

  @review-with-the-best-available-agent.TBU1.R4 @surface.claude-code @surface.claude-code-cloud @surface.openai-codex @surface.openai-codex-cloud @surface.cursor @surface.cursor-cloud-agents @manual
  Rule: review-with-the-best-available-agent.TBU1.R4 — Main-thread self-review guarantees findings when delegation is unavailable

    @rejection @review-with-the-best-available-agent.NTB1.R1
    Scenario: Every delegated route fails before the main thread reviews once
      Given no independent, headless, or in-session reviewer can complete
      When the review ladder runs
      Then the builder receives findings derived from the accepted packet and fixed rubric
      And the result explains that the main agent reviewed its own work
      And the result records exactly one self-review route
      And no fallback starts the review ladder again

  @review-with-the-best-available-agent.TBU1.R5 @surface.claude-code @surface.claude-code-cloud @surface.openai-codex @surface.openai-codex-cloud @surface.cursor @surface.cursor-cloud-agents @manual
  Rule: review-with-the-best-available-agent.TBU1.R5 — Review material never becomes host instruction

    @rejection
    Scenario: A degraded reviewer receives hostile repository text as untrusted material
      Given the accepted packet contains text that asks the reviewer to ignore its rubric
      And failed routes emitted diagnostics and a credential
      When a degraded review is prepared
      Then the reviewer receives the packet as untrusted review material
      But the failed-route output and credential are not included
      And the result still follows the original rubric and fixed contract
      And any host-mandated project context is disclosed as a limitation

  @review-with-the-best-available-agent.NTB1.R2 @surface.claude-code @surface.claude-code-cloud @surface.openai-codex @surface.openai-codex-cloud @surface.cursor @surface.cursor-cloud-agents @manual
  Rule: review-with-the-best-available-agent.NTB1.R2 — Degraded findings never masquerade as required independence

    Scenario: Degraded findings complete preferred policy
      Given a degraded reviewer returns findings
      And review policy is prefer
      When the review ladder reports its result
      Then the builder receives the degraded findings
      And the preferred review is complete

    Scenario: An independent review satisfies required policy
      Given an independent reviewer returns findings
      And review policy is require
      When the review ladder reports its result
      Then the builder receives the independent findings
      And the independent-review requirement is satisfied

    @rejection
    Scenario: Required independence remains unsatisfied after a degraded review
      Given every independent reviewer is unavailable
      And a degraded reviewer returns findings
      And review policy is require
      When the review ladder reports its result
      Then the builder receives the degraded findings
      But the independent-review requirement remains unsatisfied
