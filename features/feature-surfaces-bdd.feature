Feature: Let projects track feature surfaces during BDD

  @feature-surfaces-bdd.TB1.AC1 @feature-surfaces-bdd.SM1.AC1 @surface.safeword-cli
  Rule: Project setup scaffolds the surface inventory at the resolved namespace root

    @feature-surfaces-bdd.TB1.AC1
    Scenario: Fresh setup creates a starter surfaces file
      Given a customer project with no namespace root
      When safeword setup reconciles the project
      Then the resolved namespace root contains surfaces.md with starter guidance

    @feature-surfaces-bdd.SM1.AC1
    Scenario: Configured namespace root receives the starter surfaces file on upgrade
      Given a customer project whose safeword config sets paths.projectRoot
      When safeword upgrade reconciles the project
      Then surfaces.md is created under the configured namespace root

  @feature-surfaces-bdd.TB1.AC2 @feature-surfaces-bdd.SM1.AC1 @surface.safeword-cli
  Rule: Surface files follow the persona managed-file contract

    @feature-surfaces-bdd.TB1.AC2
    Scenario: Existing surface inventory survives setup byte-identical
      Given a customer project with an authored surfaces.md
      When safeword setup reconciles the project
      Then the authored surfaces.md content is unchanged

    @feature-surfaces-bdd.SM1.AC1
    Scenario: Configured surfaces path suppresses the default scaffold
      Given a customer project whose safeword config sets paths.surfaces
      When safeword upgrade reconciles the project
      Then the default namespace-root surfaces.md is not created

  @feature-surfaces-bdd.TB1.AC3 @feature-surfaces-bdd.NTB1.AC1 @surface.claude-code @surface.openai-codex @surface.cursor
  Rule: BDD artifacts name surfaces without adding a hard gate

    @feature-surfaces-bdd.TB1.AC3
    Scenario: BDD intake loads project surfaces after personas and glossary
      Given the installed BDD intake guidance
      When an agent starts feature intake
      Then the guidance tells the agent to load surfaces.md after personas.md and glossary.md

    @feature-surfaces-bdd.NTB1.AC1
    Scenario: Feature specs include an optional Surfaces section
      Given the installed feature spec template
      When a feature spec is scaffolded
      Then it includes a Surfaces section for affected runtime contexts

  @feature-surfaces-bdd.SM1.AC2
  Rule: Feature sources prove affected surface coverage

    @feature-surfaces-bdd.SM1.AC2 @surface.safeword-cli
    Scenario: Check reports an affected runtime with no feature tag
      Given an in-progress feature that affects Claude Code and OpenAI Codex
      When safeword check runs
      Then safeword reports missing surface coverage for OpenAI Codex
