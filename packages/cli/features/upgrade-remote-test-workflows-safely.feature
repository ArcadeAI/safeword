@surface.safeword-cli @surface.github-actions-execution-sandbox
Feature: Upgrade remote-test workflows safely

  @upgrade-remote-test-workflows-safely.TBU1.R1
  Rule: upgrade-remote-test-workflows-safely.TBU1.R1 — Only exact released Safeword workflows authorize managed lifecycle changes

    Scenario: Setup upgrades an unchanged released workflow
      Given the remote-test workflow contains exact released predecessor bytes
      When the builder runs remote workflow setup
      Then the workflow contains the complete current Safeword bytes

    @rejection
    Scenario: Setup preserves a customer-edited predecessor
      Given the remote-test workflow differs from every released Safeword identity
      When the builder runs remote workflow setup
      Then setup requires the builder to move the customer-owned workflow aside

    Scenario: Disable removes an unchanged released workflow
      Given the remote-test workflow contains exact released predecessor bytes
      When the builder runs remote workflow disable
      Then no managed remote-test workflow remains

  @upgrade-remote-test-workflows-safely.TBU1.R2
  Rule: upgrade-remote-test-workflows-safely.TBU1.R2 — Interrupted upgrades expose complete predecessor or successor bytes and retry safely

    @rejection
    Scenario: Failed replacement preparation preserves the released predecessor
      Given the remote-test workflow contains exact released predecessor bytes
      And replacement preparation cannot complete
      When the builder runs remote workflow setup
      Then the complete released predecessor remains installed

    Scenario: Retry after a preparation failure installs the complete current workflow
      Given a prior setup attempt left the complete released predecessor installed
      When the builder retries remote workflow setup after preparation recovers
      Then the workflow contains the complete current Safeword bytes
