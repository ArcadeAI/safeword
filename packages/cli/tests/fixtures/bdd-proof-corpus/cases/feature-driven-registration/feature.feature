Feature: Price discounts
  Scenario: Members receive a discount
    When a member buys a 100 dollar item
    Then the total is 80 dollars
