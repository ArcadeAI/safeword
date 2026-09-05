# Semantic reviewer evaluation, not template-shape proof.
# Procedure and current evidence: experiments/killer-demo-eval/README.md
@manual
Feature: Killer Demo quality
  A Product Plan demonstrates value the user wants and can believe.

  @lean-product-plans.NTB1.R4
  Rule: lean-product-plans.NTB1.R4 — A Product Plan identifies the shortest credible demo of its product payoff

    @surface.claude-code @surface.openai-codex @surface.cursor @surface.opencode
    Scenario Outline: Each Product Plan owner captures a credible Killer Demo
      Given a <plan owner> Product Plan has a Killer Demo that names its persona-facing payoff
      And its audience, starting state, action, proof, and boundary make that payoff observable
      When Safeword checks whether the plan is decision-ready
      Then Safeword reports the plan is decision-ready with no Killer Demo finding

      Examples:
        | plan owner         |
        | feature epic       |
        | standalone feature |

    @surface.claude-code @surface.openai-codex @surface.cursor @surface.opencode @rejection
    Scenario: Boilerplate does not qualify as a Killer Demo
      Given a Product Plan's Killer Demo fields only restate their template prompts
      When Safeword checks whether the plan is decision-ready
      Then Safeword reports that the Killer Demo does not demonstrate the plan's persona-facing payoff

    @surface.claude-code @surface.openai-codex @surface.cursor @surface.opencode @rejection
    Scenario: A working interaction without the promised payoff does not qualify
      Given a demo uploads bank rows but leaves all invoice matching to the bookkeeper
      When Safeword checks whether the plan is decision-ready
      Then Safeword reports that the demo leaves the bookkeeper's reconciliation pain unchanged

    @surface.claude-code @surface.openai-codex @surface.cursor @surface.opencode @rejection
    Scenario: An impressive claim without supporting evidence does not qualify
      Given a matching prototype's demo claims universal tax certification based on a green badge
      When Safeword checks whether the plan is decision-ready
      Then Safeword reports that the claimed payoff exceeds the prototype's evidence and capabilities
