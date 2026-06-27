# Verify — namespace-prompt-default-yes (AV3PYY)

## Verify Checklist

**Test Suite:** ✓ namespace-migration unit 17/17 + integration 14/14 + install-upgrade 10/10 + done-gate lane green
**Gherkin:** ✅ Acceptance lane passes (69 scenarios / 741 steps)
**Build:** ⏭️ Skipped — no build step
**Lint:** ✅ Clean (eslint 0 errors after switching the sentinel to `undefined` per `unicorn/no-null`)
**Scenarios:** ⏭️ Skipped — task, no test-definitions.md
**Dep Drift:** ✅ Clean — no dependency changes
**Parent Epic:** K6CAJN
**Reconcile:** Aligns the code with `resolveMigrationConsent`'s existing doc comment ("interactive TTY → prompt defaulting to yes"), which the No-default had silently contradicted

## What was verified

- **`promptNoDefault` → `promptYesDefault`** (its only caller is the migration
  prompt). Enter/empty now **accepts**; an explicit `n…`/`N…` declines; the
  prompt string is `[Y/n]`.
- **EOF/close still declines** — distinguished from Enter via an `undefined`
  sentinel raced against `rl.question`. So a _deliberate_ Enter is required to
  migrate; a dead/closed stream never auto-migrates (preserves the nodejs#53497
  anti-hang fix and softens the issue-#227 risk).
- **Tests updated to characterize the new default** — "Enter accepts (default
  yes)", added "N declines", EOF still declines.

## Decision record

This consciously reverts part of **issue #227**'s safety choice: the No-default
existed because agentic environments auto-press Enter, so Yes-default lets an
agent migrate without explicit consent. The user was shown this tradeoff
(2026-06-24) and chose **Yes** for non-technical-user convenience. Mitigation
retained: EOF/closed-stream declines, so only an interactive, deliberate Enter
accepts.

Ready to mark done.
