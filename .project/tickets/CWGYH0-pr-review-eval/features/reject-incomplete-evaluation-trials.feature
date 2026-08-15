Feature: Keep failed reviews out of benchmark scores

  @pr-review-eval.SWM1.R1
  Rule: pr-review-eval.SWM1.R1 — Only positively complete trials are scoreable

    Scenario: A completed reviewer finding is usable
      Given the raw provider response is non-empty and has the exact expected terminal finish
      And its schema-valid report names the expected reviewer and frozen provenance
      And the report explicitly contains one finding with complete trace and usage
      When the evaluation harness classifies the trial
      Then the trial is admitted as usable

    Scenario: A completed reviewer may return multiple findings
      Given the raw provider response is non-empty and has the exact expected terminal finish
      And its schema-valid report names the expected reviewer and frozen provenance
      And the report explicitly contains multiple findings with complete trace and usage
      When the evaluation harness classifies the trial
      Then the trial is admitted as usable

    Scenario: A completed reviewer may explicitly find nothing
      Given the raw provider response is non-empty and has the exact expected terminal finish
      And its schema-valid report names the expected reviewer and frozen provenance
      And the report explicitly contains an empty findings collection with complete trace and usage
      When the evaluation harness classifies the trial
      Then the trial is admitted as usable

    @rejection
    Scenario Outline: Hidden completion failures are unusable
      Given a recorded trial has <failure>
      When the evaluation harness classifies the trial
      Then the trial is rejected with reason <reason>

      Examples:
        | failure                              | reason                    |
        | a provider connection failure        | provider-failure          |
        | an HTTP-200 provider error envelope  | provider-failure          |
        | an empty provider response           | incomplete-provider-output|
        | a truncated provider response        | incomplete-provider-output|
        | an unexpected terminal finish        | unexpected-finish         |
        | a schema-invalid report              | schema-invalid            |
        | no expected reviewer route           | routing-invalid           |
        | a reviewer error outcome             | reviewer-failed           |
        | an incomplete trace                  | provenance-incomplete     |
        | incomplete usage                     | provenance-incomplete     |
        | mismatched frozen provenance         | provenance-mismatch       |
        | an unrecognized completion state     | unknown-state             |

    @rejection
    Scenario Outline: Positive completion evidence cannot be inferred
      Given an otherwise completed trial has <defect>
      When the evaluation harness classifies the trial
      Then the trial is rejected with reason <reason>

      Examples:
        | defect                              | reason                |
        | missing review-valid evidence       | schema-invalid        |
        | non-boolean review-valid evidence   | schema-invalid        |
        | an empty execution trace            | provenance-incomplete |
        | no explicit terminal state          | unexpected-finish     |
        | a non-completed terminal state      | unexpected-finish     |

    @rejection
    Scenario Outline: Every scorer-consumed field is validated before admission
      Given a reviewer output has <malformed evidence>
      When the evaluation harness classifies the trial
      Then the trial is rejected as schema-invalid

      Examples:
        | malformed evidence                  |
        | a non-boolean named-failure          |
        | missing matching findings            |
        | missing consolidated findings        |
        | a malformed matching finding        |
        | a malformed consolidated finding    |

    @rejection
    Scenario Outline: Frozen reviewer routing cannot drift
      Given an otherwise complete output uses the wrong <routing field>
      When the evaluation harness classifies the trial
      Then the trial is rejected as routing-invalid

      Examples:
        | routing field |
        | provider      |
        | model         |

    @rejection
    Scenario Outline: Every emitted reviewer outcome must match the frozen route
      Given one expected reviewer outcome succeeds and another emitted outcome has <defect>
      When the evaluation harness classifies the trial
      Then the whole trial is rejected as routing-invalid

      Examples:
        | defect |
        | an extra failure outcome outside the frozen route |
        | a drifted route |

    @rejection
    Scenario Outline: Scored finding views agree with the routed reviewer output
      Given <view> disagrees with the otherwise matching routed reviewer evidence
      When the evaluation harness classifies the trial
      Then the whole trial is rejected as schema-invalid

      Examples:
        | view |
        | named-failure evidence |
        | matching-finding evidence |
        | consolidated-finding evidence |

    Scenario: Matching scored finding views are admitted
      Given named-failure, matching-finding, consolidated-finding, and routed-outcome evidence contain the same findings
      When the evaluation harness classifies the trial
      Then the trial is admitted as usable

  @pr-review-eval.SWM1.R2
  Rule: pr-review-eval.SWM1.R2 — Failure handling preserves paired experimental validity

    Scenario Outline: One retryable transport failure is retried once
      Given the first provider attempt fails with <failure>
      And the second attempt completes as a usable trial
      When the evaluation harness executes the work item
      Then it records exactly two provider attempts, makes no third call, and admits the second result

      Examples:
        | failure |
        | a connection failure |
        | HTTP 408 |
        | HTTP 429 |
        | HTTP 500 |
        | HTTP 502 |
        | HTTP 503 |
        | HTTP 504 |

    @rejection
    Scenario Outline: A second retryable transport failure excludes the paired case
      Given another member of the paired case already completed successfully
      And both permitted attempts for the current member fail with <failure>
      When the evaluation harness executes the work item
      Then it records exactly two provider attempts and makes no third call
      And it quarantines every record for that paired case while retaining all artifacts and attempt costs
      And it selects the next frozen reserve

      Examples:
        | failure |
        | connection failures |
        | HTTP 408 responses |
        | HTTP 429 responses |
        | HTTP 500 responses |

    @rejection
    Scenario Outline: A non-infrastructure failure gets no silent retry
      Given another member of the paired case already completed successfully
      And the first attempt returns <failure>
      When the evaluation harness executes the work item
      Then it records exactly one failed attempt and makes no second call
      And it quarantines every record for that paired case while retaining all artifacts and attempt costs
      And it allocates the next frozen reserve exactly once after quarantine is durable

      Examples:
        | failure                         |
        | a parsing failure               |
        | a content-policy failure        |
        | a schema-invalid report         |
        | an HTTP-200 provider error envelope|
        | an empty provider response      |
        | a truncated provider response   |
        | no expected reviewer route      |
        | a reviewer error outcome        |
        | an unexpected terminal finish   |
        | incomplete provenance           |
        | mismatched frozen provenance    |
        | an unknown completion state     |
        | HTTP 400                        |
        | HTTP 401                        |
        | HTTP 403                        |
        | HTTP 404                        |
        | HTTP 422                        |

    @rejection
    Scenario: Paired-case quarantine is atomic
      Given a paired case has multiple completed trial artifacts
      And one later trial makes the case unusable
      When the harness quarantines the paired case
      Then no member of that case remains admitted and every member is retained together in quarantine

    @rejection
    Scenario: A thrown semantic provider failure quarantines without retry
      Given the provider throws a schema or content failure before returning an output
      When the evaluation harness executes the work item
      Then it records one terminal invalid attempt and makes no second call
      And it durably retains the attempt artifacts and known or incomplete cost
      And it quarantines the paired case and allocates the next frozen reserve exactly once so restart cannot repeat the paid work

    @rejection
    Scenario: An early failure cancels pending paired work
      Given no sibling trial has completed for the paired case
      And the first trial makes the case unusable
      When the harness rejects the paired case
      Then it makes no provider calls for pending siblings and retains the failed attempt in quarantine
      And it allocates the next frozen reserve exactly once after quarantine is durable

    @rejection
    Scenario: A retryable failure followed by a semantic failure ends the pair
      Given the first attempt fails with a classified infrastructure error
      And the second attempt returns an HTTP-200 provider error envelope
      When the evaluation harness executes the work item
      Then it preserves exactly two attempts and makes no third call
      And it quarantines the whole paired case with all artifacts and costs
      And it allocates the next frozen reserve exactly once after quarantine is durable

    @rejection
    Scenario: Frozen reserves are selected deterministically
      Given the next two preregistered reserves are reserve A followed by reserve B
      And the original case and reserve A each become unusable
      When the harness replaces the unusable cases
      Then it quarantines each unusable case before selecting reserve A and then reserve B
      And each reserve is allocated once without skipping or reordering

    @rejection
    Scenario: A process crash does not strand the run lock
      Given the run lock names a process instance by PID, boot identity, process-start identity, and random ownership token
      And that exact process instance is no longer alive
      When the harness restarts against the same output directory
      Then it safely reclaims the stale lock and becomes the sole owner

    @rejection
    Scenario: Contending restarts cannot both reclaim one stale lock
      Given one stale run lock with an exact process-instance identity and two harness processes waiting to restart
      When both processes pass the stale-owner probe and contend at the atomic reclaim rename
      Then exactly one process becomes the sole owner
      And the other process stops without disturbing the new owner's lock

    @rejection
    Scenario Outline: Ambiguous lock ownership fails closed
      Given a run lock has <ownership defect>
      When another harness process tries to reclaim it
      Then reclamation is refused without disturbing the existing lock

      Examples:
        | ownership defect |
        | malformed owner metadata |
        | a reused PID with a different process-start identity |
        | a live PID whose optional ownership metadata differs |
        | an ownership probe that fails with a permission error |

    Scenario: A failed durable write does not poison the next write
      Given serializing a state update fails after its temporary file is created
      When the harness retries the same state target with valid data
      Then no stale temporary file blocks the durable write

    Scenario Outline: Injected crashes exercise the durable quarantine transaction
      Given a terminal case failure is durable
      And the production transaction throws <boundary>
      When the harness resumes from the durable artifacts it actually wrote
      Then it completes exactly one quarantine and reserve allocation

      Examples:
        | boundary                         |
        | after the exclusion marker write |
        | after the quarantine rename      |
        | after the run-state write        |

    Scenario: Recovery preserves failed-attempt evidence and cost
      Given a crash leaves two durable infrastructure attempts before quarantine
      When the live-run state is recovered
      Then the exclusion retains both attempts, its replacement, and their cost exactly once

    @rejection
    Scenario: Missing usage cannot bypass quarantine or authorize more spend
      Given a non-null invalid provider output has missing or malformed usage
      When the live runner handles the failed work item
      Then it quarantines the case without throwing from cost extraction
      And it records incomplete cost accounting and makes no later provider call

    @rejection
    Scenario: An unclassified thrown attempt is not assumed to be free
      Given a provider attempt ends without a returned output and is not an allowlisted retryable transport failure
      When the live runner accounts for the attempt
      Then it marks cost accounting incomplete and authorizes no later provider call

    @rejection
    Scenario Outline: Interrupted quarantine is never partially scoreable
      Given a failure is injected <boundary>
      When scoring reads cases before and after harness restart
      Then it observes zero score inputs from the completely provisional or completely quarantined case
      And it never observes a split or admitted member of that case

      Examples:
        | boundary                                       |
        | immediately before the case-directory rename  |
        | immediately after the case-directory rename   |

    @rejection
    Scenario: Reserve exhaustion stops the run
      Given every preregistered reserve has already become unusable
      When another case requires replacement
      Then the whole newly unusable case is durably quarantined with every attempt and cost retained
      And the run stops before further provider calls with reserve exhaustion identified

  @pr-review-eval.SWM1.R3
  Rule: pr-review-eval.SWM1.R3 — Scoring derives validity from admitted records

    Scenario: A complete run is scoreable
      Given a frozen matrix independently enumerates every expected case, system, variant, and trial before the run
      And the effective matrix replaces each quarantined primary with its deterministically allocated reserve
      And usable primaries and allocated replacements each have every required system and variant cell
      And quarantined primaries and unused reserves are outside the scoreable matrix
      And each cell contains exactly the three trial identities frozen in the run manifest as usable records for that case
      When the scorer evaluates the run
      Then the completeness gate is true
      And every estimate input is exactly one of the enumerated admitted records

    @rejection
    Scenario Outline: A structurally incomplete paired case is not scoreable
      Given the paired case has <defect>
      When the scorer evaluates the run
      Then scoring stops with the affected cell and structural defect identified

      Examples:
        | defect                                  |
        | one unusable reviewer trial             |
        | one missing trial                       |
        | one duplicate trial number              |
        | one unexpected extra trial              |
        | one empty system and variant cell       |
        | one frozen case missing entirely        |
        | one unexpected case                     |
        | one frozen system missing entirely      |
        | one unexpected system cell              |
        | one unexpected variant cell             |

    @rejection
    Scenario: Validity gates change when admitted evidence changes
      Given two runs have identical record-file counts and cell dimensions
      And one run has all usable trials while the other has one hidden reviewer failure
      When the scorer computes their validity gates
      Then the first run passes completeness and the second run fails completeness

    @rejection
    Scenario Outline: Invalid finding verification cannot change a score
      Given verification evidence has <defect>
      When the scorer evaluates the run
      Then scoring stops before any verification classification changes a result

      Examples:
        | defect |
        | malformed content |
        | a duplicated identity |
        | an unsupported classification |
        | no admitted finding identity |

    Scenario: Matching contamination evidence belongs to its frozen run
      Given contamination preflight evidence records its repository identity and unique run identity
      And the live run binds the SHA-256 digest of those exact preflight bytes
      When the scorer evaluates the run
      Then the contamination evidence is admitted for that frozen run only

    @rejection
    Scenario Outline: Mismatched contamination evidence stops scoring
      Given contamination preflight evidence has <binding defect>
      When the scorer evaluates the run
      Then scoring stops before the evidence can affect a result

      Examples:
        | binding defect |
        | missing preflight evidence |
        | no preflight digest bound by run state |
        | changed preflight bytes |
        | a stale run identity |
        | a different repository identity |
        | a digest that does not match the bound preflight bytes |

    Scenario: Finding verification belongs to one system trial
      Given the same finding identity appears across systems or repeated trials
      When verification evidence adjudicates one occurrence
      Then only the matching case, variant, system, and trial occurrence is classified

  @pr-review-eval.SWM1.R4
  Rule: pr-review-eval.SWM1.R4 — A paid canary gates larger spend

    Scenario: The no-cost fixture inventory is independently checkable
      Given the canonical R1 taxonomy is provider-failure, incomplete-provider-output, unexpected-finish, schema-invalid, routing-invalid, reviewer-failed, provenance-incomplete, provenance-mismatch, and unknown-state
      And a frozen input manifest enumerates one stable fixture identity and expected rejection reason for every R1 example row
      When the harness runs the no-cost preflight
      Then the recorded classes cover every canonical R1 class with none missing or extra
      And each enumerated R1 example has exactly one recorded outcome matching its expected rejection reason

    Scenario: Operational failure injection covers the R2 taxonomy
      Given the canonical R2 taxonomy covers retry, semantic-first failure, quarantine, reserve, lock, durable-write, incomplete-cost, and interrupted-visibility behaviors
      When the no-cost operational suite completes
      Then each canonical R2 class has exactly one passing failure-injection record with a stable scenario identity

    Scenario: The paid canary outcomes are independently checkable
      Given ten unique mechanical labels were retained in a separate immutable external anchor before any paid call
      And the labels cover both systems and both variants with at least one finding success and one genuine-empty success
      And all ten paid calls are usable with complete attempt costs and provenance
      When the maintainer reclassifies each retained raw provider response
      Then each frozen label has exactly one independently recorded matching outcome
      And every observed classification exactly matches its frozen expected label

    Scenario: A hidden provider failure is rejected through real wiring
      Given a provider HTTP-200 error envelope is injected only at the network boundary
      When the real runner, writer, and scorer process the response
      Then the raw injected response is preserved in one failed attempt classified as provider-failure
      And no scoreable record is produced

    Scenario: A successful reviewer matrix is scored through real wiring
      Given successful provider responses are injected only at the network boundary
      When the real runner and writer seal every frozen cell and the actual scorer runs
      Then the admitted-record count exactly equals the frozen matrix cardinality and is greater than zero
      And every expected frozen record is admitted exactly once and maps to its completed case result

    Scenario: The live entry point is exercised without provider spend
      Given a pinned no-cost adapter returns frozen successful and failing outputs
      When the actual live-run entry point starts and resumes a benchmark
      Then the retained run state records the frozen work order and exclusion
      And the emitted summary records the durable state and cost stop

    Scenario: The adapter checkout is explicit and commit-pinned
      Given the adapter root and source repository are supplied at runtime
      When the live entry point starts or resumes
      Then it verifies the frozen adapter commit before loading code
      And no machine-specific worktree path is embedded in the runner

    @rejection
    Scenario: Untracked adapter files invalidate the pinned collaborator
      Given the adapter checkout matches the frozen commit but contains an untracked file
      When the runner tries to load the adapter
      Then it rejects the checkout before importing executable code

    Scenario: Successful wiring advances durable run state
      Given successful provider responses are injected only at the network boundary
      When the production retry and admitted-work commit boundaries process every frozen cell
      Then each record is durable before its matching run-state advancement

    Scenario Outline: The aggregate cost stop is enforced at its exact boundary
      Given a completed attempt leaves aggregate cost <position> the stop
      When the runner considers the next work item
      Then the next provider call is <decision>
      And the completed attempt and its full observed cost remain retained

      Examples:
        | position | decision |
        | one price unit below | permitted |
        | exactly at | blocked |
        | above | blocked |

    Scenario: A clean canary authorizes the next checkpoint
      Given every frozen no-cost fixture outcome matches its expected rejection reason
      And every canonical R2 operational failure-injection record passes
      And ten unique paid-call labels covering both systems, both variants, finding success, and genuine-empty success come from the immutable pre-call external anchor
      And each of the ten retained raw responses is reclassified and matches its own anchored label
      And every attempt has complete valid cost data consistent with its recorded usage
      And the real-wiring hidden failure produced no scoreable record
      When the maintainer evaluates the canary gate
      Then the next paid checkpoint is authorized
      And a later provider call is permitted by the gate

    @rejection
    Scenario Outline: A canary prerequisite defect blocks more spend
      Given the canary evidence has <prerequisite defect>
      When the maintainer evaluates the canary gate
      Then further paid checkpoints remain blocked with the prerequisite defect identified
      And no provider call for a later checkpoint is made

      Examples:
        | prerequisite defect |
        | a missing R1 fixture record |
        | an extra R1 fixture record |
        | a failed R1 fixture record |
        | a missing R2 injection record |
        | a duplicate R2 injection record |
        | a failed R2 injection record |
        | an invalid pre-call external label anchor |
        | fewer than ten paid-call labels |
        | duplicate paid-call labels |
        | labels covering only one system |
        | labels covering only one variant |
        | labels with no genuine-empty success |
        | incomplete paid-call provenance |
        | one unusable paid canary call |
        | a hidden-failure wiring record that produced a scoreable result |

    @rejection
    Scenario: One canary label disagreement blocks more spend
      Given all ten paid canary calls are usable
      And one observed classification disagrees with its frozen expected label
      When the maintainer evaluates the canary gate
      Then further paid checkpoints remain blocked with the disagreement identified
      And no provider call for a later checkpoint is made

    Scenario: Total cost includes every attempt
      Given a run contains usable, retried, failed, quarantined, and excluded provider attempts
      When the maintainer reads the run cost report
      Then total cost equals all provider attempts and usable-call cost is reported separately

    @rejection
    Scenario Outline: Incomplete canary cost data blocks more spend
      Given all ten canary calls are usable and match their frozen labels
      And one provider attempt has <cost defect>
      When the maintainer evaluates the canary gate
      Then further paid checkpoints remain blocked and no later provider call is made

      Examples:
        | cost defect                 |
        | missing cost data           |
        | malformed cost data         |
        | cost inconsistent with usage|

  @pr-review-eval.SWM1.R5
  Rule: pr-review-eval.SWM1.R5 — Raw evidence and corpus roles cannot drift

    Scenario: Frozen raw artifacts can be reused
      Given an independently retained immutable manifest uses SHA-256 with canonical lowercase 64-character hexadecimal digests and unique canonical artifact identities
      And frozen configuration independently pins the trusted repository identity and immutable commit hash containing the manifest digest
      And an independent external anchor proves the manifest digest was retained before any artifact reuse or analysis
      And every raw artifact still matches its recorded identity and hash
      When the evaluation harness reuses the artifacts
      Then it verifies the pinned commit object from the trusted repository without branch or tag resolution
      And the exact verified bytes and identities are returned even when no score or report artifact exists

    @rejection
    Scenario Outline: Drifted raw evidence cannot be reused
      Given the raw evidence has <defect>
      When the evaluation harness verifies the artifact manifest
      Then reuse is rejected with the affected artifact identified

      Examples:
        | defect                                  |
        | a missing raw artifact                  |
        | an empty artifact manifest              |
        | a mutated raw artifact                  |
        | an extra artifact absent from the manifest|
        | duplicate canonical artifact identities|
        | an artifact identity with path traversal|
        | an absolute artifact path               |
        | a symlink escaping the artifact root    |
        | distinct identities resolving to one canonical artifact|
        | an artifact whose type changes between verification and use|
        | artifact bytes replaced between verification and use |
        | an artifact path target replaced between verification and use |
        | an artifact directory entry substituted between verification and use |
        | an ambiguous or changed hash algorithm |
        | an unsupported or weak hash algorithm  |
        | a malformed digest encoding            |
        | a digest length inconsistent with SHA-256|
        | a mutated manifest                      |
        | the manifest and local digest both replaced against the remote commit|
        | a manifest created after artifact reuse |
        | a manifest retained after analysis began but before artifact reuse |
        | a manifest derived from score output    |

    @rejection
    Scenario: The void corpus cannot confirm or tune the replacement scorer
      Given the 2026-08-01 corpus is marked void for instrument failure
      When an analysis requests scorer tuning or confirmatory estimates from it
      Then the analysis is rejected as diagnostic-only

    Scenario: Confirmatory estimates use a fresh holdout
      Given scorer calibration used only disjoint development cases
      And a fresh powered holdout and its reserves were preregistered before review
      When confirmatory estimates are requested
      Then only the fresh holdout and preregistered reserves are admitted

    @rejection
    Scenario Outline: Invalid holdout construction cannot produce confirmatory estimates
      Given the proposed confirmatory corpus has <defect>
      When confirmatory estimates are requested
      Then the request is rejected before any confirmatory review

      Examples:
        | defect                                  |
        | overlap with scorer development cases   |
        | registration after review began         |
        | a reserve absent from preregistration   |
        | power below the preregistered minimum   |
