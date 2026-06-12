# Test Definitions: Independent evidence-backed architecture gate

Scenarios prove the ACs in `spec.md`. The gate extends `stop-quality.ts`'s impl-plan check at the implement→verify/done exit. "Blocks" means the stop hook hard-blocks the phase exit; "passes" means it allows it.

**Decided postures** (resolved during scenario-gate review):

- **Citation shape** — minimal/structural: a "cited source" is a line carrying a URL (`https://…`) or a `[n]`-style source-reference marker. Non-empty prose alone is not a citation.
- **Layering precedence** — the new evidence/stamp checks run only on a present, well-formed impl-plan. #204's existence block and `parseImplPlan` errors fire first; the new reasons surface only after the plan parses.
- **Cross-model comparison** — the gate compares two recorded tag strings (reviewer-model on the stamp, author-model captured at SessionStart into `SAFEWORD_AUTHOR_MODEL`), trimmed and case-insensitive. Both are **orchestrator-recorded**, not subagent self-report (Claude Code withholds model identity from subagents). Author-model absent under cross-model-required fails closed (blocks).

## Rule: Enabled — a new-flow feature cannot leave implement without cited evidence in Decisions

> Rationale: the generation half. A design recorded without evidence is the confident un-researched guess the gate exists to stop. Proves architecture-gate.DEV1.AC1.

### Scenario: architecture-gate.DEV1.AC1.decisions_with_citation_passes

Given the review gate is enabled
And a new-flow feature at the implement→verify exit
And its impl-plan.md Decisions section contains a line carrying a URL or a `[n]` source-reference marker
When the stop hook evaluates the phase exit
Then the exit is allowed

- [x] RED a3bdc8e
- [x] GREEN 67b27fb
- [x] REFACTOR skip: helper is a single predicate, no structural improvement

### Scenario: architecture-gate.DEV1.AC1.decisions_without_citation_blocks

Given the review gate is enabled
And a new-flow feature at the implement→verify exit
And its impl-plan.md Decisions section contains prose but no URL and no source-reference marker
When the stop hook evaluates the phase exit
Then the exit is blocked with a reason naming the missing evidence

- [x] RED 1d91171
- [x] GREEN 39b0e96
- [x] REFACTOR skip: gate is one function, no structural change

### Scenario: architecture-gate.DEV1.AC1.decisions_evidence_skip_with_reason_passes

Given the review gate is enabled
And a new-flow feature at the implement→verify exit
And its impl-plan.md Decisions section is a single-line `skip: <reason>` with a non-empty reason
When the stop hook evaluates the phase exit
Then the exit is allowed

- [x] RED skip: coverage cell for the decisionsSkipped branch built in 39b0e96
- [x] GREEN 55c3c8b
- [x] REFACTOR skip: no structural change

### Scenario: architecture-gate.DEV1.AC1.decisions_evidence_bare_skip_blocks

Given the review gate is enabled
And a new-flow feature at the implement→verify exit
And its impl-plan.md Decisions section is a bare `skip:` carrying no reason
When the stop hook evaluates the phase exit
Then the exit is blocked with a reason demanding a non-empty skip

