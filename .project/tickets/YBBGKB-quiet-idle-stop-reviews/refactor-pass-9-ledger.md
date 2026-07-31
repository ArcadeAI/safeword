# Refactor Pass 9 Ledger — Keep stop reviews quiet until a new user prompt

Scout scope: the PR #1652 delta after rebasing onto `origin/main` at `ee8473d56`, with emphasis on the new Stop-hook integration fixture helper.

1. [planned] **Fixture process plumbing — leaf first:** replace the `spawnSync`/environment/timeout reimplementation in `packages/cli/tests/helpers/stop-hook.ts` with the established `spawnHookScript` helper from `packages/cli/tests/helpers.ts`. Keep the Stop and prompt input payloads at their call sites. This is a test-only, behavior-preserving consolidation; the real installed-hook suites provide the safety net.
2. [deferred] **Template/dogfood hook copies:** do not consolidate `.safeword/hooks/` and `packages/cli/templates/hooks/`. They are deliberately mirrored installation artifacts and the parity contract validates them as separate copies.
3. [deferred] **Cross-hook state writes:** do not extract a common read-modify-write abstraction for `stop-quality` and `prompt-questions`. They run independently across lifecycle boundaries; their explicit failure handling makes the concurrency and recovery behavior reviewable.
4. [deferred] **Transcript writers:** retain the hand-crafted no-edit and frozen real-format transcripts in their owning suite. They encode distinct boundary and format semantics, not generic fixture mechanics.

Verification for entry 1: run the idle-review and frozen-transcript real-hook suites, typecheck, lint, parity, and the final audit. Commit only after the scoped suite passes.
