Feature: sync-tracker projection
  safeword projects the local ticket corpus one-way into a configured issue tracker.

  Scenario: An active ticket projects to an open issue
    Given an active ticket with an epic and a type
    When the payload builder maps it
    Then the payload state is "open"

  Scenario: A project with no configured tracker makes no calls
    Given a project whose tracker provider is none
    When sync-tracker runs
    Then the recording client received no calls

  Scenario: A terminal ticket projects to a closed issue
    Given a ticket whose status is terminal
    When the payload builder maps it
    Then the payload state is "closed"
