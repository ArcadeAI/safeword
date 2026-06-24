# User Stories: Normalize hook run identity

## Story 1: Keep hook state tied to the correct agent run

As a Safeword Maintainer,
I want hook state to use a normalized run identity across Claude, Codex, and Cursor,
so that quality gates, re-entry notes, and self-reports stay attached to the right run.

### Acceptance Criteria

#### WHFTDK.SM1.AC1 - Runtime-specific identities normalize to one contract

Given a hook input from Claude, Codex, or Cursor
When safeword resolves the run identity
Then it returns the runtime, a durable session key when available, an optional turn key, and the id source.

#### WHFTDK.SM1.AC2 - Runtime storage keys do not collide

Given two runtimes report the same raw id
When safeword computes storage keys
Then those keys remain distinct by runtime.

#### WHFTDK.SM1.AC3 - Proof writers do not invent fake sessions

Given no runtime identity is available
When safeword records a skill invocation or review stamp
Then it skips or fails visibly instead of writing `unknown-session`.

## Story 2: Preserve existing Claude quality state

As a Technical Builder,
I want existing Claude quality state to remain readable after the hook identity change,
so that upgrading safeword does not lose guardrail context mid-project.

### Acceptance Criteria

#### WHFTDK.TB1.AC1 - Legacy Claude state remains readable

Given a project has `quality-state-<session>.json`
When safeword reads state for that Claude session
Then it loads the legacy file if the new runtime-scoped file is absent.

#### WHFTDK.TB1.AC2 - Non-Claude state does not overwrite Claude state

Given Codex or Cursor reports the same raw id as a Claude session
When safeword writes new quality state
Then it writes to a runtime-scoped file that does not overwrite Claude state.
