---
id: 54XH90
slug: lint-config-unify
type: task
phase: intake
status: open
created: 2026-05-26T05:35:46.592Z
last_modified: 2026-05-26T05:35:46.592Z
parent_pr: 160
scope:
  - Make `bun run lint` from `packages/cli/` produce identical results to CI's `eslint . && bun run --cwd packages/cli typecheck` from repo root
  - Point packages/cli's lint script at the root config (or vice versa — pick one canonical path)
  - Decide per-error fate of the 3 currently-divergent rule hits — fix the site or relax/retire the rule
  - Pre-commit hook should run the same lint invocation as CI
out_of_scope:
  - Refactoring the safeword preset's `detect()` machinery — it does real work adapting rules per detected language. The fix is "make local invoke the same path as CI," not "rip out auto-detect"
  - Changing the underlying rule set (security/detect-unsafe-regex, unicorn/consistent-function-scoping etc.) globally — touch only the 3 specific divergent sites
  - Migrating to a different lint runner
done_when:
  - `bun run lint` from packages/cli/ matches CI lint output byte-for-byte on a clean tree
  - The 3 sites either pass (fixed) or are explicitly disabled with comment justifying why
  - Pre-commit hook references the canonical lint invocation
  - PR #160 followup section in changelog notes the convergence
---

# lint-config-unify

**Goal:** Eliminate the local-vs-CI eslint config drift so devs don't ship code that passes locally then fails CI (or vice versa).

**Why:** PR #160 hit both failure modes in one session:

- Local `bun run lint` (from `packages/cli/`) flagged 3 errors CI ignored: `tests/integration/re-entry-concurrent.test.ts:99` and `tests/integration/re-entry-stop.test.ts:126` (`security/detect-unsafe-regex`), `tests/schema.test.ts:103` (`unicorn/consistent-function-scoping`).
- CI caught a missing `TIMEOUT_SYNC` export local missed — typecheck step ran in CI but local targeted vitest skipped it.

Root cause: root `package.json` lint = `eslint . && bun run --cwd packages/cli typecheck`; cli `package.json` lint = `eslint src tests && tsc --noEmit`. Same preset but different invocation paths produce different rule sets (preset uses runtime `detect()` based on cwd).

## Concrete divergences observed (PR #160)

| Site                                                                    | Rule                                  | Local       | CI                |
| ----------------------------------------------------------------------- | ------------------------------------- | ----------- | ----------------- |
| `re-entry-concurrent.test.ts:99`                                        | `security/detect-unsafe-regex`        | error       | not flagged       |
| `re-entry-stop.test.ts:126`                                             | `security/detect-unsafe-regex`        | error       | not flagged       |
| `schema.test.ts:103`                                                    | `unicorn/consistent-function-scoping` | error       | not flagged       |
| `cross-branch-tickets.test.ts:26` (import of unexported `TIMEOUT_SYNC`) | `TS2459`                              | not flagged | error (typecheck) |

## Work Log

- 2026-05-26T05:35:46.592Z Started: Created ticket 54XH90 — follow-up to PR #160 [ticket-folder-legibility](../CXXB3P-ticket-folder-legibility/ticket.md).
