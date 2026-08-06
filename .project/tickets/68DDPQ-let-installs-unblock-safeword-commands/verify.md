# Verification: Let dependency installs unblock Safeword commands

## Verify Checklist

**Full suite:** ✅ `bun run test` — Retro Relay: 167 passed, 1 skipped; CLI:
6784 passed, 5 skipped. Re-ran after rebasing onto `origin/main` commit
`7414594`.
**Focused behavior tests:** ✅ `vitest run` over the five affected hook suites —
294/294 passed.
**Typecheck:** ✅ `bun run typecheck` and the full lint lane passed.
**Build:** ✅ Both packages built during the full test run.
**Lint:** ✅ `bun run lint` — ESLint, Gherkin lint, and CLI typecheck passed.
**Formatting:** ✅ `bun run format:check` — clean.
**Parity:** ✅ `bun scripts/parity-check.ts` — all 241 pairs and 8 contracts in
sync.
**Plugin release contract:** ✅ `bun run --cwd packages/cli check:claude-plugin`
— aligned at 0.73.0.
**Audit:** ✅ `bun run deps:validate` — 0 errors; the single `no-orphans`
warning for unchanged `packages/cli/src/codex-plugin/hooks.ts` predates this
branch.
**Diff hygiene:** ✅ `git diff --check` — passed.
**PR Scope:** ✅ Changes are limited to the dependency-recovery review
follow-ups: shared shell boundaries, install qualification, affected gate
regressions, shipped-hook mirrors, plugin integrity metadata, and ticket
evidence.
**Reconcile:** ✅ Canonical template and dogfood hook copies are byte-identical;
the generated Claude-plugin runtime has the expected plugin-CLI fallback and a
sealed inventory around main's unchanged CLI bundle.
**Scenarios:** ⏭️ No BDD source exists for this task ticket. Manual scenario
review found no gaps; see `review-spec.md`.
**Experience:** ⏭️ Internal PreToolUse hook behavior; no interactive product
surface changed.

## Behavior covered

- Allows a leading complete dependency install or stale-only documented
  `touch node_modules` recovery before a guarded command, exclusively over
  `&&`.
- Rejects `||`, `;`, pipes, and unquoted background `&`, so the retry cannot
  run after a failed or concurrent recovery.
- Keeps file-descriptor redirections (`2>&1`, `<&3`, and `&>log`) inside their
  command rather than mistaking them for background execution.
- Rejects report-only, lockfile-only, dry-run, partial, and no-link install
  forms before they can authorize a recovery or write a ready stamp.
- Applies the shared `&` boundary to dependency readiness, process-kill,
  ledger-write, Cursor, and architecture-stage gates.

## CI status

The updated follow-up commit has not been pushed yet. PR #1992's checks were
green on parent head `30954cc`; pushing this verified commit will start a new CI
matrix for the current draft head.

## Review status

All four PR comments were read. GitHub reports zero submitted reviews and zero
unresolved review threads. The quality-review coordinator completed after the
source review; no critical or suggested changes remain. The ticket stays **in
progress** in the verify phase and issue #1763 stays open pending the new CI
result.
