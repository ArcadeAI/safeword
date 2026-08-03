# Quality Review — Keep stop reviews quiet until a new user prompt

## Review plan

1. Confirm the lifecycle assumption: a submitted user prompt is a reliable boundary before the next assistant turn, while Stop runs when the assistant finishes.
2. Check that the session marker cannot suppress hard verification behavior.
3. Check the two hook entry points through their installed, real filesystem collaborators rather than internal mocks.

## Quality Review

**Currency:** ✓ No dependency or version change. Claude's current hook reference documents `UserPromptSubmit` as running when a prompt is submitted and `Stop` as running when Claude finishes responding.

**Sources:** ✓ The lifecycle boundary used by the implementation is supported by the official Claude Code hooks reference.

**Correct:** ✓ A generic review writes a session marker; a later Stop is silent until `prompt-questions` clears it. The done-phase gate remains outside the suppression path.

**Elegant:** ✓ One optional state field and two small hook-local transitions reuse the existing quality-state storage and tolerant write behavior.

**No-bloat:** ✓ The malformed-transcript fallback, `stop_hook_active` guard, and existing artifact gates are untouched.

**Wiring:** ✓ `stop-hook-transcript-format.test.ts` runs the installed Stop hook through a real transcript and state file. `hooks.test.ts` runs the installed UserPromptSubmit hook through its real state file.

**Verdict:** APPROVE

**Critical issues:** None

**Suggested improvements:** None

**Provenance:**

- (verified: https://code.claude.com/docs/en/hooks) — current hook lifecycle and event timing fetched this session.

**Next:** Run the complete Safeword verification plan and record its evidence.
