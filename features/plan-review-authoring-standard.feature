# Executable proof lives in the adjacent Vitest manifest: extraction and packet
# behavior are lower-level contracts that Cucumber would only duplicate.
@surface.safeword-cli @surface.claude-code @surface.openai-codex @surface.cursor @proof.vitest
Feature: Judge implementation plans by their authoring standard
  Safeword maintainers need plan review to apply the same criteria used to
  author the plan, without confusing supporting context for reviewed work.

  Rule: plan-review-alignment.SWM1.R1 Plan authoring and review share one canonical judgment contract

    Scenario: Runtime review uses the canonical plan judgment block
      Given PLAN_IMPLEMENTATION.md contains one reviewer-safe judgment block
      When Safeword generates and runs plan-review instructions
      Then the runtime rubric is byte-identical to that canonical block
      And generated host deliveries retain the canonical authoring guidance

  Rule: plan-review-alignment.SWM1.R2 The review packet distinguishes the plan under review from supporting evidence

    Scenario: Supporting planning evidence is context rather than reviewed work
      Given a plan review resolves impl-plan.md and its supporting feature artifacts
      When Safeword prepares the review packet
      Then impl-plan.md is the only logical work file
      And the spec, ticket, feature, principles, personas, surfaces, and decision records are context files

  Rule: plan-review-alignment.SWM1.R3 Broken or stale projections fail before release

    Scenario Outline: Invalid canonical plan rubric cannot generate
      Given the canonical plan skill has a <defect> rubric block
      When Safeword extracts the reviewer projection
      Then generation fails closed

      Examples:
        | defect |
        | missing |
        | duplicate |
        | reversed |
        | empty |
        | host-only |

    Scenario: Stale generated plan rubric cannot pass release checks
      Given the canonical plan judgment block changed
      And the generated runtime projection did not
      When Safeword checks generated artifacts
      Then the check fails as stale
