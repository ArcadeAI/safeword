# This feature is proven by CLI, hook, schema, and skill-contract Vitest suites;
# duplicating those filesystem and phase-boundary fixtures in Cucumber would add
# no independent signal.
@proof.vitest
Feature: Lean Product Plans
  Safeword captures product intent once and carries it into feature delivery
  without repetitive planning documents.

  @lean-product-plans.NTB1.R1
  Rule: lean-product-plans.NTB1.R1 — Every feature epic and standalone feature has one decision-ready Product Plan

    @surface.safeword-cli
    Scenario: Creating a feature epic creates one compact Product Plan
      Given a project with Safeword installed
      When a Non-Technical Builder creates a feature epic
      Then its ticket contains a Product Plan with Product Bet, highest-level Jobs To Be Done, Shape, and Killer Demo
      And Shape declares at least one stable milestone id with an outcome and non-goals

    @surface.safeword-cli
    Scenario: Creating a standalone feature creates the same four sections scaled to the feature
      Given a project with Safeword installed
      When a Non-Technical Builder creates a feature without a parent
      Then its ticket contains a Product Plan with Product Bet, persona Jobs To Be Done with numbered Rules, Shape, and Killer Demo

    @surface.safeword-cli
    @rejection
    Scenario: Product planning does not create a second product-plan artifact
      Given a project with Safeword installed
      When a Non-Technical Builder creates a feature epic
      Then product intent exists in spec.md and no product-plan.md exists

    @surface.claude-code @surface.openai-codex @surface.cursor @surface.opencode
    @rejection
    Scenario: Template prose does not qualify as a success threshold
      Given a Product Bet's success threshold only restates its template prompt
      When Safeword checks whether the plan is decision-ready
      Then Safeword reports that the success threshold is not falsifiable

    @surface.claude-code @surface.openai-codex @surface.cursor @surface.opencode
    Scenario: An authored Product Bet has a falsifiable success threshold
      Given a Product Bet whose success threshold states a falsifiable outcome tied to the product goal
      When Safeword checks whether the plan is decision-ready
      Then Safeword reports the plan is decision-ready with no success-threshold finding

    @surface.claude-code @surface.openai-codex @surface.cursor @surface.opencode
    Scenario: An observable outcome replaces an invented metric
      Given a Product Bet has no meaningful numeric measure
      When Safeword drafts the Product Plan
      Then its success threshold names a falsifiable observable outcome without inventing a metric

  @lean-product-plans.NTB1.R2
  Rule: lean-product-plans.NTB1.R2 — A child feature references its parent milestone and job while authoring only its contribution and Rules

    @surface.safeword-cli
    Scenario: A child feature stores a valid parent contribution without copied prose
      Given an epic Product Plan declares milestone M1 and a parent job
      When a Non-Technical Builder creates a child feature for M1 and that job
      Then the child records its parent id, milestone M1, parent job, contribution, and Rules as resolvable references without copied Product Bet prose

    @surface.safeword-cli
    @rejection
    Scenario: An unknown milestone is rejected when a child is created
      Given an epic Product Plan does not declare milestone M9
      When a Non-Technical Builder creates a child feature assigned to M9
      Then Safeword reports that the milestone does not resolve in the parent Product Plan

    @surface.safeword-cli
    @rejection
    Scenario: A child feature must select a declared milestone
      Given an epic Product Plan declares milestone M1
      When a Non-Technical Builder creates a child feature without a milestone reference
      Then Safeword reports that a declared parent milestone is required

    @surface.safeword-cli
    @rejection
    Scenario: A renamed milestone invalidates an existing child reference
      Given an approved child feature references parent milestone M1
      And the parent Product Plan now declares milestone M2 instead of M1
      When a Non-Technical Builder validates the child feature
      Then Safeword reports that the milestone does not resolve in the parent Product Plan

    @surface.safeword-cli
    @rejection
    Scenario: An unknown parent cannot be assigned to a child feature
      Given no ticket with id ABC123 exists
      When a Non-Technical Builder creates a child feature whose parent is ABC123
      Then Safeword reports that the parent ticket does not resolve

    @surface.safeword-cli
    @rejection
    Scenario: A non-epic ticket cannot own a child feature
      Given a standalone feature ticket exists
      When a Non-Technical Builder assigns another feature to it as a parent
      Then Safeword reports that the parent is not a feature epic

  @lean-product-plans.NTB1.R3
  Rule: lean-product-plans.NTB1.R3 — Safeword bundles focused demand research for decision-critical uncertainty or an explicit builder request

    @surface.claude-code @surface.openai-codex @surface.cursor @surface.opencode
    Scenario: The bundled workflow reports a compact decision result
      Given Safeword is installed for an agent runtime
      When the packaged demand-research workflow produces a result
      Then it reports a demand verdict, strongest evidence, evidence gaps, and cheapest validation

    @surface.claude-code @surface.openai-codex @surface.cursor @surface.opencode
    @rejection
    Scenario: The bundled workflow excludes general research modes
      Given the packaged demand-research skill is installed
      When a Non-Technical Builder inspects its supported workflow
      Then it contains no vendor, competitor, market-history, or technology-history research mode

    @surface.claude-code @surface.openai-codex @surface.cursor @surface.opencode
    Scenario: Existing first-party evidence is used before external research
      Given a Product Bet has decision-bearing product telemetry
      When Safeword drafts the Product Plan
      Then Product Bet cites that telemetry source without requiring external demand research

    @surface.claude-code @surface.openai-codex @surface.cursor @surface.opencode
    Scenario: An explicit demand-validation request uses the bundled workflow
      Given a Product Bet has sufficient project evidence
      And a Non-Technical Builder explicitly asks to validate demand
      When Safeword drafts the Product Plan
      Then Safeword uses the packaged demand-research workflow and records its compact verdict in Product Bet

    @surface.claude-code @surface.openai-codex @surface.cursor @surface.opencode
    Scenario: Unresolved demand routes to the bundled demand-research skill
      Given a standalone feature is a meaningful product bet
      And available project evidence cannot support the demand claim
      And that uncertainty could change the decision to build
      When Safeword drafts the Product Plan
      Then Safeword uses the packaged demand-research workflow and records its compact verdict in Product Bet

    @surface.claude-code @surface.openai-codex @surface.cursor @surface.opencode
    @rejection
    Scenario: Child features do not repeat parent demand research
      Given an epic Product Plan already owns the demand claim
      When a Non-Technical Builder creates a child feature under that epic
      Then the child references the parent job without a demand-research section or run

    @surface.claude-code @surface.openai-codex @surface.cursor @surface.opencode
    Scenario: A cheaper reversible experiment replaces a broad research pass
      Given demand is uncertain for a reversible product bet
      And a bounded experiment can settle the build decision more cheaply
      When Safeword drafts the Product Plan
      Then Safeword records the experiment as the cheapest validation instead of requiring broad research

    @surface.claude-code @surface.openai-codex @surface.cursor @surface.opencode
    Scenario Outline: Work with settled demand does not trigger demand research
      Given a Product Plan covers <settled work>
      When Safeword drafts the Product Plan
      Then it uses the settled rationale without running demand research

      Examples:
        | settled work |
        | mandated work |
        | parity work |

    @surface.claude-code @surface.openai-codex @surface.cursor @surface.opencode
    @rejection
    Scenario: Inconclusive demand research does not block product planning
      Given the bundled demand-research workflow returns no decision-bearing evidence
      When Safeword drafts the Product Plan
      Then it records an ABSENT verdict with the cheapest validation

    @surface.safeword-cli
    Scenario: An absent demand verdict does not block approval
      Given a Product Plan whose demand verdict is ABSENT
      When a Non-Technical Builder advances the plan to approval
      Then Safeword completes the phase transition

    @surface.claude-code @surface.openai-codex @surface.cursor @surface.opencode
    @rejection
    Scenario: Unavailable demand research does not invent a verdict
      Given the bundled demand-research workflow is unavailable
      When Safeword drafts the Product Plan
      Then it records the unavailable evidence gap and the cheapest validation without claiming demand strength

  @lean-product-plans.NTB1.R5
  Rule: lean-product-plans.NTB1.R5 — Inapplicable planning sections create no placeholder or skip work

    @surface.safeword-cli
    @rejection
    Scenario: Product Plans contain no comms or launch prompt
      Given a project with Safeword installed
      When Safeword creates a standalone Product Plan
      Then no comms or launch section or placeholder is present

    @surface.safeword-cli
    @rejection
    Scenario: Child specs contain no inherited headings or skip placeholders
      Given an epic owns the Product Plan
      When a Non-Technical Builder creates a child feature under that epic
      Then the child spec contains no inherited Product Plan headings, including Killer Demo, and no skip placeholders

  @lean-product-plans.NTB1.R6
  Rule: lean-product-plans.NTB1.R6 — A child reconciles decision-bearing parent changes before advancing

    @surface.safeword-cli
    @rejection
    Scenario Outline: A referenced parent contract change blocks advancement
      Given a child feature was approved against a parent job and milestone
      And the parent Product Plan now has a changed <contract member>
      When a Non-Technical Builder advances the child
      Then Safeword refuses the phase transition and identifies the changed parent contract

      Examples:
        | contract member |
        | parent job |
        | selected milestone outcome |
        | selected milestone non-goals |
        | project non-goals |
        | success threshold |

    @surface.safeword-cli
    Scenario: Reconciling a changed parent contract unblocks advancement
      Given a child feature was blocked by a changed referenced milestone outcome
      When a Non-Technical Builder reconciles the child against the current parent contract
      Then the child advances to the next phase

    @surface.safeword-cli
    Scenario Outline: A non-contract parent change creates no reconciliation work
      Given a child feature was approved against a parent job and milestone
      And the parent Product Plan now has changed <non-contract content>
      When a Non-Technical Builder advances the child
      Then the child advances without reconciling its Product Plan

      Examples:
        | non-contract content |
        | editorial prose |
        | a research reference |
        | Killer Demo wording |
