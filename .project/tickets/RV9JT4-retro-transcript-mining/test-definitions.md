# Test Definitions: `safeword retro` — transcript-mining session retrospective (RV9JT4)

Feature source: `packages/cli/features/retro-transcript-mining.feature`
(Given/When/Then live there — not duplicated here. This file is the R/G/R ledger.)

<!-- Lineage: retro-transcript-mining.<JTBD>.AC<#>.<name>.
     TB1 = effortless reporting (autonomy + transcript input);
     NTB1 = no-leak guarantee (schema + sanitizer/fail-closed);
     SM1 = clean evidence stream (namespaced shape + dedup + encounter ledger).
     Unit layer: body assembly, surface resolution, prose sanitizer, signature,
     dedup decision, novelty check. Command layer: `safeword retro --transcript`
     in a temp dir with only the GitHub transport boundary mocked. -->

## Rule: Retro mines the transcript it is pointed at, never one it guesses

### Scenario: retro-transcript-mining.TB1.AC2.planted_friction_signal_is_extracted

- [x] RED b4dc268
- [x] GREEN b4dc268
- [x] REFACTOR skip: command wiring test (real pipeline, mocked extract+transport boundaries); cleanup folded into GREEN

### Scenario: retro-transcript-mining.TB1.AC2.missing_flag_fails_loudly_and_files_nothing

- [x] RED b4dc268
- [x] GREEN b4dc268
- [x] REFACTOR skip: command wiring test (real pipeline, mocked extract+transport boundaries); cleanup folded into GREEN

### Scenario: retro-transcript-mining.TB1.AC2.unreadable_path_fails_loudly_and_files_nothing

- [x] RED b4dc268
- [x] GREEN b4dc268
- [x] REFACTOR skip: command wiring test (real pipeline, mocked extract+transport boundaries); cleanup folded into GREEN

## Rule: Safeword files autonomously, with no approval step

### Scenario: retro-transcript-mining.TB1.AC1.findings_are_filed_without_approval

- [x] RED b4dc268
- [x] GREEN b4dc268
- [x] REFACTOR skip: command wiring test (real pipeline, mocked extract+transport boundaries); cleanup folded into GREEN

## Rule: Findings cannot carry raw transcript prose

### Scenario: retro-transcript-mining.NTB1.AC1.agent_prose_outside_schema_never_reaches_body

- [x] RED 613e8d4
- [x] GREEN 613e8d4
- [x] REFACTOR skip: pure normalizer + body assembler; cleanup folded into GREEN

### Scenario: retro-transcript-mining.NTB1.AC1.stray_agent_field_is_ignored

- [x] RED 613e8d4
- [x] GREEN 613e8d4
- [x] REFACTOR skip: pure normalizer; cleanup folded into GREEN

## Rule: The egress guard sanitizes before egress and fails closed

### Scenario: retro-transcript-mining.NTB1.AC2.secret_in_free_text_is_redacted

- [x] RED 175a4fe
- [x] GREEN 175a4fe
- [x] REFACTOR skip: pure scrub fn; cleanup folded into GREEN

### Scenario: retro-transcript-mining.NTB1.AC2.customer_path_redacted_safeword_path_kept

- [x] RED 175a4fe
- [x] GREEN 175a4fe
- [x] REFACTOR skip: pure scrub fn; cleanup folded into GREEN

### Scenario: retro-transcript-mining.NTB1.AC2.unresolvable_surface_is_dropped_not_filed

- [x] RED b4dc268
- [x] GREEN b4dc268
- [x] REFACTOR skip: command wiring test (real pipeline, mocked extract+transport boundaries); cleanup folded into GREEN

### Scenario: retro-transcript-mining.NTB1.AC2.end_to_end_filed_payload_carries_no_customer_data

- [x] RED b4dc268
- [x] GREEN b4dc268
- [x] REFACTOR skip: command wiring test (real pipeline, mocked extract+transport boundaries); cleanup folded into GREEN

## Rule: Findings use the namespaced draft shape

### Scenario: retro-transcript-mining.SM1.AC1.finding_has_namespaced_draft_shape

- [x] RED 94b5247
- [x] GREEN 94b5247
- [x] REFACTOR skip: pure draft builder; cleanup folded into GREEN

### Scenario: retro-transcript-mining.SM1.AC1.retro_signature_never_equals_spool_signature

- [x] RED 94b5247
- [x] GREEN 94b5247
- [x] REFACTOR skip: pure signature fn; cleanup folded into GREEN

## Rule: Never a duplicate issue

### Scenario: retro-transcript-mining.SM1.AC2.unticketed_signature_creates_one_issue

- [x] RED 9caf5c3
- [x] GREEN 9caf5c3
- [x] REFACTOR skip: real logic + fake-transport wiring test; cleanup folded into GREEN

### Scenario: retro-transcript-mining.SM1.AC2.existing_signature_creates_no_duplicate

- [x] RED 9caf5c3
- [x] GREEN 9caf5c3
- [x] REFACTOR skip: real logic + fake-transport wiring test; cleanup folded into GREEN

### Scenario: retro-transcript-mining.SM1.AC2.matches_spool_filed_issue_without_duplicating

- [x] RED 9caf5c3
- [x] GREEN 9caf5c3
- [x] REFACTOR skip: real logic + fake-transport wiring test; cleanup folded into GREEN

### Scenario: retro-transcript-mining.SM1.AC2.exactly_five_new_signatures_all_file

- [x] RED 9caf5c3
- [x] GREEN 9caf5c3
- [x] REFACTOR skip: real logic + fake-transport wiring test; cleanup folded into GREEN

### Scenario: retro-transcript-mining.SM1.AC2.per_session_new_issue_cap_is_enforced

- [x] RED 9caf5c3
- [x] GREEN 9caf5c3
- [x] REFACTOR skip: real logic + fake-transport wiring test; cleanup folded into GREEN

## Rule: Every encounter is counted; every novel shape is recorded

### Scenario: retro-transcript-mining.SM1.AC3.known_issue_hit_bumps_the_ledger_once

- [x] RED 9caf5c3
- [x] GREEN 9caf5c3
- [x] REFACTOR skip: real logic + fake-transport wiring test; cleanup folded into GREEN

### Scenario: retro-transcript-mining.SM1.AC3.rerun_on_same_transcript_does_not_double_count

- [x] RED 9caf5c3
- [x] GREEN 9caf5c3
- [x] REFACTOR skip: real logic + fake-transport wiring test; cleanup folded into GREEN

### Scenario: retro-transcript-mining.SM1.AC3.novel_manifestation_adds_a_comment

- [x] RED 9caf5c3
- [x] GREEN 9caf5c3
- [x] REFACTOR skip: real logic + fake-transport wiring test; cleanup folded into GREEN

### Scenario: retro-transcript-mining.SM1.AC3.non_novel_recurrence_adds_no_comment

- [x] RED 9caf5c3
- [x] GREEN 9caf5c3
- [x] REFACTOR skip: real logic + fake-transport wiring test; cleanup folded into GREEN
