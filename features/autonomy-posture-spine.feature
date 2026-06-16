Feature: Set an autonomy posture and resolve trusted decisions autonomously

  A team picks a named autonomy posture; safeword pauses on the axes set to
  "ask" and resolves the axes set to "autonomous" itself via a context-loaded
  sub-agent, deferring to the human when it genuinely cannot decide. v1 spine
  of epic 90AZDV — the control-ladder tiers (verify / debate-review /
  async-audit) are out of scope here.

  Rule: Project policy sets the posture

    @autonomy-posture-spine.DEV1.AC1
    Scenario: A project preset is recorded in committed configuration
      Given a project with no autonomy policy
      When the developer selects the "Guard the contract" preset for the project
      Then the project's committed configuration records the "Guard the contract" posture

    @autonomy-posture-spine.DEV1.AC2
    Scenario: A preset resolves to an inspectable per-axis posture map
      Given a project on the "Guard the contract" preset
      When the developer inspects the resolved posture
      Then the behavioral-contract axis reads "ask"
      And the execution axis reads "autonomous"

    @autonomy-posture-spine.DEV1.AC3
    Scenario: Overriding one axis keeps the preset for the rest
      Given a project on the "Hands-off" preset
      When the developer overrides the irreversible-design axis to "ask"
      Then the irreversible-design axis reads "ask"
      And the execution axis still reads "autonomous"

    @autonomy-posture-spine.DEV1.AC4
    Scenario: No policy defaults to Full review
      Given a project with no autonomy policy
      When the developer inspects the resolved posture
      Then every axis reads "ask"

  Rule: Personal policy overrides the project without touching the repo

    @autonomy-posture-spine.DEV2.AC1
    Scenario: Personal override takes precedence over the project policy
      Given a project on the "Full review" preset
      And a personal override setting the execution axis to "autonomous"
      When the developer inspects the resolved posture
      Then the execution axis reads "autonomous"

    @autonomy-posture-spine.DEV2.AC2
    Scenario: The personal override is absent from version control
      Given a personal override setting the execution axis to "autonomous"
      When the repository's tracked changes are listed
      Then the personal override file is not among them

    @autonomy-posture-spine.DEV2.AC3
    Scenario: Without a personal override the project policy governs unchanged
      Given a project on the "Guard the contract" preset
      And no personal override is present
      When the developer inspects the resolved posture
      Then the resolved posture equals the "Guard the contract" map

  Rule: An autonomous axis resolves without pausing

    @autonomy-posture-spine.DEV3.AC1
    Scenario: An ask axis pauses for the human
      Given the intent-and-scope axis is set to "ask"
      When the agent reaches a scope decision it would put to the human
      Then the agent pauses for the human

    @autonomy-posture-spine.DEV3.AC1
    Scenario: An autonomous axis is resolved by a figure-it-out sub-agent
      Given the execution axis is set to "autonomous"
      When the agent reaches an execution decision it would put to the human
      Then a sub-agent resolves the decision by running figure-it-out
      And the agent proceeds without pausing for the human

    @autonomy-posture-spine.DEV3.AC2
    Scenario: The resolution sub-agent receives the full context payload
      Given the execution axis is set to "autonomous"
      When a sub-agent is dispatched to resolve an execution decision
      Then the sub-agent receives the question, the ticket and spec, the relevant prior decisions, and the active constraints

    @autonomy-posture-spine.DEV3.AC3
    Scenario: An autonomous resolution is recorded
      Given the execution axis is set to "autonomous"
      When a sub-agent resolves an execution decision
      Then the work log records the question, the options considered, the pick, and the rationale

  Rule: Autonomy degrades safely when it cannot decide

    @autonomy-posture-spine.DEV3.AC4
    Scenario: A transient figure-it-out failure is retried once
      Given the execution axis is set to "autonomous"
      When the resolution sub-agent's figure-it-out times out on its first attempt
      Then the sub-agent retries figure-it-out once

    @autonomy-posture-spine.DEV3.AC4
    Scenario: A repeated transient failure defers to the human
      Given the execution axis is set to "autonomous"
      And the resolution sub-agent's figure-it-out has already failed once
      When the retry also fails
      Then the decision defers to the human
      And the failed attempts are logged

    @autonomy-posture-spine.DEV3.AC5
    Scenario: An inconclusive verdict defers without retry
      Given the execution axis is set to "autonomous"
      When the resolution sub-agent's figure-it-out completes but reaches no conclusion
      Then the decision defers to the human without a retry

  Rule: Some actions always stop for the human regardless of posture

    @autonomy-posture-spine.DEV5.AC1
    Scenario: A denylisted action prompts even under full autonomy
      Given every axis is set to "autonomous"
      When the agent is about to push to the remote
      Then the agent prompts the human to confirm

    @autonomy-posture-spine.DEV5.AC2
    Scenario: Hard gates still fire under autonomy
      Given every axis is set to "autonomous"
      When uncommitted project changes reach the line-of-code commit threshold
      Then the line-of-code gate fires

    @autonomy-posture-spine.DEV5.AC3
    Scenario: Closing a ticket as done needs explicit human confirmation
      Given every axis is set to "autonomous"
      When the agent is about to mark the ticket done
      Then the agent requires explicit human confirmation
