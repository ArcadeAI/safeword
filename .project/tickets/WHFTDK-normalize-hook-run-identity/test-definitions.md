# Test Definitions: Normalize hook run identity

No `.feature` file: the executable proof is Vitest over hook identity helpers and hook-side state/log effects. Scenarios are non-vacuous only if the assertion fails when a runtime-specific id is ignored, misclassified, or collapsed into `unknown-session`.

## Rule: Runtime inputs normalize to a shared identity contract

### Scenario: normalize-hook-run-identity.SM1.AC1.claude_session_id_normalizes

Given a Claude hook input with `session_id`
When safeword resolves the run identity
Then the identity is runtime `claude` with a durable session key and no turn key

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Scenario: normalize-hook-run-identity.SM1.AC1.codex_session_and_turn_normalize

Given a Codex hook input with `session_id` and `turn_id`
When safeword resolves the run identity
Then the identity is runtime `codex` with a durable session key and a turn key

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Scenario: normalize-hook-run-identity.SM1.AC1.cursor_conversation_and_generation_normalize

Given a Cursor hook input with `conversation_id` and `generation_id`
When safeword resolves the run identity
Then the identity is runtime `cursor` with a durable session key and a turn key

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Scenario: normalize-hook-run-identity.SM1.AC2.same_raw_id_differs_by_runtime

Given Claude, Codex, and Cursor each report the same raw id value
When safeword computes their storage keys
Then each runtime receives a distinct storage key

- [x] RED
- [x] GREEN
- [x] REFACTOR

## Rule: Existing Claude state remains readable while new state is runtime-scoped

### Scenario: normalize-hook-run-identity.TB1.AC1.quality_state_reads_legacy_claude_state

Given a pre-existing `quality-state-<session>.json` file from Claude
When safeword reads session quality state for that Claude session
Then it returns the legacy state instead of treating the run as empty

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Scenario: normalize-hook-run-identity.TB1.AC2.codex_quality_state_uses_runtime_scoped_storage

Given a Codex run with the same raw id as a Claude run
When safeword records a quality failure for the Codex run
Then the Codex state file does not overwrite the Claude state file

- [x] RED
- [x] GREEN
- [x] REFACTOR

## Rule: Proof writers never invent an unknown session

### Scenario: normalize-hook-run-identity.SM1.AC3.skill_invocation_without_identity_skips_without_unknown_session

Given a skill invocation is recorded outside a runtime with no session env vars
When safeword records the invocation
Then it skips the proof write and no `unknown-session` proof appears

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Scenario: normalize-hook-run-identity.SM1.AC3.review_stamp_without_identity_fails_visibly

Given review stamp writing runs outside a runtime with no session env vars
When safeword writes the review stamp
Then it fails with an explicit missing-identity message instead of writing `unknown-session`

- [x] RED
- [x] GREEN
- [x] REFACTOR

## Cross-Scenario Checks

- Runtime-specific ids are normalized once through a shared helper instead of reimplemented in each hook.
- New template files are registered in `packages/cli/src/schema.ts`.
- Dogfood copies under `.safeword/` match the template behavior.
