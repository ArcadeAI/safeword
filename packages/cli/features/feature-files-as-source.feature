@feature-files-as-source
Feature: Gherkin feature files are the scenario source

  Safeword already scaffolds and runs Cucumber feature files. The BDD flow should
  read those files as the behavior source, while test-definitions.md remains the
  progress ledger for R/G/R hooks.

  Rule: Feature tags drive coverage and generated tests

    @feature-files-as-source.SM1.R1
    Scenario: Check reads feature tags before markdown scenario titles
      Given a ticket "DEMO" with two acceptance criteria
      And a feature source for "DEMO" that covers "demo.SM1.AC1"
      When I run "check --offline"
      Then the output contains "demo.SM1.AC2"
      And the output contains "uncovered"

    @feature-files-as-source.SM1.R2
    Scenario: Codify emits Vitest from feature source
      Given a ticket "DEMO" with a feature source containing two scenarios
      When I run "codify DEMO"
      Then the output contains "describe("
      And the output contains "demo.SM1.AC1.feature_source_one"

    @feature-files-as-source.SM1.R2
    Scenario: Codify expands Scenario Outline rows from feature source
      Given a ticket "DEMO" with a Scenario Outline feature source
      When I run "codify DEMO"
      Then the output contains "demo.SM1.AC1.outline_source (source=valid, result=a test stub)"
      And the output contains "demo.SM1.AC1.outline_source (source=tagged, result=coverage tag)"

    @feature-files-as-source.SM1.R1
    Scenario: Check reports invalid feature syntax without parser stack
      Given a ticket "DEMO" with two acceptance criteria
      And an invalid feature source for "DEMO"
      When I run "check --offline"
      Then the output contains "features/demo.feature"
      And the output contains "invalid Gherkin feature"
      And the output does not contain "CompositeParserException"

  Rule: Legacy markdown remains a fallback

    @feature-files-as-source.SM1.R4
    Scenario: Markdown-only tickets still codify
      Given a ticket "DEMO" with one scenario
      When I run "codify DEMO"
      Then the output contains "describe("
      And the output contains "demo.DEV1.AC1.one"

  Rule: Authoring instructions name feature files as source

    @feature-files-as-source.SM1.R3
    Scenario: BDD and review instructions point at feature source
      Given the safeword skill templates
      When I inspect the BDD scenario instructions
      Then the output contains ".feature"
      And the output contains "test-definitions.md is the R/G/R ledger"
