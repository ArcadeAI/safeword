Feature: Account isolation
  Background:
    Given a fresh account store

  Scenario: Account A can be created
    When I create account A
    Then this store contains account A

  Scenario: A new scenario starts empty
    Then this store contains 0 accounts
