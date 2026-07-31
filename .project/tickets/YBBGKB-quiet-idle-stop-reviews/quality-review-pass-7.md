# Quality Review — YBBGKB Full Pass (Pass 7)

Review plan: verify the Stop/UserPromptSubmit lifecycle against the current Claude Code hooks reference; verify the synchronous state-file APIs against current Node documentation; inspect the marker's independent hard-gate ordering and its installed-hook tests; and check the current PR status and review threads.

## Quality Review

**Currency:** ✓ Current. Claude Code still fires `UserPromptSubmit` before processing a submitted prompt and `Stop` when the agent has finished responding. Node v26.5.1 still documents the synchronous filesystem APIs used for the best-effort state write.

**Sources:** ✓ The lifecycle and API claims are backed by current primary documentation. Current-head CI run 30505649629 passed every required check.

**Correct:** ✓ The marker is consulted only in the no-ticket generic-review branch, after hard artifact/done gates and the implement typecheck advisory. A real `UserPromptSubmit` clears it before prompt guidance is derived; malformed optional state remains fail-conservative and cannot leave the session quiet solely because later reminder derivation fails.

**Elegant:** ✓ The marker has one narrowly named persisted field and two explicit lifecycle transitions. Keeping read-modify-write behavior local to each hook is intentional: independently running hooks must not hide a shared race-prone mutation helper.

**No-bloat:** ✓ No production refactor is justified. The only actionable drift was documentation/PR metadata, which now describes the one-review-per-user-prompt behavior and current CI state.

**Wiring (code only):** ✓ `packages/cli/tests/integration/stop-hook-idle-review.test.ts` invokes the real installed Stop and UserPromptSubmit hooks with real transcripts and state files. `hooks.test.ts` additionally proves recovery after malformed reminder state using the installed prompt hook.

**Verdict:** APPROVE

**Critical issues:** None.

**Suggested improvements:** Completed: describe the generic-review consumption boundary in `ARCHITECTURE.md`, and replace PR #1652's stale “queued” wording for CI run 30505649629.

**Provenance:**

- (verified: [Claude Code hooks reference](https://code.claude.com/docs/en/hooks)) — fetched 2026-07-30; confirms UserPromptSubmit and Stop timing, `stop_hook_active`, and Stop decision behavior.
- (verified: [Node file-system documentation](https://nodejs.org/api/fs.html)) — fetched 2026-07-30; confirms `readFileSync` and `writeFileSync` remain supported.
- (verified: [CI run 30505649629](https://github.com/ArcadeAI/safeword/actions/runs/30505649629)) — fetched 2026-07-30; Dogfood parity, lint, Node 22, and Node 24 passed on `17e8f28c2`.

**Next:** Commit the documentation correction on `agent/quiet-idle-stop-reviews`, push it to PR #1652, and leave YBBGKB in `verify` pending delivery approval.
