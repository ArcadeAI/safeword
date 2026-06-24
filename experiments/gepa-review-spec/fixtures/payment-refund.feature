Feature: Payment refunds
  Customers can refund a completed payment.

  Scenario: Refund a completed payment
    Given a completed payment of 50.00 USD
    When the customer requests a full refund
    Then a response is returned

  Scenario: Partial refund reduces the refundable balance
    Given a completed payment of 50.00 USD
    When the customer refunds 20.00 USD
    Then the remaining refundable balance is 30.00 USD
