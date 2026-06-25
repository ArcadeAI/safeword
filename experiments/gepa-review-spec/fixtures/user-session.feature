Feature: User sessions
  Sessions expire after inactivity and can be ended manually.

  Scenario: Session expires after inactivity
    Given a user logged in at 09:00
    When 30 minutes pass with no activity
    Then the session is expired

  Scenario: User logs in and then logs out
    Given a registered user
    When the user logs in with valid credentials
    And the user clicks log out
    Then the session is active
    And the session is then ended
