Feature: Route ready PRs with a safe advisory review

  Every ready pull request receives one exact-head, technology-neutral advisory
  review whose ordinary conversation receipt cannot execute code, approve, or
  affect merge eligibility.

  @safe-advisory-core.TBU1.R1 @surface.safeword-cli @surface.github-pull-request-conversation
  Rule: safe-advisory-core.TBU1.R1 — Every eligible head receives exactly one automatic review

    Scenario: A ready revision is reviewed once at its exact head
      Given a pull request is ready and its required prerequisites have settled successfully
      And its current head is revision A
      When Safeword completes the advisory review
      Then the reviewed revision is A
      And the review attempt count for revision A is one
      And exactly one current receipt exists for revision A

    @rejection
    Scenario: A draft revision creates no receipt
      Given a pull request is still a draft
      When Safeword evaluates review eligibility
      Then no `looks ready` or `needs a human` route is published
      And the workflow run summary reports `not ready (draft)`
      And no receipt is created or updated
      And no prerequisite sampling or model review runs

    @rejection
    Scenario: A pending prerequisite publishes a visible non-run receipt
      Given a pull request is waiting for a required prerequisite
      When Safeword evaluates review eligibility
      Then no `looks ready` or `needs a human` route is published
      And the current receipt reports `prerequisites pending`
      And exactly one marker-owned receipt comment exists on the pull request
      And no model review runs after the pending prerequisite is observed

    Scenario: A scheduled sweep reviews a pending head after prerequisites settle
      Given revision A has a `prerequisites pending` marker-owned receipt
      And its configured prerequisites settle successfully after the event run exits
      When a later scheduled sweep evaluates revision A
      Then that sweep completes the advisory review for revision A
      And it updates the same marker-owned receipt with the current route

    @rejection
    Scenario: A prerequisite that never appears remains conservatively pending
      Given a configured required-check identity has remained absent since the current head became ready
      When a later scheduled sweep samples that exact head
      Then no advisory route or model review is produced
      And the current receipt still reports `prerequisites pending`
      And the sole receipt names the missing check identity
      And it tells the builder to verify the check or `prReview.requiredChecks` configuration
      And exactly one marker-owned receipt comment exists on the pull request

    @rejection
    Scenario: A failed prerequisite publishes a terminal non-run receipt
      Given a pull request has a failing required prerequisite
      When Safeword evaluates review eligibility
      Then no `looks ready` or `needs a human` route is published
      And the current receipt reports `prerequisites failed`
      And exactly one marker-owned receipt comment exists on the pull request
      And no model review runs after the failed prerequisite is observed

    @rejection
    Scenario: Missing prerequisite configuration gives one concrete next action
      Given a ready pull request has no `prReview.requiredChecks` configuration
      When Safeword evaluates review eligibility
      Then no `looks ready` or `needs a human` route is published
      And the current receipt reports `prerequisites unconfigured`
      And it tells the builder to set `prReview.requiredChecks` explicitly
      And exactly one marker-owned receipt comment exists on the pull request
      And no prerequisite sampling or model review runs

    Scenario: An explicit empty prerequisite list proceeds immediately
      Given a ready pull request explicitly configures no required prerequisites
      And it changes clean reviewable text at `src/reviewed.ts`
      And its current head is revision A
      When the same triggered run evaluates eligibility and performs the advisory review
      Then the same triggered run completes the advisory review for revision A
      And it publishes the current receipt for revision A
      And the published state is complete
      And the route is `looks ready`

    @rejection
    Scenario: A repeated trigger cannot produce another review attempt
      Given revision A is already completely reviewed
      When another eligible trigger arrives for revision A
      Then no second review attempt runs
      And the workflow run summary records the trigger as `suppressed`
      And revision A's review attempt count remains one
      And its marker-owned receipt remains byte-for-byte unchanged

    @rejection
    Scenario Outline: An ineligible scheduled candidate invalidates its existing receipt
      Given scheduled discovery selected a pull request that becomes <state> before its worker starts
      And a marker-owned receipt already exists
      When the worker revalidates the pull request
      Then no prerequisite sampling or model review runs
      And an existing marker-owned receipt is rewritten as <receipt-state> with no advisory route

      Examples:
        | state | receipt-state |
        | draft | `not ready (draft)` |
        | closed | `not ready (closed)` |
        | merged | `not ready (merged)` |

    @rejection
    Scenario Outline: An ineligible scheduled candidate creates no receipt when none exists
      Given scheduled discovery selected a pull request that becomes <state> before its worker starts
      And no marker-owned receipt exists
      When the worker revalidates the pull request
      Then no prerequisite sampling or model review runs
      And no receipt is created
      And the workflow run summary records <receipt-state>

      Examples:
        | state | receipt-state |
        | draft | `not ready (draft)` |
        | closed | `not ready (closed)` |
        | merged | `not ready (merged)` |

  @safe-advisory-core.TBU1.R2 @surface.safeword-cli @surface.github-pull-request-conversation
  Rule: safe-advisory-core.TBU1.R2 — Every changed text artifact receives the same technology-neutral integrity floor

    Scenario Outline: Changed text is visibly covered without a technology-specific gate
      Given a ready pull request changes <artifact> at <path>
      When Safeword completes the advisory review
      Then the current receipt marks <path> as integrity-reviewed
      And the coverage entry records no technology-specific skip or gate

      Examples:
        | artifact | path |
        | recognized source code | `src/auth.ts` |
        | an unfamiliar behavior-affecting file | `policies/access.flux` |

    @rejection
    Scenario: A non-text artifact is visibly excluded instead of falsely covered
      Given a ready pull request changes binary artifact `assets/logo.png`
      When Safeword completes the advisory review
      Then the current receipt marks `assets/logo.png` as skipped because it is non-text
      And it does not mark `assets/logo.png` as integrity-reviewed

    Scenario: A skipped binary does not poison an otherwise complete clean review
      Given a ready pull request changes clean text at `src/auth.ts` and binary `assets/logo.png`
      When Safeword completes the advisory review
      Then `src/auth.ts` is marked integrity-reviewed
      And `assets/logo.png` is marked skipped as non-text without becoming an unknown
      And the complete current route is `looks ready`

    @rejection
    Scenario: A binary-only change set cannot look complete or ready
      Given a ready pull request changes only binary `assets/logo.png`
      When Safeword completes the advisory review
      Then the receipt reports zero reviewable text artifacts
      And `assets/logo.png` is marked skipped as non-text without becoming an unknown
      And the published state is `incomplete`
      And the route is `needs a human`

    @rejection
    Scenario: An empty change set cannot look complete or ready
      Given a ready pull request has no changed artifacts
      When Safeword assembles the bounded integrity evidence
      Then the receipt reports zero reviewable text artifacts
      And the receipt reports no coverage or missing-evidence entries
      And the published state is `incomplete`
      And the route is `needs a human`

    @rejection
    Scenario: Evidence over budget cannot look complete or ready
      Given a ready pull request's readable changed text exceeds `maxTotalBytes`
      When Safeword assembles the bounded integrity evidence
      Then the receipt reports one or more changed text artifacts as missing required evidence
      And the published state is `incomplete`
      And the route is `needs a human`

    Scenario: Evidence exactly at the total-byte budget remains reviewable
      Given a ready pull request's readable changed text totals exactly `maxTotalBytes`
      When Safeword assembles the bounded integrity evidence
      Then every changed text artifact is marked integrity-reviewed
      And none is reported missing because of the total-byte budget

    @rejection
    Scenario: A consequential unfamiliar-artifact finding routes to a human
      Given an unfamiliar artifact reached the integrity reviewer
      And the reviewer returned a consequential access-control finding
      When Safeword derives the route
      Then the route is `needs a human`
      And the receipt associates the finding with that artifact

    @evaluation @live @live-model @live-evidence
    Scenario: The unfamiliar Flux policy regression routes to a human
      Given a ready pull request changes an unfamiliar `.flux` policy from `allow admin` to `allow *`
      When the configured reviewer performs the technology-neutral integrity review
      Then the route is `needs a human`
      And the receipt includes an access-control finding for the `.flux` artifact

  @safe-advisory-core.TBU1.R3 @surface.safeword-cli @surface.github-pull-request-conversation
  Rule: safe-advisory-core.TBU1.R3 — Only a complete clean current review may report looks ready

    Scenario Outline: Evidence state conservatively determines the advisory route
      Given the current review is <evidence-state>
      When Safeword derives the advisory route
      Then the published state is <published-state>
      And the route is <route>

      Examples:
        | evidence-state | published-state | route |
        | complete with no consequential finding or unresolved unknown | complete | `looks ready` |
        | complete with only a non-consequential finding | complete | `looks ready` |
        | complete with a consequential finding | complete | `needs a human` |
        | complete with an unresolved unknown | complete | `needs a human` |
        | zero reviewable text artifacts | incomplete | `needs a human` |
        | missing required evidence | incomplete | `needs a human` |
        | interrupted by a reviewer or tool error | failed | `needs a human` |
        | completed for a head that is no longer current | stale | `needs a human` |

    @rejection
    Scenario Outline: Competing run conditions use conservative state precedence
      Given a review has <lower-condition>
      And <higher-condition> also occurs
      When Safeword derives the advisory route
      Then the published state is <published-state>
      And the route is `needs a human`

      Examples:
        | lower-condition | higher-condition | published-state |
        | a complete consequential finding | the reviewed head is no longer current | stale |
        | a complete non-consequential finding | the reviewed head is no longer current | stale |
        | an unresolved unknown | the reviewed head is no longer current | stale |
        | a reviewer or tool error | the reviewed head is no longer current | stale |
        | missing required evidence | the reviewed head is no longer current | stale |
        | missing required evidence | a reviewer or tool error | failed |
        | a complete consequential finding | a reviewer or tool error | failed |
        | a complete non-consequential finding | a reviewer or tool error | failed |
        | an unresolved unknown | a reviewer or tool error | failed |
        | a complete non-consequential finding | required evidence is missing | incomplete |
        | a complete consequential finding | required evidence is missing | incomplete |
        | an unresolved unknown | required evidence is missing | incomplete |

    @rejection
    Scenario: Stale wins when incomplete and failed conditions overlap
      Given a review has missing required evidence
      And a reviewer or tool error also occurs
      And the reviewed head is no longer current also occurs
      When Safeword derives the advisory route
      Then the published state is stale
      And the route is `needs a human`

  @safe-advisory-core.TBU1.R4 @surface.safeword-cli @surface.github-pull-request-conversation
  Rule: safe-advisory-core.TBU1.R4 — Every new head invalidates the old conclusion and requires a fresh review

    @rejection
    Scenario: Converting a reviewed pull request to draft removes its advisory route
      Given a pull request has a `looks ready` marker-owned receipt for revision A
      When the pull request is converted to draft
      Then the same marker-owned comment reports `not ready (draft)` with no advisory route
      And no prerequisite sampling or model review runs

    @rejection
    Scenario Outline: A new head cannot inherit an earlier conclusion
      Given revision A has a current receipt
      And <timing> revision B becomes the pull request head
      When Safeword handles the change
      Then review publication emits only the fresh route for revision B because invalidation owns revision A's stale state
      And revision B requires a full fresh review before a current route is published

      Examples:
        | timing |
        | before a new review begins |
        | while revision A is being reviewed |

    @rejection
    Scenario: A new head updates the sole receipt instead of adding comment noise
      Given a pull request has one marker-owned receipt for revision A
      And revision B becomes the pull request head
      When Safeword completes the advisory review for revision B
      Then the same marker-owned comment is updated for revision B
      And exactly one marker-owned receipt comment exists on the pull request

    @rejection
    Scenario: Publication reconciles duplicate marker-owned receipts
      Given a prior race left three bot-authored marker-owned receipt comments
      When Safeword publishes the current result
      Then it updates the oldest marker-owned comment as the canonical receipt
      And it deletes every other bot-authored marker-owned receipt
      And exactly one marker-owned receipt comment exists on the pull request

    @rejection
    Scenario Outline: Receipt reconciliation preserves comments Safeword does not own
      Given a canonical bot-authored marker-owned receipt exists
      And a <protected-comment> also exists
      When Safeword publishes the current result
      Then the canonical marker-owned receipt is updated
      And the protected comment is neither updated nor deleted

      Examples:
        | protected-comment |
        | user-authored comment containing the exact marker |
        | bot-authored comment containing a malformed marker |

  @safe-advisory-core.NTB1.R1 @surface.safeword-cli @surface.github-pull-request-conversation
  Rule: safe-advisory-core.NTB1.R1 — The current receipt exposes what the review did and did not establish

    Scenario: Available evidence is reported with its actual values
      Given a terminal review attempt used 123 input tokens and 45 output tokens
      And required check `build` completed successfully
      When Safeword publishes the current receipt
      Then the receipt names the reviewed revision and run state
      And it lists reviewers, checks, skipped checks, remaining unknowns, available token use, and finding counts
      And it reports 123 input tokens, 45 output tokens, and `build: success`

    @rejection
    Scenario: Unavailable evidence remains unknown instead of looking successful
      Given a failed terminal review has unavailable token usage and one unresolved check
      When Safeword publishes the current receipt
      Then token usage is reported as unknown rather than zero
      And the unresolved check is reported as unknown rather than successful

  @safe-advisory-core.NTB1.R2 @surface.safeword-cli @surface.github-pull-request-conversation
  Rule: safe-advisory-core.NTB1.R2 — Receipt findings are actionable without claiming approval or tested remedies

    Scenario: A consequential finding gives one evidence-bounded next action
      Given a current review has a consequential finding
      When Safeword renders the ordinary-comment receipt
      Then the finding names its path and location, evidence, consequence, and one next action
      And any model-proposed remedy is labeled unverified

    @rejection
    Scenario: A clean current review creates no reassuring comment noise
      Given a complete current review has no consequential finding or unresolved unknown
      When Safeword publishes the result
      Then exactly one current receipt reports `looks ready`
      And no other comment claims the pull request is safe to merge

    Scenario: A non-consequential finding remains visible on a looks-ready receipt
      Given a complete current review has one non-consequential finding at `src/auth.ts:12`
      When Safeword publishes the result
      Then the current receipt reports `looks ready`
      And it lists the finding as non-consequential at `src/auth.ts:12`

  @safe-advisory-core.SWM1.R1 @surface.safeword-cli @surface.github-pull-request-conversation
  Rule: safe-advisory-core.SWM1.R1 — Inspection and publication remain split across least-privilege boundaries

    @rejection
    Scenario: An untrusted fork is reviewed as data without execution
      Given a ready pull request comes from an untrusted fork
      And model inspection has no GitHub write credential
      And publication has only serialized advisory evidence
      When Safeword reviews and publishes the result
      Then the receipt lists the reviewed fork artifacts
      And the inspection audit records read-only GitHub permissions with no checkout or execution step
      And the publication audit records serialized advisory evidence as the write-capable job's sole input
      And it records no fork code or executable artifact entering that job

    @rejection
    Scenario Outline: Missing audit evidence blocks publication
      Given the <audit-record> is <availability>
      When Safeword validates the split-privilege contract
      Then publication is blocked
      And no GitHub write call is made

      Examples:
        | audit-record | availability |
        | inspection audit | missing |
        | inspection audit | empty |
        | publication audit | missing |
        | publication audit | empty |

    @rejection
    Scenario: Adversarial pull-request text cannot expand authority or suppress human routing
      Given untrusted pull-request text requests approval, merge, modification, or suppression of a known concern
      And deterministic evidence requires human judgment
      When Safeword derives and publishes the result
      Then the route remains `needs a human`
      And Safeword neither approves, merges, modifies code, nor executes customer code
      And the publication audit contains an issue-comment call but no review, merge, status, check, or content-write call

  @safe-advisory-core.SWM1.R2 @surface.safeword-cli @surface.github-pull-request-conversation
  Rule: safe-advisory-core.SWM1.R2 — The receipt cannot approve a PR or satisfy a required check

    @rejection
    Scenario: Publishing the receipt leaves GitHub merge eligibility unchanged
      Given a pull request is subject to approval and required-check rules
      When Safeword publishes its current receipt
      Then the receipt is an ordinary non-review conversation comment
      And it creates neither an approval nor a status or check conclusion
      And the publication audit contains an issue-comment call but no review, merge, status, check, or content-write call
      And merge eligibility is unchanged
