# Acceptance is proven by the Vitest hook lane, which drives the real Claude
# Stop hook with stdin payloads. `@manual` keeps this declarative behavior
# source out of cucumber's generic step runner; the proof is in
# packages/cli/tests/integration/stop-quality-response.test.ts.
@suppress-repeated-stop-quality-prompt.TBU1 @manual
Feature: Suppress repeated stop-quality prompts in a session

  A stop-quality prompt corrects an incomplete response, but a response that
  already supplies the required decision brief should not receive that same
  template again.

  @suppress-repeated-stop-quality-prompt.TBU1.R1 @surface.claude-code
  Rule: suppress-repeated-stop-quality-prompt.TBU1.R1 — A compliant decision brief does not trigger another quality prompt

    Scenario: A complete CONFIDENT brief completes the edited-work stop
      Given a non-done Claude Code session with a recent edit-tool transcript entry
      And this is a later ordinary stop after a prior quality continuation with stop_hook_active false
      And the latest assistant response is exactly a CONFIDENT brief with CONFIDENT, Decided, Open, and Next paragraphs
      When the quality stop hook evaluates the response
      Then it exits without JSON output or a quality-prompt continuation

    Scenario: A complete BLOCKED brief completes the edited-work stop
      Given a non-done Claude Code session with a recent edit-tool transcript entry
      And this is a later ordinary stop after a prior quality continuation with stop_hook_active false
      And the latest assistant response is exactly a BLOCKED brief with BLOCKED, Tried, and Need paragraphs
      When the quality stop hook evaluates the response
      Then it exits without JSON output or a quality-prompt continuation

    @rejection
    Scenario: An out-of-order CONFIDENT brief is corrected
      Given a non-done Claude Code session with a recent edit-tool transcript entry
      And this is a later ordinary stop after a prior quality continuation with stop_hook_active false
      And the latest assistant response places its Next paragraph before its Decided paragraph
      When the quality stop hook evaluates the response
      Then it emits the existing quality-prompt JSON block with the controlled phase guidance

  @suppress-repeated-stop-quality-prompt.TBU1.R3 @surface.claude-code
  Rule: suppress-repeated-stop-quality-prompt.TBU1.R3 — Done-phase hard gates take precedence over a compliant brief

    @rejection
    Scenario: A complete brief cannot bypass a missing done-phase requirement
      Given a done-phase Claude Code session with a recent edit-tool transcript entry
      And the latest assistant response is a complete CONFIDENT decision brief
      And a required done-phase evidence artifact is missing
      When the quality stop hook evaluates the response
      Then it returns the normal done-gate JSON block rather than silently allowing the stop

  @suppress-repeated-stop-quality-prompt.TBU1.R2 @surface.claude-code
  Rule: suppress-repeated-stop-quality-prompt.TBU1.R2 — An incomplete decision brief still receives the corrective quality prompt

    @rejection
    Scenario: A response missing a required decision-brief field is corrected
      Given a non-done Claude Code session with a recent edit-tool transcript entry
      And this is a later ordinary stop after a prior quality continuation with stop_hook_active false
      And the latest assistant response is a CONFIDENT brief missing its Next paragraph
      When the quality stop hook evaluates the response
      Then it emits the existing quality-prompt JSON block with the controlled phase guidance
