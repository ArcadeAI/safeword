@surface.safeword-cli
Feature: Keep the acceptance lane out of the developer's plugin store

  Safeword's Claude install ends in `claude plugin install`, which records the
  project against the ambient CLAUDE_CONFIG_DIR. Without a guard, every
  acceptance scenario that runs the real CLI writes an install record into the
  developer's own ~/.claude that Claude Code never prunes (issue #4776).

  This scenario runs inside the real Cucumber lifecycle on purpose. A unit test
  that imports the guard and calls it directly still passes when the runner
  never discovers the guard at all, which is exactly the failure that would let
  the leak resume unnoticed.

  Scenario: The acceptance lane runs against a sandboxed host profile
    When a scenario in this lane reaches its first step
    Then the Claude host profile points at Safeword's test sandbox
    And the Claude host profile is outside the developer's home directory