- [x] RED skip: precedence — bare skip is a parseImplPlan error blocked by checkImplPlanArtifact (#204)
- [x] GREEN skip: proven by impl-plan.test.ts bare-skip case (#204)
- [x] REFACTOR skip: inherited behavior, no new code

### Scenario: architecture-gate.DEV1.AC1.skip_with_trailing_content_treated_as_uncited_content_blocks

Given the review gate is enabled
And a new-flow feature at the implement→verify exit
And its impl-plan.md Decisions section has a `skip:` line followed by further body lines
When the stop hook evaluates the phase exit
Then the exit is blocked because a multi-line section is content, not a skip, and carries no citation

- [x] RED skip: covered by parseImplPlan multi-line rule (body.length>1 is content) + hasCitation unit
- [x] GREEN skip: gate treats it as uncited content via the 39b0e96 branch
- [x] REFACTOR skip: no new code

## Rule: Enabled — layering on #204's existence and parse checks

> Rationale: the new evidence/stamp checks sit on top of #204's gate; absent or malformed plans must be handled before the new reasons can apply. Proves the AC1 boundary (precedence).

### Scenario: architecture-gate.DEV1.AC1.impl_plan_absent_blocks_existence_first

Given the review gate is enabled
And a new-flow feature at the implement→verify exit
And no impl-plan.md exists in the ticket folder
When the stop hook evaluates the phase exit
Then the exit is blocked by the existing impl-plan existence check, before the evidence check runs

- [x] RED skip: precedence — checkImplPlanArtifact existence block fires first (#204 impl-plan-gate.test.ts)
- [x] GREEN skip: gate returns early when plan absent (39b0e96); existence owned by #204
- [x] REFACTOR skip: inherited behavior

### Scenario: architecture-gate.DEV1.AC1.decisions_section_missing_blocks_before_evidence_check

Given the review gate is enabled
And a new-flow feature at the implement→verify exit
And its impl-plan.md has no satisfied Decisions section (heading absent, or body empty)
When the stop hook evaluates the phase exit
Then the exit is blocked by the existing impl-plan section validation, before the citation check runs

- [x] RED skip: precedence — parseImplPlan section error blocked by checkImplPlanArtifact (#204)
- [x] GREEN skip: gate returns early on parse errors (39b0e96); section validation owned by #204
- [x] REFACTOR skip: inherited behavior

### Scenario: architecture-gate.DEV1.AC1.malformed_plan_blocks_before_evidence_check

Given the review gate is enabled
And a new-flow feature at the implement→verify exit
And its impl-plan.md fails to parse (a section error reported by the parser)
When the stop hook evaluates the phase exit
Then the exit is blocked by the parser error, and the evidence check does not run

- [x] RED skip: precedence — parseImplPlan error blocked by checkImplPlanArtifact (#204)
- [x] GREEN skip: gate returns early on parse errors (39b0e96)
- [x] REFACTOR skip: inherited behavior

## Rule: Enabled — leaving implement requires a matching design-review stamp

> Rationale: the selection half. The stamp is bound to the impl-plan's content hash and to this ticket, so a review of a since-edited plan, or of another ticket, no longer counts. Proves architecture-gate.DEV1.AC2.

### Scenario: architecture-gate.DEV1.AC2.matching_design_review_stamp_passes

Given the review gate is enabled
And a new-flow feature at the implement→verify exit whose impl-plan.md carries cited evidence
And a design-review stamp exists scoped to this ticket and the impl-plan's current content hash
When the stop hook evaluates the phase exit
Then the exit is allowed

- [x] RED 1d91171
- [x] GREEN 39b0e96
- [x] REFACTOR skip: no structural change

### Scenario: architecture-gate.DEV1.AC2.missing_design_review_stamp_blocks

Given the review gate is enabled
And a new-flow feature at the implement→verify exit whose impl-plan.md carries cited evidence
And no design-review stamp exists for the impl-plan
When the stop hook evaluates the phase exit
Then the exit is blocked with a reason requesting an independent design review

- [x] RED 1d91171
- [x] GREEN 39b0e96
- [x] REFACTOR skip: no structural change

### Scenario: architecture-gate.DEV1.AC2.same_stamp_stops_matching_after_plan_edit_blocks

Given the review gate is enabled
And a design-review stamp was written for the impl-plan at content hash H
And that same stamp leaves the exit allowed while the plan is still at hash H
And the impl-plan's Decisions body is then edited so its content hash is no longer H
When the stop hook re-evaluates the phase exit
Then the exit is now blocked because the stamp's hash binds to the pre-edit design

- [x] RED 1d91171
- [x] GREEN 39b0e96
- [x] REFACTOR skip: no structural change

### Scenario: architecture-gate.DEV1.AC2.stamp_for_other_ticket_same_hash_blocks

Given the review gate is enabled
And a new-flow feature at the implement→verify exit whose impl-plan.md carries cited evidence
And the only design-review stamp at the impl-plan's content hash is scoped to a different ticket id
When the stop hook evaluates the phase exit
Then the exit is blocked because the stamp is not scoped to this ticket

- [x] RED skip: coverage cell for the ticket-qualified scope built in 39b0e96
- [x] GREEN 55c3c8b
- [x] REFACTOR skip: no structural change

### Scenario: architecture-gate.DEV1.AC2.review_skip_with_reason_passes

Given the review gate is enabled
And a new-flow feature at the implement→verify exit whose impl-plan.md carries cited evidence
And the design review is logged as `skip: <reason>` with a non-empty reason
When the stop hook evaluates the phase exit
Then the exit is allowed

- [x] RED skip: coverage cell for the skip-satisfies path built in 39b0e96
- [x] GREEN 55c3c8b
- [x] REFACTOR skip: no structural change

### Scenario: architecture-gate.DEV1.AC1.both_halves_skipped_with_reasons_passes

Given the review gate is enabled
And a new-flow feature at the implement→verify exit
And its Decisions evidence is `skip: <reason>` and its design review is logged `skip: <reason>`, both with non-empty reasons
When the stop hook evaluates the phase exit
Then the exit is allowed because both halves carry an auditable skip

- [x] RED skip: coverage cell combining both skip paths built in 39b0e96
- [x] GREEN 55c3c8b
- [x] REFACTOR skip: no structural change

## Rule: Cross-model review — when configured, a same-model stamp does not satisfy the gate

> Rationale: the ceiling-raiser. A fresh-context review by the same model shares the author's blind spots; cross-model is the opt-in that breaks correlated errors. The gate compares recorded tag strings. Proves architecture-gate.DEV1.AC3.

### Scenario: architecture-gate.DEV1.AC3.cross_model_required_same_recorded_model_blocks

Given the review gate is enabled with cross-model review required
And a new-flow feature at the implement→verify exit whose impl-plan.md carries cited evidence
And the design-review stamp records a reviewer-model tag equal to the recorded author-model tag
When the stop hook evaluates the phase exit
Then the exit is blocked because the review was not independent of the author's model

- [x] RED 1d91171
- [x] GREEN 39b0e96
- [x] REFACTOR skip: no structural change

### Scenario: architecture-gate.DEV1.AC3.cross_model_required_different_recorded_model_passes

Given the review gate is enabled with cross-model review required
And a new-flow feature at the implement→verify exit whose impl-plan.md carries cited evidence
And the design-review stamp records a reviewer-model tag different from the recorded author-model tag
When the stop hook evaluates the phase exit
Then the exit is allowed

- [x] RED 1d91171
- [x] GREEN 39b0e96
- [x] REFACTOR skip: no structural change

### Scenario: architecture-gate.DEV1.AC3.cross_model_required_author_model_unknown_blocks

Given the review gate is enabled with cross-model review required
And a new-flow feature at the implement→verify exit whose impl-plan.md carries cited evidence
And the design-review stamp records a reviewer-model tag but no author-model tag is recorded
When the stop hook evaluates the phase exit
Then the exit is blocked, failing closed rather than treating an unknown author-model as different

- [x] RED skip: coverage cell for fail-closed built on modelsMatch (be42ed2) + gate 39b0e96
- [x] GREEN 55c3c8b
- [x] REFACTOR skip: no structural change

### Scenario: architecture-gate.DEV1.AC3.cross_model_required_same_model_differing_case_blocks

Given the review gate is enabled with cross-model review required
And a new-flow feature at the implement→verify exit whose impl-plan.md carries cited evidence
And the reviewer-model and author-model tags name the same model differing only in case or surrounding whitespace
When the stop hook evaluates the phase exit
Then the exit is blocked because the tags resolve to the same model

- [x] RED be42ed2
- [x] GREEN 0b085c7
- [x] REFACTOR skip: modelsMatch is a single predicate

### Scenario: architecture-gate.DEV1.AC3.cross_model_off_same_recorded_model_passes

Given the review gate is enabled with cross-model review off (the default floor)
And a new-flow feature at the implement→verify exit whose impl-plan.md carries cited evidence
And the design-review stamp records a reviewer-model tag equal to the recorded author-model tag
When the stop hook evaluates the phase exit
Then the exit is allowed because cross-model independence is not required

- [x] RED skip: coverage cell for the off-floor built in 39b0e96
- [x] GREEN 55c3c8b
- [x] REFACTOR skip: no structural change

## Rule: Default-off — a disabled, unconfigured, or malformed-config gate never blocks

> Rationale: ships inert so an upgrade can't brick an in-flight feature; fail-safe to off on any config trouble. Proves architecture-gate.DEV2.AC1.

### Scenario: architecture-gate.DEV2.AC1.gate_disabled_allows_missing_evidence_and_stamp

Given the review gate is explicitly disabled
And a new-flow feature at the implement→verify exit whose impl-plan.md has no citation and no design-review stamp
When the stop hook evaluates the phase exit
Then the exit is allowed

- [x] RED 1d91171
- [x] GREEN 39b0e96
- [x] REFACTOR skip: no structural change

### Scenario: architecture-gate.DEV2.AC1.gate_config_absent_treated_as_disabled

Given no review-gate setting is present in config
And a new-flow feature at the implement→verify exit whose impl-plan.md has no citation and no design-review stamp
When the stop hook evaluates the phase exit
Then the exit is allowed

- [x] RED 43eaa0b
- [x] GREEN 4b24494
- [x] REFACTOR 757399b

### Scenario: architecture-gate.DEV2.AC1.gate_config_malformed_treated_as_disabled

Given the config file contains invalid JSON
And a new-flow feature at the implement→verify exit whose impl-plan.md has no citation and no design-review stamp
When the stop hook evaluates the phase exit
Then the exit is allowed, the malformed config failing safe to off

- [x] RED 43eaa0b
- [x] GREEN 4b24494
- [x] REFACTOR 757399b

## Rule: Scope — only new-flow features are gated

> Rationale: friction must match blast radius; tasks and pre-spec tickets inherit #204's exemption. The exemption must hold on both the evidence and the stamp path. Proves the AC1/AC2 boundary (exemption side).

### Scenario: architecture-gate.DEV1.AC1.task_exempt_from_gate

Given the review gate is enabled
And a task (not a feature) at the implement→verify exit with no citation and no design-review stamp
When the stop hook evaluates the phase exit
Then the exit is allowed because tasks are never gated

- [x] RED 1d91171
- [x] GREEN 39b0e96
- [x] REFACTOR skip: no structural change

### Scenario: architecture-gate.DEV1.AC2.grandfathered_feature_no_spec_exempt

Given the review gate is enabled
And a grandfathered feature with no spec.md at the implement→verify exit with no citation and no design-review stamp
When the stop hook evaluates the phase exit
Then the exit is allowed because pre-spec tickets are exempt

- [x] RED skip: coverage cell for the no-spec exemption built in 39b0e96
- [x] GREEN 55c3c8b
- [x] REFACTOR skip: no structural change
