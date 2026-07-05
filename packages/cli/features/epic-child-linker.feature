@epic-child-linker.TB1
Feature: ticket new --parent links a child to its epic

  A Technical Builder decomposing an epic creates each child with
  --parent <epicId>; the command writes both ends of the epic-child link and
  the index groups the child under its epic. The child-epic relationship has a
  single source of truth: the child's parent field.

  Rule: --parent links a new child to its epic both ways

    @epic-child-linker.TB1.AC1
    Scenario: Linking records the child's parent and appends to the epic
      Given an epic ticket with an empty children list
      When I create a child ticket with --parent naming that epic
      Then the child's parent field names the epic
      And the epic's children list contains the new child's id

    # Navigation (findNextWork reaches the linked child) is an internal contract
    # with no CLI surface — proven by the integration test
    # tests/integration/epic-child-linker-navigation.test.ts, not this black-box lane.

  Rule: A linked child appears under its epic in the index

    @epic-child-linker.TB1.AC2
    Scenario: The index groups the child under its epic heading
      Given an epic and a child linked to it with --parent
      When the ticket index is regenerated
      Then the child is listed under the epic's heading

  Rule: An invalid --parent fails loud and changes nothing

    @epic-child-linker.TB1.AC3
    Scenario: --parent naming no existing ticket is rejected
      Given no ticket exists with the id "ZZZZZZ"
      When I create a child ticket with --parent "ZZZZZZ"
      Then the command exits non-zero reporting the epic was not found
      And no child ticket folder is created

    @epic-child-linker.TB1.AC3
    Scenario: --parent naming a non-epic ticket is rejected
      Given a task ticket that is not an epic
      When I create a child ticket with --parent naming that task
      Then the command exits non-zero reporting the parent is not an epic
      And the target ticket's frontmatter is unchanged
      And no child ticket folder is created

  Rule: Linking is idempotent and preserves the epic's existing children

    @epic-child-linker.TB1.AC4
    Scenario: Appending a second child preserves the first
      Given an epic whose children list already names one child
      When I link a second child to that epic with --parent
      Then the epic's children list names both children

    # Idempotency (re-linking the same id adds it once) has no CLI path — each
    # `ticket new` mints a fresh id — so it is proven at the unit layer in
    # src/utils/epic-linker.test.ts, not this black-box lane.
