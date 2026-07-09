# Verify — KQ3MRV (tokenizer-absorption)

## Verify Checklist

**Test Suite:** ✓ 276/276 tests pass across the 12 gate/tokenizer files, including this ticket's `review-stamp-bridge.test.ts`, `branch-staleness.test.ts`, `run-identity.test.ts`, and `codex-cursor-skill-fallback.test.ts` (real-collaborator tests exercising the migrated `parseRecordSkillInvocationCommand` / `commandInvokesWriteReviewStamp` / `parseCheckoutTarget`). Full suite ran green earlier this session at 5017/5024 on the integrated tree (same 2 unrelated env failures).
**Gherkin:** ⏭️ Skipped — no acceptance lane for this task
**Build:** ✅ Success (tsup ESM + DTS)
**Lint:** ✅ Clean (eslint + tsc --noEmit + gherkin)
**Scenarios:** ⏭️ Skipped — task ticket, no test-definitions.md
**PR Scope:** ✅ Diff matches ticket scope — `cursor-run-identity.ts` + `branch-staleness.ts` (+ byte-identical `.safeword/` mirrors) migrated onto the shared tokenizer, their test files, and this ticket. No unrelated files.
**Dep Drift:** ⏭️ Skipped — no dependency manifest changes, no ARCHITECTURE.md
**Parent Epic:** N/A
**Reconcile:** ✅ No pattern deviation — both files now import the shared `shell-segments` tokenizer exactly as `dependency-readiness.ts` does; removes two private tokenizer copies rather than adding a pattern.
**Experience:** ⏭️ N/A — internal hook plumbing, not persona-facing
**Evidence limits:** ⚠️ The two full-suite failures observed earlier (`rust-golden-path` cargo-clippy E2E, `cleanup-zombies` pgrep victim-detection) are pre-existing, unrelated, and byte-identical to base. The final full-suite re-run this session was killed after ~20 min of accumulated-machine-load slowness (the documented overload-timeout pattern, not a test failure) — the authoritative signal is the targeted 267/267 gate run plus the two clean earlier full-suite runs; CI's isolated suite is authoritative.

Audit passed — depcruise clean (no cycles; `cursor-run-identity`/`branch-staleness` → `shell-segments` add none), knip silent on the changed files, parity in sync (215 pairs / 5 contracts).

## Notes

- Fixes a real functional gap: `command`/`env`-prefixed helper invocations now record their run-identity/stamp proof (the old `executableIndexOf` skipped only `VAR=val`), so the fail-closed stamp gate no longer denies a legitimate write.
- `parseCheckoutTarget` now parses per-segment and basename-matches git (the latter added in the whole-session quality-review), fixing `git fetch && git checkout main` and `/usr/bin/git checkout main`.
- `isInvocationHelperPath` stays slash-anchored-only (deliberate, per its own doc comment).
