# Test Definitions: Impl plan as first-class artifact

## Rule: The impl-plan parser reads the status lifecycle

### Scenario: impl-plan-artifact.SM1.AC2.status_planned_parses

Given an impl-plan.md whose body contains a `**Status:** planned` line
When the parser reads the file content
Then it reports status `planned`

- [x] RED 51fe3381
- [x] GREEN eb0fee1b
- [x] REFACTOR skip: 12-line parser, no duplication or naming debt yet

### Scenario: impl-plan-artifact.SM1.AC2.status_implemented_parses

Given an impl-plan.md whose body contains a `**Status:** implemented` line
When the parser reads the file content
Then it reports status `implemented`

- [x] RED skip: cannot fail first — status values are one closed-set check, both shipped in eb0fee1b
- [x] GREEN 709b62c8
- [x] REFACTOR skip: no structural change since eb0fee1b

### Scenario: impl-plan-artifact.SM1.AC2.missing_status_line_is_invalid

Given an impl-plan.md with five populated sections but no `**Status:**` line
When the parser reads the file content
Then it reports a validation error naming the missing status line

- [x] RED 9d6abaf5
- [x] GREEN 2d12b720
- [x] REFACTOR skip: single boolean guard added, nothing to restructure

### Scenario: impl-plan-artifact.SM1.AC2.unknown_status_value_is_invalid

Given an impl-plan.md containing `**Status:** shipped`
When the parser reads the file content
Then it reports a validation error listing the allowed values `planned` and `implemented`

- [x] RED 64c67f25
- [x] GREEN bc11f88b
- [x] REFACTOR skip: one else-branch, status block complete and readable

## Rule: Each of the five sections must carry content or an auditable skip

### Scenario: impl-plan-artifact.SM1.AC2.populated_section_satisfies

Given an impl-plan.md whose `## Decisions` section contains a table row
When the parser validates sections
Then the Decisions section is reported satisfied

- [x] RED 07ade4a6
- [x] GREEN f6a2af46
- [x] REFACTOR skip: activeLines helper extracted at GREEN; no further duplication

### Scenario: impl-plan-artifact.DEV1.AC2.skip_with_reason_satisfies

Given an impl-plan.md whose `## Arch alignment` section contains only `skip: no ADRs in this project yet`
When the parser validates sections
Then the Arch alignment section is reported satisfied with its skip reason preserved

- [x] RED bb2406d9
- [ ] GREEN
- [ ] REFACTOR

### Scenario: impl-plan-artifact.DEV1.AC2.bare_skip_is_invalid

Given an impl-plan.md whose `## Known deviations` section contains only `skip:`
When the parser validates sections
Then it reports a validation error naming Known deviations and the empty-reason rule

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: impl-plan-artifact.DEV1.AC2.whitespace_skip_reason_is_invalid

Given an impl-plan.md whose `## Assessment triggers` section contains only `skip:` followed by spaces
When the parser validates sections
Then it reports a validation error naming Assessment triggers and the empty-reason rule

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: impl-plan-artifact.SM1.AC2.empty_section_without_skip_is_invalid

Given an impl-plan.md whose `## Approach` section has no content and no skip line
When the parser validates sections
Then it reports a validation error naming Approach as empty and unskipped

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: impl-plan-artifact.SM1.AC2.missing_section_heading_is_invalid

Given an impl-plan.md that omits the `## Assessment triggers` heading entirely
When the parser validates sections
Then it reports a validation error naming the missing section

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: impl-plan-artifact.SM1.AC2.html_comment_content_counts_as_empty

Given an impl-plan.md section containing only the template's HTML-comment guidance
When the parser validates sections
Then that section is reported empty and unskipped

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: The stop-hook cumulative gate requires a valid impl plan for new-flow features at implement and done

### Scenario: impl-plan-artifact.DEV1.AC1.implement_without_impl_plan_blocks

Given a feature ticket at phase `implement` whose folder contains spec.md but no impl-plan.md
When the stop hook runs its cumulative artifact checks
Then it hard-blocks with a message naming impl-plan.md and the authoring point (scenario-gate exit)

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: impl-plan-artifact.DEV1.AC1.implement_with_valid_impl_plan_passes

Given a feature ticket at phase `implement` whose folder contains spec.md, a test-definitions.md with scenarios, and an impl-plan.md with five satisfied sections and a status line
When the stop hook runs its cumulative artifact checks
Then it permits the stop (no hard-block emitted)

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: impl-plan-artifact.SM1.AC1.invalid_impl_plan_blocks_with_named_section

Given a feature ticket at phase `implement` whose impl-plan.md has an empty unskipped `## Decisions` section
When the stop hook runs its cumulative artifact checks
Then it hard-blocks with a message naming the Decisions section

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: impl-plan-artifact.SM1.AC1.grandfathered_ticket_without_spec_is_exempt

Given a feature ticket at phase `implement` whose folder contains a test-definitions.md with scenarios but no spec.md and no impl-plan.md
When the stop hook runs its cumulative artifact checks
Then it permits the stop (no hard-block emitted)

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: impl-plan-artifact.SM1.AC1.task_ticket_is_exempt

Given a task ticket at phase `implement` with no impl-plan.md
When the stop hook runs its cumulative artifact checks
Then it permits the stop (no hard-block emitted)

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: impl-plan-artifact.SM1.AC1.pre_implement_phase_is_exempt

Given a new-flow feature ticket at phase `scenario-gate` whose folder contains spec.md and a test-definitions.md with scenarios but no impl-plan.md
When the stop hook runs its cumulative artifact checks
Then it permits the stop (no hard-block emitted)

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: impl-plan-artifact.SM1.AC1.done_phase_requires_impl_plan

Given a new-flow feature ticket at phase `done` whose folder contains spec.md but no impl-plan.md
When the stop hook runs its cumulative artifact checks
Then it hard-blocks naming impl-plan.md

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: The template and skill docs ship the artifact end to end

### Scenario: impl-plan-artifact.SM1.AC2.template_scaffold_parses_as_unfilled

Given the shipped impl-plan-template.md with its HTML comments intact
When the parser validates it as-is
Then all five sections are reported empty (guidance comments do not count as content)

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: impl-plan-artifact.DEV1.AC1.docs_reference_impl_plan_in_both_copies

Given the canonical skill files (packages/cli/templates/skills/bdd) and the dogfood copies (.claude/skills/bdd)
When the SCENARIOS.md scenario-gate exit step and the TDD.md entry step are scanned in both copies
Then each scanned file references impl-plan.md authoring and its five sections

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

---

## Feature-level cross-scenario refactor

Marked at verify-phase: either `<sha>` (the refactor commit) or `skip: <non-empty reason>` (no shared fixtures or duplication emerged). The done-gate hard-blocks if this row is missing or has an empty skip reason on tickets that use the annotated checkbox format.

- [ ] cross-scenario
