@wip
Feature: Preserve authoritative remote conclusions

  @offload-tests.TBU1.R6
  @public-cli @surface.safeword-cli
  Rule: offload-tests.TBU1.R6 — Every accepted remote conclusion remains authoritative and never triggers a result-masking local rerun

    @public-cli @surface.safeword-cli
    Scenario Outline: Every terminal remote conclusion is reported from the accepted run
      Given an authenticated run response has `status: completed` and GitHub conclusion <github-conclusion>
      When the public Safeword CLI records its terminal result
      Then it persists and plainly reports <classification>, exits <exit>, and invokes no local plan
      Examples:
        | github-conclusion | classification | exit |
        | success | passed | 0 |
        | failure | failed | 1 |
        | cancelled | cancelled | 130 |
        | action_required | action required | 2 |
        | neutral | neutral non-pass | 3 |
        | skipped | skipped non-pass | 4 |
        | stale | stale non-pass | 5 |
        | timed_out | infrastructure failure | 124 |
        | startup_failure | infrastructure failure | 125 |
        | an unknown non-null terminal value | indeterminate unsupported conclusion | 70 |

    @rejection @public-cli @surface.safeword-cli
    Scenario Outline: Status and conclusion must form one valid terminal pair
      Given an authenticated run response has <status-conclusion>
      When the public CLI classifies run lifecycle
      Then <lifecycle-outcome>
      Examples:
        | status-conclusion | lifecycle-outcome |
        | `status: queued` and `conclusion: null` | observation continues as queued without terminal persistence |
        | `status: requested` and `conclusion: null` | observation continues as requested without terminal persistence |
        | `status: waiting` and `conclusion: null` | observation continues as waiting without terminal persistence |
        | `status: pending` and `conclusion: null` | observation continues as pending without terminal persistence |
        | `status: in_progress` and `conclusion: null` | observation continues as running without terminal persistence |
        | queued with a non-null conclusion | evidence is indeterminate and no local fallback starts |
        | in_progress with a non-null conclusion | evidence is indeterminate and no local fallback starts |
        | `status: completed` and `conclusion: null` | evidence is indeterminate and no local fallback starts |
        | omitted status key | evidence is indeterminate and no local fallback starts |
        | equal or unequal duplicate raw status keys | evidence is indeterminate and no local fallback starts |
        | non-string, noncanonically encoded or any future unknown status | evidence is indeterminate, pending recovery stays open, and no local fallback starts |
        | omitted conclusion key | evidence is indeterminate and no local fallback starts |
        | equal or unequal duplicate raw conclusion keys | evidence is indeterminate and no local fallback starts |
        | non-string or noncanonically encoded conclusion | evidence is indeterminate and no local fallback starts |

    @rejection
    Scenario: A remote failure cannot be replaced by a later automatic local pass
      Given an accepted remote run failed
      When the user later runs `safeword project test --lane full --execution local`
      Then Safeword retains and reports the authoritative remote failure, starts one separately identified local run, and records its result as new local evidence rather than replacing or reclassifying the remote result
