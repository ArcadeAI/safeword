Feature: Numbered Rule tier between JTBD and scenarios

  A spec's JTBD can carry numbered Rules (testable business invariants with
  stable per-JTBD IDs) in place of ACs; scenarios nest under ID-tagged Rule
  blocks, and safeword's checks understand the tier. Repos that never declare
  a Rule keep today's flat AC lineage untouched.

  Rule: A JTBD can carry Rules in place of ACs

    @rule-tier.TB1.AC1
    Scenario: R-only JTBD satisfies the intake-exit gate
      Given a ticket spec whose JTBD declares numbered Rules and no ACs
      When the intake-exit gate evaluates test-definitions creation
      Then the gate allows the creation

    @rule-tier.TB1.AC1 @rejection
    Scenario: JTBD with neither criteria kind is denied naming Rules as an option
      Given a ticket spec whose JTBD declares no ACs, no Rules, and no skip line
      When the intake-exit gate evaluates test-definitions creation
      Then the gate denies the creation
      And the denial message names both Acceptance Criteria and numbered Rules as options

    @rule-tier.TB1.AC1
    Scenario: JTBD with a skip line still satisfies the gate
      Given a ticket spec whose JTBD carries a skip line instead of criteria
      When the intake-exit gate evaluates test-definitions creation
      Then the gate allows the creation

  Rule: A JTBD declares one criteria kind, never both

    @rule-tier.TB1.AC4 @rejection
    Scenario: Mixed AC and Rule JTBD is flagged as a check issue
      Given a ticket spec whose JTBD declares both an AC heading and a numbered Rule heading
      When safeword check runs
      Then a check issue names that JTBD as mixing criteria kinds

  Rule: Rule blocks carry authoritative tags and scenarios inherit exactly one lineage reference

    @rule-tier.TB2.AC1
    Scenario: Scenarios under an ID-tagged Rule block pass lineage lint by inheritance
      Given a feature file whose Rule block carries a rule ID tag and untagged scenarios
      When lineage lint runs
      Then no lineage issue is reported

    @rule-tier.TB2.AC1 @rejection
    Scenario: A second lineage reference under an ID-tagged Rule block is rejected
      Given a feature file whose Rule block carries a rule ID tag and a scenario adds an AC lineage tag
      When lineage lint runs
      Then a multiple-lineage issue names that scenario

    @rule-tier.TB2.AC1
    Scenario: A tag ending in an AC segment parses as an AC reference, never a rule reference
      Given a feature file with a scenario tagged "@feat.R1.AC1"
      When lineage lint runs
      Then the tag is read as one AC reference for JTBD "feat.R1"
      And no lineage issue is reported

    @rule-tier.TB2.AC1 @rejection
    Scenario: Rule block whose name token disagrees with its tag is rejected
      Given a feature file whose Rule block tag and leading name token carry different rule IDs
      When gherkin lint runs
      Then a name-tag mismatch issue names that Rule block

    @rule-tier.TB2.AC1
    Scenario: A tag expression on a rule ID runs exactly that rule's scenarios
      Given a feature file with two ID-tagged Rule blocks
      When the cucumber lane runs with a tag expression selecting one rule ID
      Then only the scenarios under that Rule block execute

  Rule: Check reports rule drift against the spec catalog

    @rule-tier.TB3.AC1
    Scenario: Spec rule with no referencing scenario is reported uncovered
      Given a ticket spec declaring a numbered Rule that no feature scenario references
      When safeword check runs
      Then an uncovered advisory names that rule ID

    @rule-tier.TB3.AC1
    Scenario: Rule reference with a missing rule number is reported stale
      Given a feature scenario referencing a rule number its spec JTBD never declared
      When safeword check runs
      Then a stale advisory names that rule reference

    @rule-tier.TB3.AC1
    Scenario: Rule reference whose JTBD is absent is reported orphan
      Given a feature scenario referencing a rule under a JTBD absent from the spec
      When safeword check runs
      Then an orphan advisory names that rule reference

  Rule: A rule with no rejection path is visible

    @rule-tier.TB1.AC2
    Scenario: Numbered rule with no rejection scenario draws an advisory
      Given a spec-declared numbered Rule whose feature scenarios carry no rejection tag
      When safeword check runs
      Then a zero-rejection-path advisory names that rule ID

    @rule-tier.TB1.AC2
    Scenario: Numbered rule with a rejection scenario is silent
      Given a spec-declared numbered Rule with at least one rejection-tagged feature scenario
      When safeword check runs
      Then no zero-rejection-path advisory is reported

  Rule: Non-adopters see zero change

    @rule-tier.TB1.AC3
    Scenario: AC-only project output is unchanged
      Given a project whose specs and feature files use only AC lineage
      When safeword check and gherkin lint run
      Then the output matches today's flat-lineage output exactly

  Rule: An existing rule-numbered corpus is expressible

    @rule-tier.TB4.AC1
    Scenario: Per-JTBD numbered Rule corpus parses and lints without restructuring
      Given a feature file shaped like an existing rule-numbered corpus with a matching spec catalog
      When safeword check and gherkin lint run
      Then no lineage issue is reported
      And the coverage report resolves every rule reference

  Rule: Rule warnings are plain-language and actionable

    @rule-tier.NTB1.AC1
    Scenario: Zero-rejection advisory states the problem and next action without jargon
      Given a spec-declared numbered Rule whose feature scenarios carry no rejection tag
      When safeword check runs
      Then the advisory names the rule ID, states that no example shows the rule being broken, and says to add a rejection-tagged scenario

    @rule-tier.NTB1.AC1
    Scenario: Mixed-criteria issue states the problem and next action without jargon
      Given a ticket spec whose JTBD declares both an AC heading and a numbered Rule heading
      When safeword check runs
      Then the issue names the JTBD, states that a job keeps one criteria kind, and names both kinds as the choice
