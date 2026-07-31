# User Stories: Keep BDD evidence honest

## Story 1: Trust scenario completion claims

As a Safeword user,
I want a user-visible BDD scenario to be completed only by evidence that
exercises its actor-facing action and observes its actor-visible result,
so that a green scenario means the described experience was actually
demonstrated.

### Acceptance Criteria

#### 1698.SU1.AC1 - Primary proof preserves the scenario contract

Given a scenario whose `When` names or implies an actor-facing entry point
When the agent chooses the scenario's primary proof
Then that proof exercises the same entry point instead of substituting a direct
application-store call or lower-level injected event.

#### 1698.SU1.AC2 - Assertions preserve the observable result

Given a scenario whose `Then` names an actor-visible result
When the agent completes the scenario
Then the primary proof observes that result instead of treating internal store
or editor state as equivalent evidence.

#### 1698.SU1.AC3 - Setup and supporting tests remain proportionate

Given a scenario also needs fixtures or lower-level logic coverage
When the agent builds its proof
Then direct setup remains allowed in `Given` and lower-level tests remain
supporting evidence without inheriting the broader scenario claim.

#### 1698.SU1.AC4 - Unavailable automation is reported honestly

Given the actor-facing action or result cannot be automated reliably
When the agent records scenario evidence
Then it routes the scenario through the existing `@manual` or `@live` path and
does not complete it from narrower implementation evidence alone.

#### 1698.SU1.AC5 - Every shipped agent surface carries the contract

Given Safeword generates its Codex plugin from the canonical skill templates
When the scenario-proof contract changes
Then the generated Codex plugin carries the same contract and passes the
release-catalogue verification.
