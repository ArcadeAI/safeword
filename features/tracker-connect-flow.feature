# Acceptance is proven by the vitest lanes, not cucumber step definitions: the
# connect orchestration is driven through real config-writing / sidecar-seeding /
# opt-in-file logic with only the boundary (keychain, the provider auth/verify
# client, the interactive prompt) mocked — including a command-level wiring test
# per the testing lesson in #363. Tagged @wip to exclude from the cucumber
# acceptance lane (proof lives in vitest) while staying discoverable for
# `safeword check` AC-coverage.
@tracker-connect-flow.TB1 @wip
Feature: Tracker connect/onboarding flow — interactive wiring
  The agent prepares non-secret config and orchestrates; the human does the auth
  steps only they can; the agent verifies before any sync and seeds the sidecar so
  the first projection succeeds. Opt-in, never forced.

  Rule: setup offers connect, opt-in and default no

    @tracker-connect-flow.TB1.AC1
    Scenario: Declining the setup offer leaves the project inert
      Given a project with no tracker configured
      When setup runs and the connect offer is declined
      Then the provider stays none
      And no credential is stored
      And no tracker-map sidecar is created

    @tracker-connect-flow.TB1.AC8
    Scenario: Accepting the setup offer runs the same connect flow
      Given a project with no tracker configured
      When setup runs and the connect offer is accepted for github with target repo acme/demo
      Then config records provider github and the target repo
      And the printed steps name the safeword App install or a PAT

  Rule: connect writes non-secret config and prints the per-provider handoff

    @tracker-connect-flow.TB1.AC2
    Scenario: Connecting github writes config and prints the App/PAT handoff
      Given a project with no tracker configured
      When connect runs for github with target repo acme/demo
      Then config records provider github and the target repo
      And the printed steps name the safeword App install or a PAT

    @tracker-connect-flow.TB1.AC2
    Scenario: Connecting linear writes config and prints the Arcade OAuth handoff
      Given a project with no tracker configured
      When connect runs for linear with target team ENG
      Then config records provider linear and the target team
      And the printed steps name the Arcade authorize step

    @tracker-connect-flow.TB1.AC2
    Scenario: Re-connecting a different provider leaves no stale provider
      Given a project already connected to github
      When connect runs for linear
      Then config records provider linear and not github

  Rule: secrets live outside the repo

    @tracker-connect-flow.TB1.AC3
    Scenario: The credential is stored in the keychain, never in config
      Given connect runs for github and the token SENTINEL-SECRET-d34db33f is provided
      When the credential is stored
      Then it is written to the keychain
      And the string SENTINEL-SECRET-d34db33f does not appear in the config file
      And the string SENTINEL-SECRET-d34db33f does not appear in any printed output

  Rule: verify before declaring the connection live

    @tracker-connect-flow.TB1.AC4
    Scenario: Verification passes and the connection is reported live
      Given connect runs for github and the auth check succeeds
      When verification runs
      Then it reports the connection is live

    @tracker-connect-flow.TB1.AC4
    Scenario Outline: Verification fails and names the missing piece
      Given connect runs for github and the auth check fails for <reason>
      When verification runs
      Then it reports not connected
      And it names <missing_piece>

      Examples:
        | reason                | missing_piece          |
        | a missing credential  | the missing credential |
        | an insufficient scope | the insufficient scope |
        | an uninstalled app    | the uninstalled app    |

  Rule: a successful connect seeds the empty sidecar

    @tracker-connect-flow.TB1.AC5
    Scenario: A verified connect seeds an empty tracker-map sidecar
      Given connect runs for github and verification succeeds
      When connect completes
      Then an empty tracker-map sidecar exists

    @tracker-connect-flow.TB1.AC5
    Scenario: A failed verification does not seed the sidecar
      Given connect runs for github and verification fails
      When connect completes
      Then no tracker-map sidecar exists

  Rule: connect offers the pollution opt-ins

    @tracker-connect-flow.TB1.AC6
    Scenario: Accepting the pollution opt-ins writes both files
      Given connect runs for github and verification succeeds
      When the pollution opt-ins are accepted
      Then a cursor indexing-ignore entry is written
      And a gitattributes generated-marker for the index files is written

    @tracker-connect-flow.TB1.AC6
    Scenario: Declining the pollution opt-ins writes neither file
      Given connect runs for github and verification succeeds
      When the pollution opt-ins are declined
      Then no cursor indexing-ignore entry is written
      And no gitattributes generated-marker is written

  Rule: an unsupported provider is rejected cleanly

    @tracker-connect-flow.TB1.AC7
    Scenario: Connecting an unsupported provider performs no partial wiring
      Given a project with no tracker configured
      When connect runs for an unsupported provider
      Then it is rejected with a clear message
      And the provider stays none
      And no credential is stored
      And no tracker-map sidecar is created
