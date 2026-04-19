# Test Definitions — Ticket 121

## Rule: SCENARIOS.md describes the full pipeline with concrete example

> Rationale: The skill file is the only surface the agent sees at Phase 3. If the pipeline steps, example, or exit criteria are missing, the agent regresses to intuition-driven drafting.

- [x] SCENARIOS.md lists the 5-step pipeline (derive, partition, generate, organize, present)
- [x] SCENARIOS.md contains a concrete turn example showing dimensions + partitions + rules
- [x] SCENARIOS.md names both saturation checks (scenario saturation in Phase 3, coverage saturation in Phase 4)
- [x] SCENARIOS.md Phase 4 section includes an adversarial pass after AODI validation
- [x] SCENARIOS.md test-definitions format uses blockquote rationale, not HTML comments

## Rule: Phase gate blocks scenario writing during intake

> Rationale: Scenarios written during intake reflect unrefined understanding; the gate forces a conscious transition into `define-behavior` before scenarios are materialized.

- [x] PreToolUse denies creating test-definitions.md when ticket phase is `intake` (quality-gates.test.ts 9.6)
- [x] PreToolUse allows creating test-definitions.md when ticket phase is past intake (quality-gates.test.ts 9.3, 9.8)
- [x] PreToolUse bypasses the gate for non-ticket files (META_PATHS exemption, quality-gates.test.ts 9.10)

## Rule: Dimension artifact gate enforces systematic scenario derivation for features

> Rationale: Without dimensions.md, scenario coverage is ad-hoc. The gate is type-aware — tasks don't need it because tasks are single-step TDD, not multi-scenario features.

- [x] PreToolUse denies creating test-definitions.md for a feature without dimensions.md (quality-gates.test.ts 9.7)
- [x] PreToolUse allows creating test-definitions.md for a feature with dimensions.md present (quality-gates.test.ts 9.8)
- [x] PreToolUse allows creating test-definitions.md for a task without dimensions.md (quality-gates.test.ts 9.9)

## Rule: Stop-quality hook enforces GFM checkbox format

> Rationale: Mixed or obsolete checkbox formats silently escape the progress check — a file looks "done" while scenarios are unchecked. Hard-blocking unrecognized formats forces conversion to GFM.

- [x] `isUnrecognizedScenarioFormat` returns true for prose content without checkboxes (scenario-format.test.ts)
- [x] `isUnrecognizedScenarioFormat` returns false when any GFM checkbox is present (scenario-format.test.ts)
- [x] `countGfmCheckboxes` counts `- [x]`, `- [X]`, and indented boxes correctly (scenario-format.test.ts)
- [x] stop-quality allows features with all `- [x]` checkboxes (hooks.test.ts T8)
- [x] stop-quality blocks features with any `- [ ]` unchecked (hooks.test.ts T7)
- [x] stop-quality blocks features with content but no recognized checkboxes (hooks.test.ts T9 — via cumulative-artifact gate; unit test above covers the GFM-specific contract)

## Rule: Hook changes stay in sync with shipping templates

> Rationale: `.safeword/hooks/` runs live in this repo; `packages/cli/templates/hooks/` is what ships to customers via `safeword upgrade`. Drift means customers get stale behavior.

- [x] pre-tool-quality.ts is byte-equal between .safeword/hooks/ and packages/cli/templates/hooks/
- [x] stop-quality.ts is byte-equal between .safeword/hooks/ and packages/cli/templates/hooks/
