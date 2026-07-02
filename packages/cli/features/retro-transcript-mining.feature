# BDD source for RV9JT4. Proven by the vitest suite (tests named
# `retro-transcript-mining.*` under src/retro and tests/commands), whose
# command-level scenarios mock the GitHub transport + extractor boundaries — a
# shape the cucumber black-box lane can't drive. `@manual` excludes it from the
# cucumber acceptance lane's wiring/dry-run check while keeping it readable by
# codify / review-spec / safeword check.
@retro-transcript-mining @manual
Feature: safeword retro — transcript-mining session retrospective

  Mines a session transcript for qualitative safeword friction (bugs, rough
  edges, gaps the deterministic spool can't catch) and files it upstream
  autonomously, with an automated egress guard — constrained schema, deny-by-
  default sanitizer, and a code-owned GitHub write — so raw customer data in the
  transcript can never reach a public issue.

  Rule: Retro mines the transcript it is pointed at, never one it guesses

    @retro-transcript-mining.TB1.AC2
    Scenario: retro-transcript-mining.TB1.AC2.planted_friction_signal_is_extracted
      Given a transcript containing a known safeword gate-message friction signal
      When `safeword retro --transcript <path>` runs
      Then a finding is produced whose `safeword_surface` names that gate
      And whose `category` is `rough-edge`

    @retro-transcript-mining.TB1.AC2
    Scenario: retro-transcript-mining.TB1.AC2.missing_flag_fails_loudly_and_files_nothing
      Given no `--transcript` argument is supplied
      When `safeword retro` runs
      Then it exits non-zero with a message naming the missing transcript path
      And it never constructs a session path from the environment
      And it files nothing

    @retro-transcript-mining.TB1.AC2
    Scenario: retro-transcript-mining.TB1.AC2.unreadable_path_fails_loudly_and_files_nothing
      Given a `--transcript` path that does not exist or cannot be read
      When `safeword retro --transcript <path>` runs
      Then it exits non-zero with a clear message
      And it files nothing

  Rule: Safeword files autonomously, with no approval step

    @retro-transcript-mining.TB1.AC1
    Scenario: retro-transcript-mining.TB1.AC1.findings_are_filed_without_approval
      Given a transcript that yields at least one valid finding
      When `safeword retro --transcript <path>` runs with the GitHub transport mocked
      Then the create-or-comment transport is invoked for each finding
      And the command does not read an approval from stdin
      And it exits zero

  Rule: Findings cannot carry raw transcript prose

    @retro-transcript-mining.NTB1.AC1
    Scenario: retro-transcript-mining.NTB1.AC1.agent_prose_outside_schema_never_reaches_body
      Given a finding whose schema fields contain known marker values
      And the agent also emitted a free-prose blob outside the schema
      When the issue body is built
      Then the body contains every schema marker value
      And the body does not contain the free-prose blob

    @retro-transcript-mining.NTB1.AC1
    Scenario: retro-transcript-mining.NTB1.AC1.stray_agent_field_is_ignored
      Given an agent finding that includes an extra field not in the schema
      When the finding is normalized
      Then the extra field is dropped
      And it never reaches the issue body

  Rule: The egress guard sanitizes before egress and fails closed

    @retro-transcript-mining.NTB1.AC2
    Scenario: retro-transcript-mining.NTB1.AC2.secret_in_free_text_is_redacted
      Given a finding whose free-text field contains a secret-shaped token
      When the egress guard processes the finding
      Then the token is redacted before anything is filed

    @retro-transcript-mining.NTB1.AC2
    Scenario: retro-transcript-mining.NTB1.AC2.customer_path_redacted_safeword_path_kept
      Given a finding whose free-text field contains a customer absolute path and a safeword-internal path
      When the egress guard processes the finding
      Then the customer absolute path is redacted
      And the safeword-internal path is preserved

    @retro-transcript-mining.NTB1.AC2
    Scenario: retro-transcript-mining.NTB1.AC2.unresolvable_surface_is_dropped_not_filed
      Given a transcript yielding one finding with an unresolvable `safeword_surface` and one resolvable finding
      When `safeword retro --transcript <path>` runs with the GitHub transport mocked
      Then the transport is never invoked for the unresolvable finding
      And the resolvable finding is still filed

    @retro-transcript-mining.NTB1.AC2
    Scenario: retro-transcript-mining.NTB1.AC2.end_to_end_filed_payload_carries_no_customer_data
      Given a transcript whose mined finding fields contain a secret-shaped token and a customer absolute path
      When `safeword retro --transcript <path>` runs with the GitHub transport mocked
      Then the payload handed to the GitHub transport contains neither the token nor the customer path
      And it contains the redacted markers in their place

  Rule: Findings use the namespaced draft shape

    @retro-transcript-mining.SM1.AC1
    Scenario: retro-transcript-mining.SM1.AC1.finding_has_namespaced_draft_shape
      Given a valid finding
      When its draft is built
      Then the draft has `signature`, `title`, `body`, and `labels`
      And the signature is prefixed with `retro:`

    @retro-transcript-mining.SM1.AC1
    Scenario: retro-transcript-mining.SM1.AC1.retro_signature_never_equals_spool_signature
      Given the same underlying safeword crash seen by both the spool and retro
      When each derives its signature
      Then the retro signature is not equal to the spool signature

  Rule: Never a duplicate issue

    @retro-transcript-mining.SM1.AC2
    Scenario: retro-transcript-mining.SM1.AC2.unticketed_signature_creates_one_issue
      Given no upstream issue exists for a finding's signature
      When retro files the finding
      Then exactly one new issue is created

    @retro-transcript-mining.SM1.AC2
    Scenario: retro-transcript-mining.SM1.AC2.existing_signature_creates_no_duplicate
      Given an open upstream issue already represents a finding's signature
      When retro files the finding
      Then no second issue is created

    @retro-transcript-mining.SM1.AC2
    Scenario: retro-transcript-mining.SM1.AC2.matches_spool_filed_issue_without_duplicating
      Given an open spool-filed issue with the same title but a non-`retro:` signature
      When retro files the finding
      Then no duplicate issue is created

    @retro-transcript-mining.SM1.AC2
    Scenario: retro-transcript-mining.SM1.AC2.exactly_five_new_signatures_all_file
      Given a session yields exactly five new distinct signatures
      When retro files them
      Then five new issues are created
      And none are deferred

    @retro-transcript-mining.SM1.AC2
    Scenario: retro-transcript-mining.SM1.AC2.per_session_new_issue_cap_is_enforced
      Given a session yields more than five new distinct signatures
      When retro files them
      Then at most five new issues are created
      And the remainder are reported as left for a later session

  Rule: Every encounter is counted; every novel shape is recorded

    @retro-transcript-mining.SM1.AC3
    Scenario: retro-transcript-mining.SM1.AC3.known_issue_hit_bumps_the_ledger_once
      Given an open issue already represents a finding's signature
      When retro records the encounter for this session
      Then the issue's occurrence ledger is incremented once

    @retro-transcript-mining.SM1.AC3
    Scenario: retro-transcript-mining.SM1.AC3.rerun_on_same_transcript_does_not_double_count
      Given retro already recorded this session's encounter with a known issue
      When retro runs again on the same transcript
      Then the occurrence ledger is not incremented a second time

    @retro-transcript-mining.SM1.AC3
    Scenario: retro-transcript-mining.SM1.AC3.novel_manifestation_adds_a_comment
      Given an encounter with a known issue whose manifestation is not already documented
      When retro records the encounter
      Then a comment describing the new manifestation is added
      And that comment passes the egress guard

    @retro-transcript-mining.SM1.AC3
    Scenario: retro-transcript-mining.SM1.AC3.non_novel_recurrence_adds_no_comment
      Given an encounter with a known issue that adds nothing new
      When retro records the encounter
      Then the occurrence count increases
      And no comment is added
