Feature: PM-grade intake readiness gate
  At the Clarify->Build boundary the agent surfaces a compressed readiness
  self-test, and suppresses it once implementation is under way.

  Scenario: Pre-classify with no active ticket surfaces the readiness pointer
    Given a session with no active ticket
    When the prompt reminder is generated
    Then it includes the five-dimension readiness pointer

  Scenario: An implement-phase ticket suppresses the readiness pointer
    Given an active ticket in the implement phase
    When the prompt reminder is generated
    Then it does not include the readiness pointer

  Scenario: The pointer names all five dimensions
    Given a Clarify-phase prompt reminder
    When the readiness pointer is rendered
    Then the readiness pointer renders without error

  Scenario: The constraint dimension is scoped to what must not break
    Given a Clarify-phase prompt reminder
    When the readiness pointer is rendered
    Then a constraint dimension is present in the pointer
