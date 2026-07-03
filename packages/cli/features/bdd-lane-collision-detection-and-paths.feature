@wip @spec:56JCFZ
Feature: Detect existing cucumber harness, configurable feature/step paths

  Setup adopts a host repo's cucumber harness instead of scaffolding a second
  one, and `paths.features` / `paths.steps` in `.safeword/config.json` point
  safeword's BDD readers and the scaffolded runner at relocated lane
  directories (augment semantics — defaults stay searched). Issue #645.

  Rule: Setup never scaffolds a second harness

    @bdd-lane-collision-detection-and-paths.TB1.AC1
    Scenario: Setup skips the starter lane when a root cucumber config exists
      Given a project with a customer-authored "cucumber.yaml" at the root
      When I run "setup"
      Then no starter lane file is created
      And no cucumber dependency is added to package.json
      And no "test:bdd" script is added
      And the output names "cucumber.yaml" as the detected harness
      And the output shows the "paths.features" and "paths.steps" config lines to add

    @bdd-lane-collision-detection-and-paths.TB1.AC1
    Scenario: Setup skips the starter lane when a workspace package depends on cucumber
      Given a project with no root cucumber config
      And a direct workspace package whose package.json depends on "@cucumber/cucumber"
      When I run "setup"
      Then no starter lane file is created
      And no cucumber dependency is added to package.json
      And the output names the workspace package's cucumber dependency as the detected harness

    @bdd-lane-collision-detection-and-paths.TB1.AC1
    Scenario: Setup skips the starter lane when a customer-authored cucumber.mjs exists
      Given a project with a root "cucumber.mjs" whose content differs from safeword's template
      When I run "setup"
      Then no starter lane file is created
      And the customer's "cucumber.mjs" content is unchanged

    @bdd-lane-collision-detection-and-paths.TB1.AC4
    Scenario: Setup scaffolds the starter lane when no cucumber exists anywhere
      Given a project with no cucumber config and no cucumber dependency
      When I run "setup"
      Then the starter lane files are created
      And the cucumber dependencies are added
      And the "test:bdd" script is added

  Rule: Safeword never mistakes its own scaffold for a host harness

    @bdd-lane-collision-detection-and-paths.TB1.AC2
    Scenario: Upgrade keeps maintaining the lane safeword installed
      Given a project where safeword setup previously scaffolded the starter lane
      When I run "upgrade"
      Then "cucumber.mjs" is still safeword's template content
      And no detected-harness advisory is reported

  Rule: Uninstall removes only what safeword owns

    @bdd-lane-collision-detection-and-paths.TB1.AC3
    Scenario: Reset leaves a host harness untouched
      Given a project with a customer-authored "cucumber.mjs" and its own cucumber dependencies
      And safeword was set up with the starter lane suppressed
      When I run "reset"
      Then the customer's "cucumber.mjs" still exists with unchanged content
      And the customer's cucumber dependencies remain in package.json

    @bdd-lane-collision-detection-and-paths.TB1.AC5
    Scenario: Full uninstall never deletes files at configured paths locations
      Given a project with "paths.features" configured to "tests/behaviors"
      And a feature file inside "tests/behaviors"
      When I run "uninstall" with full removal
      Then the feature file inside "tests/behaviors" still exists

  Rule: Configured paths augment discovery for safeword's readers

    @bdd-lane-collision-detection-and-paths.TB2.AC1
    Scenario: Codify finds a ticket's feature source in a configured directory
      Given a ticket "DEMO" with a feature source stored under configured "paths.features" directory "tests/behaviors"
      When I run "codify DEMO"
      Then the output contains the scenario stubs from that feature source

    @bdd-lane-collision-detection-and-paths.TB2.AC1
    Scenario: Lint-gherkin lints configured and default directories together
      Given a project with a lint-clean feature file in "features"
      And a feature file with a lint violation under configured "paths.features" directory "tests/behaviors"
      When I run "lint-gherkin"
      Then the violation in "tests/behaviors" is reported

    @bdd-lane-collision-detection-and-paths.TB2.AC3
    Scenario: An unparseable config file falls back to default discovery
      Given a project with an unparseable ".safeword/config.json"
      And a feature file in the default "features" directory
      When I run "lint-gherkin"
      Then the default-directory feature file is linted
      And the command does not crash

  Rule: The scaffolded runner honors configured paths

    @bdd-lane-collision-detection-and-paths.TB2.AC2
    Scenario: A real cucumber-js run executes features from configured directories
      Given a scaffolded project with "paths.features" set to "tests/behaviors" and "paths.steps" set to "tests/steps"
      And a passing scenario with matching steps under those directories
      When I run the scaffolded cucumber lane
      Then the scenario under "tests/behaviors" is executed and passes

    @bdd-lane-collision-detection-and-paths.TB2.AC3
    Scenario: The runner behaves exactly as today when no config file exists
      Given a scaffolded project with no ".safeword/config.json"
      And a passing scenario with matching steps in the default lane directories
      When I run the scaffolded cucumber lane
      Then the default-lane scenario is executed and passes

  Rule: Check advisories name misalignment without editing anything

    @bdd-lane-collision-detection-and-paths.TB3.AC1
    Scenario: Check warns when a harness is detected and paths are unset
      Given a project with a host cucumber harness and no "paths.features" configured
      When I run "check"
      Then the output warns that a cucumber harness was detected
      And the warning shows the "paths.features" and "paths.steps" config lines to add

    @bdd-lane-collision-detection-and-paths.TB3.AC1
    Scenario: Check stays silent when safeword's own lane is the only harness
      Given a project where safeword setup previously scaffolded the starter lane
      And no host cucumber harness exists
      When I run "check"
      Then no cucumber-harness advisory is reported

    @bdd-lane-collision-detection-and-paths.TB3.AC2
    Scenario: Check enumerates a leftover duplicate scaffold without touching it
      Given a project with a host cucumber harness and safeword's starter lane both present
      When I run "check"
      Then the output lists the starter lane files, the cucumber dependencies, and the "test:bdd" script as leftovers
      And every listed file still exists with unchanged content after the run
