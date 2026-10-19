@surface.safeword-cli
Feature: Review bounded changes to large lockfiles

  Developers can obtain usable independent review of a small dependency change
  without excluding the original lockfile or losing freshness protection.

  Rule: Complete bounded lockfile changes retain original-file coverage and freshness

    Scenario: A large lockfile approval covers the original file until its source changes
      Given a tracked oversized bun.lock with a bounded version change
      And an independent reviewer is available
      When a builder runs the public review command
      Then the reviewer receives the original lockfile target with its complete bounded patch
      And the lockfile approval witnesses original-file implementation coverage
      When the reviewed lockfile source changes
      Then the public review status reports the lockfile approval as stale
