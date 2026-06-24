# User Stories: Codex Skill Invocation Proof (Issue #372)

Related issue: https://github.com/ArcadeAI/safeword/issues/372

## Story 1: Record Skill Proof In Codex

As a developer using Safeword in Codex,
I want gated skills such as `/quality-review` to record proof using Codex's session identity,
so that done-gate requirements can be satisfied when I actually invoke the required skill.

Acceptance criteria:

- Given `CLAUDE_SESSION_ID` and `CLAUDE_CODE_SESSION_ID` are absent
- And `CODEX_THREAD_ID` is present
- When `record-skill-invocation.ts` runs without an explicit session id argument
- Then it writes a `skill-invocations.log` entry using `CODEX_THREAD_ID`
- And it prints the normal success message

## Story 2: Preserve Fail-Closed Behavior Without Any Compatible Session

As a developer in a runtime that does not expose a compatible session identity,
I want Safeword to keep failing closed for done-gate proof,
so that it never silently records skill proof against an empty or ambient session.

Acceptance criteria:

- Given Claude session variables and `CODEX_THREAD_ID` are absent
- When `record-skill-invocation.ts` runs without an explicit session id argument
- Then it exits successfully with a clear no-session message
- And it does not write `skill-invocations.log`

## Root Cause

`record-skill-invocation.ts` derives session proof only from `CLAUDE_SESSION_ID` or `CLAUDE_CODE_SESSION_ID`. In Codex, the current runtime exposes `CODEX_THREAD_ID` instead, so the helper receives an empty session argument, ignores the available Codex identity, and prints `no session id — skipped`.

Confirmed by inspecting the live Codex environment variable names and the helper's `ENV_SESSION_ID` definition.

Ruled out:

- The fallback command itself is missing: the quality-review skill includes the fallback command.
- The helper cannot support env-derived sessions: it already does for Claude Code remote containers via `CLAUDE_CODE_SESSION_ID`.
- The done-gate parser requires a Claude-specific session format: `checkSkillInvocations()` compares opaque whitespace-delimited session tokens, so `CODEX_THREAD_ID` is structurally valid.
