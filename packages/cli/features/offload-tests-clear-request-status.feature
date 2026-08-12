Feature: Report remote verification status clearly

  @wip @offload-tests.NTB1.R2
  @public-cli @surface.safeword-cli
  Rule: offload-tests.NTB1.R2 — Every request plainly identifies local fallback, remote queueing, running, passing, failure, cancellation, or indeterminate dispatch

    Scenario Outline: Each execution state has a plain-language status and next action
      Given a verification request is in <state>
      When Safeword reports progress or completion
      Then it reports <classification>, includes <required-context>, exits <exit-behavior>, and never claims <forbidden-claim>
      Examples:
        | state | classification | required-context | exit-behavior | forbidden-claim |
        | local fallback | local fallback | HEAD, dirty state and evidence limits | with the evidence-qualified local result | remote equivalence |
        | remotely queued | remotely queued | canonical run link | only after terminal observation or interruption | completion |
        | remotely running | remotely running | canonical run link | only after terminal observation or interruption | completion |
        | passed | passed | canonical run link and source SHA | zero | local execution |
        | failed | failed | canonical run link and GitHub conclusion | nonzero | a masking local pass |
        | cancelled | cancelled | canonical run link and GitHub conclusion | nonzero | pass or failure |
        | dispatch indeterminate | dispatch indeterminate | resume command and pending-record identity | nonzero | pass, failure or safe fallback |

    @rejection
    Scenario: An indeterminate result is never described as pass or failure
      Given dispatch or local fingerprint evidence is indeterminate
      When Safeword reports the outcome
      Then it does not claim that verification passed or failed for the identified revision
