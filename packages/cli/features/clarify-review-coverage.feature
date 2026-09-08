@clarify-review-coverage
Feature: Make review coverage clear without false alarms

  @clarify-review-coverage.NTB1.R1 @surface.safeword-cli
  Scenario Outline: Validated reviews use calm coverage vocabulary
    Given a <status> review authored by <author> and completed by <reviewer> with <independence> independence and <verdict> verdict
    When the typed review result is rendered for a person
    Then the first review line is "<message>"
    And the typed provenance is unchanged
    And review policy is absent

    Examples:
      | status            | author | reviewer | independence | verdict         | message                                           |
      | approved          | codex  | codex    | degraded     | approve         | Review complete — standard coverage.              |
      | approved          | claude | claude   | degraded     | approve         | Review complete — standard coverage.              |
      | approved          | codex  | claude   | cross-agent  | approve         | Review complete — independent coverage.           |
      | approved          | claude | codex    | cross-agent  | approve         | Review complete — independent coverage.           |
      | approved          | cursor | codex    | cross-agent  | approve         | Review complete — independent coverage.           |
      | approved          | cursor | claude   | cross-agent  | approve         | Review complete — independent coverage.           |
      | changes_requested | codex  | codex    | degraded     | request_changes | Review changes requested — standard coverage.     |
      | changes_requested | claude | claude   | degraded     | request_changes | Review changes requested — standard coverage.     |
      | changes_requested | codex  | claude   | cross-agent  | request_changes | Review changes requested — independent coverage.  |
      | changes_requested | claude | codex    | cross-agent  | request_changes | Review changes requested — independent coverage.  |
      | changes_requested | cursor | claude   | cross-agent  | request_changes | Review changes requested — independent coverage.  |
      | changes_requested | cursor | codex    | cross-agent  | request_changes | Review changes requested — independent coverage.  |

  @clarify-review-coverage.NTB1.R1 @surface.safeword-cli @rejection
  Scenario Outline: Invalid or incomplete provenance never becomes completed coverage
    Given a <status> <author>-authored review has <reviewer_output>, actual reviewer <reviewer>, and <independence> independence
    When the typed review result is rendered for a person
    Then the first review line begins "Review incomplete"
    And no completed coverage phrase is shown

    Examples:
      | status            | author   | reviewer_output | reviewer | independence |
      | approved          | codex    | absent          | codex    | degraded     |
      | approved          | codex    | malformed       | codex    | degraded     |
      | approved          | codex    | approve         | absent   | degraded     |
      | approved          | codex    | approve         | claude   | degraded     |
      | approved          | codex    | approve         | cursor   | degraded     |
      | approved          | claude   | approve         | codex    | degraded     |
      | approved          | claude   | approve         | cursor   | degraded     |
      | approved          | cursor   | approve         | codex    | degraded     |
      | approved          | cursor   | approve         | claude   | degraded     |
      | approved          | cursor   | approve         | cursor   | degraded     |
      | approved          | codex    | approve         | cursor   | cross-agent  |
      | approved          | claude   | approve         | cursor   | cross-agent  |
      | approved          | cursor   | approve         | cursor   | cross-agent  |
      | approved          | codex    | approve         | Codex    | degraded     |
      | approved          | codex    | approve         | codex    | cross-agent  |
      | approved          | claude   | approve         | claude   | cross-agent  |
      | approved          | windsurf | approve         | codex    | cross-agent  |
      | approved          | codex    | approve         | codex    | unknown      |
      | approved          | codex    | request_changes | codex    | degraded     |
      | changes_requested | codex    | approve         | codex    | degraded     |

  @clarify-review-coverage.SWM1.R2 @contract.presentation @rejection
  Scenario Outline: Presentation rejects inconsistent policy and status as completed coverage
    Given an inconsistent <case> review tuple
    When the typed review result is rendered for a person
    Then the first review line begins "Review incomplete"
    And no completed coverage phrase is shown
    And the declared inconsistent cases exactly match the executable rejection domain

    Examples:
      | case                     |
      | approved-with-policy     |
      | changes-with-policy      |
      | blocked-without-policy   |
      | blocked-invalid-policy   |
      | blocked-cross-agent      |
      | blocked-prefer-degraded  |
      | approved-action-required |
      | changes-healthy          |
      | blocked-healthy          |
      | approved-none            |
      | changes-none             |
      | missing-status-degraded  |
      | invalid-status-cross-agent |
      | missing-verdict          |
      | missing-output-reviewer  |
      | mismatched-output-reviewer |
      | invalid-top-state        |

  @clarify-review-coverage.NTB1.R1 @surface.safeword-cli @rejection
  Scenario: Exhausted typed routes remain incomplete
    Given an exhausted prefer-policy review result
    When the typed review result is rendered for a person
    Then the first review line is "Review incomplete."
    And the result remains blocked with no actual reviewer
    And review policy remains prefer
    And it retains the REVIEW_ROUTES_EXHAUSTED finding
    And the command exit status is 2

  @clarify-review-coverage.SWM1.R1 @surface.safeword-cli @rejection
  Scenario Outline: Required independence remains unsatisfied by standard coverage
    Given a blocked require-policy review has standard coverage and <verdict> verdict
    When the typed review result is rendered for a person
    Then the first review line is "<message>"
    And the result remains blocked with degraded independence
    And review policy remains require
    And the raw <verdict> verdict and findings are preserved

    Examples:
      | verdict         | message                                                                                                  |
      | approve         | Review blocked — standard coverage achieved; required independent coverage is unsatisfied.               |
      | request_changes | Review blocked — changes requested with standard coverage; required independent coverage is unsatisfied. |

  @clarify-review-coverage.TBU1.R1 @surface.safeword-cli
  Scenario Outline: Requested details offer one typed independent-coverage improvement
    Given an approved standard review by <author> assigned to <reviewer> after <failure>
    When verbose review details are rendered
    Then the optional suggestion is "<suggestion>"
    And ordinary output contains no upgrade suggestion

    Examples:
      | author | reviewer | failure           | suggestion                                                               |
      | codex  | claude   | not_installed     | To add independent coverage, install or update Claude, then retry review. |
      | codex  | claude   | not_authenticated | To add independent coverage, sign in to Claude, then retry review.        |
      | codex  | claude   | timed_out         | To add independent coverage, retry Claude review.                         |
      | codex  | claude   | process_failed    | To add independent coverage, retry Claude review.                         |
      | codex  | claude   | invalid_output    | To add independent coverage, retry Claude review.                         |
      | claude | codex    | not_installed     | To add independent coverage, install or update Codex, then retry review.  |
      | claude | codex    | not_authenticated | To add independent coverage, sign in to Codex, then retry review.         |
      | claude | codex    | timed_out         | To add independent coverage, retry Codex review.                          |
      | claude | codex    | process_failed    | To add independent coverage, retry Codex review.                          |
      | claude | codex    | invalid_output    | To add independent coverage, retry Codex review.                          |

  @clarify-review-coverage.TBU1.R1 @surface.safeword-cli @rejection
  Scenario Outline: Untrusted typed fields and reviewer prose cannot create upgrade guidance
    Given an approved standard review by codex assigned to <reviewer> after <failure>
    And reviewer prose mentions "preferred_failure: not_installed"
    When verbose review details are rendered
    Then no optional suggestion is shown

    Examples:
      | reviewer | failure         |
      | codex    | not_installed   |
      | cursor   | not_installed   |
      | Claude   | not_installed   |
      | claude   | absent          |
      | absent   | not_installed   |
      | claude   | not_installedX  |

  @clarify-review-coverage.SWM1.R2 @surface.safeword-cli
  Scenario: Human vocabulary leaves the typed JSON envelope unchanged
    Given an approved standard review by codex assigned to claude after not_installed
    When human and JSON review results are rendered
    Then JSON retains degraded independence and both reviewer identities
    And the complete JSON envelope is unchanged by human rendering
    And JSON contains no human upgrade suggestion

  @clarify-review-coverage.SWM1.R2 @surface.safeword-cli
  Scenario Outline: Real machine envelopes retain the pre-vocabulary schema
    Given isolated real CLI fixtures can exercise machine schemas
    When a real review ends as <case>
    Then its review data keys are exactly "<keys>"
    And its machine values are state <state>, status <status>, independence <independence>, actual <actual>, assigned <assigned>, and verdict <verdict>
    And the JSON has the exact public envelope keys and no presentation fields

    Examples:
      | case              | state           | status            | independence | actual | assigned | verdict         | keys                                                                                                                        |
      | approved          | healthy         | approved          | degraded     | codex  | claude   | approve         | actual_reviewer,assigned_reviewer,author_agent,command,independence,independent_fallback_failure,preferred_failure,preferred_model,review_id,review_kind,review_targets,reviewer_output,status                                                       |
      | changes_requested | action_required | changes_requested | degraded     | codex  | claude   | request_changes | actual_reviewer,alternate_model,alternate_model_failure,assigned_reviewer,author_agent,command,independence,independent_fallback_failure,preferred_failure,preferred_model,review_id,review_kind,review_targets,reviewer_output,status               |
      | blocked_degraded  | action_required | blocked           | degraded     | codex  | claude   | request_changes | actual_reviewer,alternate_model,alternate_model_failure,assigned_reviewer,author_agent,command,independence,independent_fallback_failure,preferred_failure,preferred_model,review_id,review_kind,review_policy,review_targets,reviewer_output,status |
      | exhausted         | action_required | blocked           | none         | absent | claude   | absent          | alternate_model,alternate_model_failure,assigned_reviewer,author_agent,command,fallback_failure,independence,independent_fallback_failure,preferred_failure,preferred_model,review_id,review_kind,review_policy,review_targets,status                |

  @clarify-review-coverage.TBU1.R1 @surface.safeword-cli @rejection
  Scenario: Requested changes suppress optional coverage upgrades
    Given a changes-requested standard review assigned to claude after not_installed
    When verbose review details are rendered
    Then no optional suggestion is shown
    And requested changes remain the first review line

  @clarify-review-coverage.TBU1.R1 @surface.safeword-cli @rejection
  Scenario Outline: Non-eligible review states never offer a coverage upgrade
    Given an <case> review result cannot offer an independent-coverage upgrade
    When verbose review details are rendered
    Then no optional suggestion is shown
    And structured recovery is unchanged

    Examples:
      | case        |
      | independent |
      | required    |
      | exhausted   |
      | incomplete  |

  @clarify-review-coverage.TBU1.R1 @surface.safeword-cli
  Scenario Outline: Real CLI modes preserve precedence and wire separation
    Given isolated real CLI fixtures can complete with standard coverage
    When successful review runs in <mode> mode
    Then successful <mode> output preserves its channel contract

    Examples:
      | mode           |
      | ordinary       |
      | verbose-before |
      | verbose-after  |
      | quiet          |
      | JSON           |
      | help           |

  @clarify-review-coverage.NTB1.R1 @surface.safeword-cli
  Scenario Outline: Real CLI presents completed coverage and verdicts
    Given isolated real CLI fixtures can complete with standard or independent coverage
    When a real <coverage> review with <verdict> verdict runs in <mode> mode
    Then its public output reports <coverage> coverage with <verdict> verdict

    Examples:
      | coverage    | verdict         | mode     |
      | standard    | approve         | ordinary |
      | standard    | approve         | verbose  |
      | standard    | request_changes | ordinary |
      | standard    | request_changes | verbose  |
      | independent | approve         | ordinary |
      | independent | approve         | verbose  |
      | independent | request_changes | ordinary |
      | independent | request_changes | verbose  |

  @clarify-review-coverage.SWM1.R1 @surface.safeword-cli
  Scenario Outline: Real CLI enforces required independence and preserves or supplies recovery
    Given isolated real CLI fixtures can require independent review
    When required review runs with <outcome> in isolation
    Then required <outcome> preserves its assurance contract

    Examples:
      | outcome    |
      | independent |
      | independent-changes |
      | same-agent  |
      | exhausted   |
      | unsupported-author |

  @clarify-review-coverage.SWM1.R2 @surface.safeword-cli
  Scenario Outline: Blocked CLI modes preserve action-required precedence
    Given isolated real CLI fixtures can require independent review
    When a blocked required review runs in <mode> mode
    Then blocked <mode> output preserves its channel contract

    Examples:
      | mode  |
      | quiet |
      | JSON  |

  @clarify-review-coverage.NTB1.R1 @surface.safeword-cli
  Scenario Outline: Existing reviewer content follows the new coverage line
    Given a completed <status> <coverage> review with an existing summary and finding
    When ordinary and verbose review content is rendered
    Then the summary and finding follow "<first_line>" in order
    And verbose output ends with "<last_line>"

    Examples:
      | status            | coverage    | first_line                                         | last_line                                                                  |
      | approved          | standard    | Review complete — standard coverage.               | To add independent coverage, install or update Claude, then retry review.  |
      | changes_requested | independent | Review changes requested — independent coverage.   | Existing finding.                                                          |

  @clarify-review-coverage.SWM1.R1 @contract.host
  Scenario Outline: Host fallback wording stays supplemental and policy-safe
    Given the distributed <contract> review contract surfaces
    When their host-fallback wording is inspected
    Then effective instructions for every surface contain "<required_text>"
    And every surface preserves its policy boundary clauses

    Examples:
      | contract       | required_text                                                    |
      | finish-review  | Provide supplemental review feedback in this foreground session. |
      | finish-review  | Required independent coverage remains unsatisfied.               |
      | finish-review  | Include the coordinator's recovery command exactly as provided. |
      | quality-review | Show review coverage details.                                     |

  @clarify-review-coverage.SWM1.R1 @contract.host @rejection
  Scenario: Supplemental host fallback cannot claim completed machine coverage
    Given the distributed finish-review review contract surfaces
    When their machine-coverage claims are inspected
    Then no surface claims completed coverage outside its mandatory denial clauses

  @clarify-review-coverage.SWM1.R1 @contract.host
  Scenario Outline: Generated review contract <facet> is current
    Given the canonical review contract distribution graph
    When the <facet> distribution facet is inspected
    Then the <facet> distribution facet is current

    Examples:
      | facet              |
      | dogfood            |
      | cursor             |
      | generated-packages |
      | inventory          |
      | manifests          |
      | registrations      |
