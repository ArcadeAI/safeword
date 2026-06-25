# Work Log: Auto-Upgrade under Codex

**Anchored to:** `.project/tickets/7R1D3B-auto-upgrade-codex/ticket.md`

---

## Session: 2026-06-24

- [18:00] Started implementation after figure-it-out and quality-review. Corrected stale ticket context: Codex already has a SessionStart context hook, so auto-upgrade must be sequenced through one dispatcher instead of a parallel hook.
- [18:00] Created branch `codex/issue-393-codex-auto-upgrade`.
- [18:00] Added required ticket intake fields, spec JTBDs, dimensions, feature source, test definitions, and implementation plan for the dispatcher/core/rollback slice.
- [18:06] RED confirmed: focused tests failed because the shared core did not exist and Codex config still pointed directly at `session-safeword-context.ts`.
- [18:12] GREEN: focused mapper/rollback/setup tests passed after extracting `hooks/lib/auto-upgrade.ts`, replacing the Claude script with a wrapper, and adding `session-codex-start.ts`.
- [18:13] Dogfood upgrade copied the new `.safeword` hook files but exited 1 on pre-existing `feature-ticket-readiness` Gherkin lineage warnings. Added the local `.codex/config.toml` dispatcher block directly because the file had no managed SessionStart block to rewrite.
- [18:23] Verification: focused regression set passed; typecheck passed; ESLint passed on touched source/tests; new feature file passed targeted Gherkin lint; `test:smoke:fast` passed (51 files, 667 tests). Full `bun run test` was attempted, exposed the schema/dispatcher issues that were fixed, then hung in the integration tail and was stopped with Ctrl-C.

## Session: 2026-06-25

- [04:29] Stashed uncommitted #393 work, fetched `origin/main`, rebased the committed #427 fix, and reapplied the #393 stash with no conflicts.
- [04:38] Rebase verification exposed an order-dependent dispatcher failure: after `session-safeword-context.ts` ran as an executable, Bun reported its named exports missing when `session-codex-start.ts` imported it. Extracted the shared SAFEWORD.md context helpers into `hooks/lib/safeword-context.ts` and updated both executable hooks to import the lib.
- [04:43] Verification after the fix: focused #393 set passed (6 files, 109 tests), `bun run --cwd packages/cli typecheck` passed, `bun run lint:gherkin` passed, and `bun run test:smoke:fast` passed (51 files, 667 tests).
- [04:46] Reran dogfood `safeword upgrade` on the caught-up base to sync `.safeword/version` to v0.57.0; it exited 0 while reporting the pre-existing `feature-ticket-readiness` lineage warnings. Dispatcher smoke after the sync passed (`bun run test tests/integration/hooks.test.ts -t "session-codex-start"`).
