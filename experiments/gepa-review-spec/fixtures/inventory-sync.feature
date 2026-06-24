Feature: Inventory synchronization
  Stock levels stay consistent with the warehouse feed.

  Scenario: Applying a stock increase updates the available count
    Given product SKU-1 has 4 units available
    When a warehouse feed adds 6 units for SKU-1
    Then product SKU-1 has 10 units available

  Scenario: Rejecting a feed update for an unknown SKU
    Given no product exists for SKU-9
    When a warehouse feed adds 5 units for SKU-9
    Then the update is rejected with reason "unknown SKU"
    And no product is created for SKU-9
