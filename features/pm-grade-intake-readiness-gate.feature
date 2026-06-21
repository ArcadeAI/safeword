Feature: PM-grade intake readiness gate
  At the Clarify→Build boundary the agent surfaces a compressed five-dimension
  readiness self-test so it captures enough context before acting — without
  re-interrogating clear, reversible requests. The pointer is a Clarify-phase
  device: it appears while the work is still being scoped and disappears once
  implementation is under way. SAFEWORD.md carries the value-of-information
  triage that tells the agent when "enough" has been reached.

  Rule: The readiness pointer surfaces only during Clarify

    Scenario: Pre-classify (no active ticket) surfaces the readiness pointer
      Given a session with no active ticket
      When the prompt reminder is generated
      Then it includes the five-dimension readiness pointer

    Scenario: An intake-phase ticket surfaces the readiness pointer
      Given an active ticket in the intake phase
      When the prompt reminder is generated
      Then it includes the five-dimension readiness pointer

    Scenario: An implement-phase ticket suppresses the readiness pointer
      Given an active ticket in the implement phase
      When the prompt reminder is generated
      Then it shows the implement-phase TDD-step guidance
      And it does not include the readiness pointer

  Rule: The pointer is a compressed pointer, not a checklist

    Scenario: The pointer names all five dimensions
      Given a Clarify-phase prompt reminder
      When the readiness pointer is rendered
      Then it names intent, done, constraints, riskiest assumption, and request shape

    Scenario: The pointer stays within the length cap
      Given a Clarify-phase prompt reminder
      When the readiness pointer is rendered
      Then the pointer text stays within the length cap

    Scenario: The constraint dimension is scoped to what must not break
      Given a Clarify-phase prompt reminder
      When the readiness pointer is rendered
      Then the constraint dimension reads as "what must not break / reversibility" rather than a general quality-attributes survey

  Rule: SAFEWORD.md carries the triage guidance

    Scenario: SAFEWORD.md states the value-of-information triage
      Given the SAFEWORD.md standing instructions
      When the intake guidance is read
      Then it states the triage that reversible work proceeds and irreversible work resolves unknowns first

    Scenario: SAFEWORD.md defines readiness as edge-case-level questions
      Given the SAFEWORD.md standing instructions
      When the intake guidance is read
      Then it defines readiness as remaining questions being edge-cases, not basics
