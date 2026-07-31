# Refactor Pass 9 Ledger — Keep stop reviews quiet until a new user prompt

Scout scope: the PR #1652 delta after rebasing onto `origin/main` at `ee8473d56`, with emphasis on the new Stop-hook integration fixture helper.

1. [x] **Fixture process plumbing — leaf first:** replaced the `spawnSync`/environment/timeout reimplementation in `packages/cli/tests/helpers/stop-hook.ts` with the established `spawnHookScript` helper from `packages/cli/tests/helpers.ts`. Stop and prompt input payloads remain at their call sites. The real idle-review and frozen-transcript hook suites pass 17/17.
2. [deferred] **Template/dogfood hook copies:** do not consolidate `.safeword/hooks/` and `packages/cli/templates/hooks/`. They are deliberately mirrored installation artifacts and the parity contract validates them as separate copies.
3. [deferred] **Cross-hook state writes:** do not extract a common read-modify-write abstraction for `stop-quality` and `prompt-questions`. They run independently across lifecycle boundaries; their explicit failure handling makes the concurrency and recovery behavior reviewable.
4. [deferred] **Transcript writers:** retain the hand-crafted no-edit and frozen real-format transcripts in their owning suite. They encode distinct boundary and format semantics, not generic fixture mechanics.

Verification for entry 1: run the idle-review and frozen-transcript real-hook suites, typecheck, lint, parity, and the final audit. Commit only after the scoped suite passes.
