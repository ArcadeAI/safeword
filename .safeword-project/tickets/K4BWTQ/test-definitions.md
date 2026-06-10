# Test Definitions: ADR consultation step

## Rule: The architecture-record helper resolves file-or-directory locations

### Scenario: adr-consultation.DEV1.AC1.single_file_location_is_the_record

Given `paths.architecture` resolves to an existing markdown file
When the helper lists architecture records
Then it reports kind `file` with that file as the single record

- [x] RED 27e34f04
- [x] GREEN 9d113675
- [x] REFACTOR skip: 5-line file branch, nothing to restructure

### Scenario: adr-consultation.DEV1.AC1.directory_location_lists_each_md_as_adr

Given the location is a directory containing `0001-storage.md`, `ADR-queue.md`, `naming-freeform.md`, a non-markdown `notes.txt`, and a subdirectory `nested/` holding `0002-deep.md`
When the helper lists architecture records
Then it reports kind `directory` and the record set equals exactly the three top-level `.md` files (order-insensitive; accept-any naming, no recursion, non-markdown excluded)

- [x] RED 1ace2ffa
- [x] GREEN ff8fa6b8
- [x] REFACTOR skip: directory branch is one filter chain, readable as-is

### Scenario: adr-consultation.DEV1.AC1.readme_is_excluded_from_directory_records

Given the location is a directory containing `README.md` and `0001-storage.md`
When the helper lists architecture records
Then the records contain `0001-storage.md` only

- [x] RED bff235e7
- [ ] GREEN
- [ ] REFACTOR

### Scenario: adr-consultation.DEV1.AC2.absent_location_reports_no_records

Given the resolved location does not exist
When the helper lists architecture records
Then it reports kind `absent` with zero records

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: adr-consultation.DEV1.AC2.readme_only_directory_reports_no_records

Given the location is a directory containing only `README.md`
When the helper lists architecture records
Then it reports kind `directory` with zero records

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: adr-consultation.DEV1.AC1.configured_override_directory_is_consumed

Given `.safeword/config.json` sets `paths.architecture` to a project-relative directory of ADRs
When the helper lists architecture records for the project
Then the override directory's `.md` files are the records

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: safeword check flags architecture claims structurally

### Scenario: adr-consultation.SM1.AC1.content_with_absent_location_flags

Given a new-flow feature ticket whose impl-plan.md Arch alignment section has content
And the resolved architecture location does not exist
When `safeword check` runs
Then it surfaces a question naming the ticket and the missing architecture location

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: adr-consultation.SM1.AC1.skip_with_absent_location_is_clean

Given a ticket whose Arch alignment section is `skip: no ADRs in this project yet`
And the architecture location does not exist
When `safeword check` runs
Then no architecture question is surfaced for that ticket

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: adr-consultation.SM1.AC1.content_with_present_location_is_clean

Given a ticket whose Arch alignment section has content
And the architecture location exists with at least one record
When `safeword check` runs
Then no architecture question is surfaced for that ticket

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: The skill docs teach the consultation procedure end to end

### Scenario: adr-consultation.DEV1.AC2.docs_show_consultation_and_first_adr_prompt_in_both_copies

Given the canonical skill files (packages/cli/templates/skills/bdd) and the dogfood copies (.claude/skills/bdd)
When SCENARIOS.md's scenario-gate exit is scanned in both copies
Then each copy contains, as three separately-asserted markers: (a) the consultation procedure step (list/read records at the resolved location), (b) the canonical "None recorded yet" copy, and (c) the first-ADR prompt with both branches in the worked example

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

---

## Feature-level cross-scenario refactor

Marked at verify-phase: either `<sha>` (the refactor commit) or `skip: <non-empty reason>` (no shared fixtures or duplication emerged). The done-gate hard-blocks if this row is missing or has an empty skip reason on tickets that use the annotated checkbox format.

- [ ] cross-scenario
