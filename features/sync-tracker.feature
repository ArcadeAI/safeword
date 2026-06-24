# Acceptance is proven by the vitest lanes, not cucumber step definitions: the
# payload builder, the single call site, the two mocked writers, the sidecar
# idempotency/resume, field ownership, egress, and secret resolution are all
# driven through injected fake clients in packages/cli/tests (done-when: "no live
# tracker in tests"). Tagged @wip to exclude this feature from the cucumber
# acceptance lane (proof lives in vitest) while staying discoverable for
# `safeword check` AC-coverage.
@sync-tracker.TB1 @wip
Feature: safeword sync-tracker — one-way projection to Linear + GitHub Issues
  Project the local ticket corpus one-way (file → tracker) into Linear or GitHub
  Issues as flat, label-grouped issues, while the local files stay canonical. One
  call site, a shared IssuePayload, two mocked writers, an idempotent sidecar.

  Rule: With no tracker configured, sync is a friendly no-op

    @sync-tracker.TB1.AC1
    Scenario: provider none prints guidance and exits zero
      Given a project whose ticketBridge provider is none
      When sync-tracker runs
      Then it prints guidance to run safeword setup
      And it exits 0

    @sync-tracker.TB1.AC1
    Scenario: an unsupported tracker is treated as none
      Given a project whose ticketBridge provider is an unsupported value
      When sync-tracker runs
      Then it prints guidance to run safeword setup
      And it exits 0

  Rule: A configured provider without a credential fails loudly

    @sync-tracker.TB1.AC2
    Scenario Outline: provider set but no credential resolves
      Given a configured <provider> project with a call-recording <provider> client
      And no credential resolves for <provider>
      When sync-tracker runs
      Then it emits a loud warning naming the missing credential
      And the recording client received no calls
      And it exits non-zero

      Examples:
        | provider |
        | linear   |
        | github   |

  Rule: Each ticket maps to a flat IssuePayload

    @sync-tracker.TB1.AC3
    Scenario: an active ticket maps to an open payload with epic and type labels
      Given an active ticket with an epic and a type
      When the payload builder maps it
      Then the payload state is open
      And the payload title carries no safeword id prefix
      And the payload labels include the epic and type labels
      And the payload body contains the mirror banner text
      And the payload body contains a back-link whose URL resolves to this ticket's canonical path

    @sync-tracker.TB1.AC3
    Scenario: a terminal ticket maps to a closed payload
      Given a ticket whose status is terminal
      When the payload builder maps it
      Then the payload state is closed

    @sync-tracker.TB1.AC3
    Scenario: a ticket with no epic yields only the type label
      Given an active ticket that has a type but no epic
      When the payload builder maps it
      Then the payload labels include the type label
      And the payload labels include no epic label

  Rule: One call site routes to the provider's writer

    @sync-tracker.TB1.AC4
    Scenario: the linear provider routes to the Linear writer
      Given a configured linear provider with a stub Linear client
      When projectTicket runs for a ticket
      Then the Linear writer receives the create call
      And the GitHub writer receives no call

    @sync-tracker.TB1.AC4
    Scenario: the github provider routes to the GitHub writer
      Given a configured github provider with a stub GitHub client
      When projectTicket runs for a ticket
      Then the GitHub writer receives the create call
      And the Linear writer receives no call

  Rule: First sync creates issues and records refs

    @sync-tracker.TB1.AC5
    Scenario: a ticket absent from a present sidecar is created and recorded
      Given a present, parseable tracker-map sidecar with no entry for this ticket
      When sync-tracker runs
      Then the writer create is called for that ticket
      And the returned tracker ref is recorded in the sidecar

  Rule: Re-run is idempotent — update, never duplicate

    @sync-tracker.TB1.AC6
    Scenario: a ticket already in the sidecar is updated, not recreated
      Given a ticket with a recorded ref in the tracker-map sidecar
      When sync-tracker runs
      Then the writer update is called with the existing ref
      And the writer create is not called

  Rule: safeword writes only the fields it owns

    @sync-tracker.TB1.AC7
    Scenario: re-sync of an active ticket touches title and labels only
      Given an active ticket already projected to an issue
      When sync-tracker re-runs
      Then the update writes title and labels
      And the update payload contains no status, assignee, or priority field

    @sync-tracker.TB1.AC7
    Scenario: a newly-terminal ticket closes its issue
      Given a previously-active ticket whose status is now terminal
      When sync-tracker re-runs
      Then the issue is closed
      And the update writes no assignee or priority

  Rule: A crashed mid-corpus run resumes without double-creating

    @sync-tracker.TB1.AC8
    Scenario: a ticket created with a pending ref is reconciled, not recreated
      Given a ticket whose sidecar entry is pending from a crashed prior run
      When sync-tracker re-runs
      Then it reconciles to the existing issue
      And the writer create is not called again

  Rule: A missing or corrupt sidecar never blind-recreates

    @sync-tracker.TB1.AC9
    Scenario: a corrupt sidecar stops the run pending an explicit reset
      Given a configured project whose tracker-map sidecar exists but cannot be parsed
      When sync-tracker runs without --reset-tracker-map
      Then it stops with guidance to pass --reset-tracker-map
      And it makes no writer calls

    @sync-tracker.TB1.AC9
    Scenario: a missing sidecar on a configured project stops pending an explicit reset
      Given a configured project whose seeded tracker-map sidecar is now absent
      When sync-tracker runs without --reset-tracker-map
      Then it stops with guidance to pass --reset-tracker-map
      And it makes no writer calls

  Rule: Body egress defaults to minimal

    @sync-tracker.TB1.AC10
    Scenario: the default body omits the spec and work log
      Given a project with no body setting configured
      When the payload builder maps a ticket
      Then the payload body excludes the spec and work-log content

    @sync-tracker.TB1.AC10
    Scenario: body full to a public github repo emits an egress warning
      Given a github project configured with body full and a public repo
      When sync-tracker runs
      Then it emits a loud egress warning
      And the warning is emitted before any writer create call

  Rule: Secrets stay out of the repo and the logs

    @sync-tracker.TB1.AC11
    Scenario: a token is read from the environment, never from committed config
      Given a credential present in the environment and absent from config
      When sync-tracker resolves the credential
      Then it uses the environment credential
      And it never reads a token from .safeword/config.json

    @sync-tracker.TB1.AC11
    Scenario: the resolved token never appears in output or logs
      Given a credential whose value is the sentinel SENTINEL-TOKEN-abc123
      When sync-tracker runs and prints its summary
      Then the sentinel value appears in neither the command output nor the logs

  Rule: Non-interactive Arcade auth warns about silent failure

    @sync-tracker.TB1.AC12
    Scenario: a CI run on an Arcade user identity is warned
      Given a non-interactive run authenticated by an Arcade-User-ID
      When sync-tracker runs
      Then it warns that the user identity can fail silently on grant lapse

  Rule: Corpus writes are rate-limited with backoff

    @sync-tracker.TB1.AC13
    Scenario: a rate-limited write is retried with backoff and succeeds
      Given a writer that returns a rate-limit error once then succeeds
      And backoff delays are driven by an injected fake timer
      When sync-tracker projects a ticket
      Then the writer create is called twice
      And the ticket is ultimately projected
