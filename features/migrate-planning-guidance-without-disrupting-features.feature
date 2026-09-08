Feature: Migrate planning guidance without disrupting features
  Safeword replaces legacy design routes without retroactively blocking accepted implementation work.

  @plan-implementability.TBU1.YCFFNC.R1
  Rule: plan-implementability.TBU1.YCFFNC.R1 — In-flight tickets migrate without retroactive blocking

    @surface.safeword-cli @surface.claude-code @surface.claude-code-cloud @surface.openai-codex @surface.opencode @surface.cursor @surface.cursor-cloud-agents
    @rejection
    Scenario Outline: Upgrade behavior follows the ticket's existing phase
      Given an upgraded legacy feature is in <legacy_state>
      When the new planning workflow resumes it
      Then <migration_result>

      Examples:
        | legacy_state | migration_result |
        | before implementation with an existing plan | that plan becomes a draft Implementation Plan and an Execution Plan is required |
        | implementation with a previously accepted plan | work continues without retroactive blocking |
        | implementation that returns to planning | the ticket enters the new planning flow |

  @plan-implementability.TBU1.YCFFNC.R2
  Rule: plan-implementability.TBU1.YCFFNC.R2 — Planning guidance names only the two feature plans

    @rejection
    Scenario: Reconciled planning guidance removes the legacy design artifact
      Given an installed planning guide and feature artifact catalogue are upgraded
      When their feature-planning routes are read
      Then they name Implementation Plan and Execution Plan and contain neither a feature design artifact nor a design template route

  @plan-implementability.TBU1.YCFFNC.R3
  Rule: plan-implementability.TBU1.YCFFNC.R3 — Architecture guidance redirects feature-local design

    @rejection
    Scenario: Architecture guidance preserves durable routing without a second feature plan
      Given a feature contains one significant architectural choice and one local component choice
      When the architecture decision tree, tie-breaker, and file examples are applied
      Then the significant choice is durably recorded and both choices point back to the Implementation Plan

  @plan-implementability.TBU1.YCFFNC.R4
  Rule: plan-implementability.TBU1.YCFFNC.R4 — Data guidance uses semantic applicability and significance

    @rejection
    Scenario: Numeric and simple-schema carve-outs cannot override a relevant data change
      Given a single-entity feature changes data lifecycle and ownership
      When the reconciled architecture and data guidance is applied
      Then data guidance is required and durable recording is decided by architectural significance rather than entity count

  @plan-implementability.TBU1.YCFFNC.R5
  Rule: plan-implementability.TBU1.YCFFNC.R5 — Deep design is folded into the Implementation Plan

    @rejection
    Scenario: A complex feature receives deep design without another artifact lane
      Given a feature requires detailed component and data-model decisions
      When its Implementation Plan is authored
      Then the detailed decisions appear in that plan and no separate deep-design artifact is requested
