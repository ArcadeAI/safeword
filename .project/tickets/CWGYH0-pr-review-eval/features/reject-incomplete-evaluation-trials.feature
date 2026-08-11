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
        | incomplete trace or usage            | provenance-incomplete     |
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

  @pr-review-eval.SWM1.R2
  Rule: pr-review-eval.SWM1.R2 — Failure handling preserves paired experimental validity

    Scenario: One infrastructure failure is retried once
      Given the first provider attempt fails with a classified infrastructure error
      And the second attempt completes as a usable trial
      When the evaluation harness executes the work item
      Then it records exactly two provider attempts, makes no third call, and admits the second result

    @rejection
    Scenario: A second infrastructure failure excludes the paired case
      Given another member of the paired case already completed successfully
      And both permitted attempts for the current member fail with classified infrastructure errors
      When the evaluation harness executes the work item
      Then it records exactly two provider attempts and makes no third call
      And it quarantines every record for that paired case while retaining all artifacts and attempt costs
      And it selects the next frozen reserve

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

    @rejection
    Scenario: Paired-case quarantine is atomic
      Given a paired case has multiple completed trial artifacts
      And one later trial makes the case unusable
      When the harness quarantines the paired case
      Then no member of that case remains admitted and every member is retained together in quarantine

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
    Scenario Outline: Crash recovery preserves one quarantine and reserve decision
      Given a case becomes unusable and the harness crashes <boundary>
      When the harness resumes from durable state
      Then the whole case is quarantined exactly once and the same next frozen reserve is allocated exactly once

      Examples:
        | boundary                                |
        | before the atomic quarantine transition |
        | during the quarantine state transaction |
        | after quarantine before reserve allocation|
        | after reserve allocation before next work|

    Scenario: A process crash does not strand the run lock
      Given the run lock names a process that is no longer alive
      When the harness restarts against the same output directory
      Then it safely reclaims the stale lock and becomes the sole owner

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

    @rejection
    Scenario Outline: Interrupted quarantine is never partially scoreable
      Given a failure is injected <boundary>
      When scoring reads cases before and after harness restart
      Then it observes zero score inputs from the completely provisional or completely quarantined case
      And it never observes a split or admitted member of that case

      Examples:
        | boundary                              |
        | before the atomic case-directory move |
        | during the atomic case-directory move |
        | after the atomic case-directory move  |

    @rejection
    Scenario: Reserve exhaustion stops the run
      Given every preregistered reserve has already become unusable
      When another case requires replacement
      Then the run stops before further provider calls with reserve exhaustion identified

  @pr-review-eval.SWM1.R3
  Rule: pr-review-eval.SWM1.R3 — Scoring derives validity from admitted records

    Scenario: A complete run is scoreable
      Given a frozen matrix independently enumerates every expected case, system, variant, and trial before the run
      And the effective matrix replaces each quarantined primary with its deterministically allocated reserve
      And usable primaries and allocated replacements each have every required system and variant cell
      And quarantined primaries and unused reserves are outside the scoreable matrix
      And each cell contains exactly trials 1, 2, and 3 as usable records for that case
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
        | one unexpected system or variant cell   |

    @rejection
    Scenario: Validity gates change when admitted evidence changes
      Given two runs have identical record-file counts and cell dimensions
      And one run has all usable trials while the other has one hidden reviewer failure
      When the scorer computes their validity gates
      Then the first run passes completeness and the second run fails completeness

  @pr-review-eval.SWM1.R4
  Rule: pr-review-eval.SWM1.R4 — A paid canary gates larger spend

    Scenario: The no-cost fixture inventory is independently checkable
      Given the canonical R1 taxonomy is provider-failure, incomplete-provider-output, unexpected-finish, schema-invalid, routing-invalid, reviewer-failed, provenance-incomplete, provenance-mismatch, and unknown-state
      And a frozen input manifest enumerates one stable fixture identity and expected rejection reason for each canonical R1 class
      When the harness runs the no-cost preflight
      Then the recorded classes exactly equal the canonical R1 taxonomy with none missing or extra
      And each enumerated fixture has exactly one recorded outcome matching its expected rejection reason

    Scenario: Operational failure injection covers the R2 taxonomy
      Given the canonical R2 taxonomy is retry-success, retry-exhaustion, semantic-after-retry, early-failure, atomic-quarantine, crash-recovery, reserve-order, and reserve-exhaustion
      When the no-cost operational suite completes
      Then each canonical R2 class has exactly one passing failure-injection record with a stable scenario identity

    Scenario: The paid canary outcomes are independently checkable
      Given ten unique expected labels cover both systems and both variants with at least one finding success and one genuine-empty success
      And all ten paid calls are usable with complete attempt costs and provenance
      And every observed classification exactly matches its frozen expected label
      When the maintainer inspects individual canary records
      Then each frozen label has exactly one independently recorded matching outcome

    Scenario: A hidden provider failure is rejected through real wiring
      Given a provider HTTP-200 error envelope is injected only at the network boundary
      When the real runner, writer, and scorer process the response
      Then the raw injected response is preserved in one failed attempt classified as provider-failure
      And no scoreable record is produced

    Scenario: A clean canary authorizes the next checkpoint
      Given every frozen no-cost fixture outcome matches its expected rejection reason
      And every canonical R2 operational failure-injection record passes
      And each of the ten individual paid outcomes is usable and matches its frozen label
      And every attempt has complete valid cost data consistent with its recorded usage
      And the real-wiring hidden failure produced no scoreable record
      When the maintainer evaluates the canary gate
      Then the next paid checkpoint is authorized

    @rejection
    Scenario: One failed canary call blocks more spend
      Given one of ten paid canary calls is unusable
      When the maintainer evaluates the canary gate
      Then further paid checkpoints remain blocked with the failed call identified
      And no provider call for a later checkpoint is made

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
      And the manifest was retained before any artifact reuse or analysis
      And every raw artifact still matches its recorded identity and hash
      When the evaluation harness reuses the artifacts
      Then it verifies the pinned commit object from the trusted repository without branch or tag resolution
      And reuse atomically binds the verified artifact bytes and identity independently of derived scores or reports

    @rejection
    Scenario Outline: Drifted raw evidence cannot be reused
      Given the raw evidence has <defect>
      When the evaluation harness verifies the artifact manifest
      Then reuse is rejected with the affected artifact identified

      Examples:
        | defect                                  |
        | a missing raw artifact                  |
        | a mutated raw artifact                  |
        | an extra artifact absent from the manifest|
        | duplicate canonical artifact identities|
        | an artifact identity with path traversal|
        | an absolute artifact path               |
        | a symlink escaping the artifact root    |
        | distinct identities resolving to one canonical artifact|
        | an artifact whose type changes between verification and use|
        | an ambiguous or changed hash algorithm |
        | an unsupported or weak hash algorithm  |
        | a malformed digest encoding            |
        | a digest length inconsistent with SHA-256|
        | a mutated manifest                      |
        | the manifest and local digest both replaced against the remote commit|
        | a manifest created after artifact reuse |
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
