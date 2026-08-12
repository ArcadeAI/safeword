Feature: Shipping quotes
  Scenario Outline: Destination controls the quote
    When I quote shipping to "<country>"
    Then the price is <price>

    Examples:
      | country | price |
      | US      | 5     |
      | AU      | 12    |
