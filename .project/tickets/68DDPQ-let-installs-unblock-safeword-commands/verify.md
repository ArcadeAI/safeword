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

✅ **Green on head `08ea3f9`** — [run 31129263333](https://github.com/ArcadeAI/safeword/actions/runs/31129263333): test on node 24.18.1 and 22.23.2, lint, dogfood parity, and retro relay deployment inputs all pass; Deploy Retro Relay correctly skips outside a `main` push. That run also covered the acceptance (cucumber) and release-gate lanes, and the Claude plugin catalogue freshness gate — the check that rejects a runtime bundle built with an unpinned Bun.

Pushes to this branch stopped creating `pull_request` runs (two pushes, zero runs created), so the matrix was dispatched manually. Checks attach by head SHA, so they appear on PR #1992 regardless. Root cause of the missing push trigger is unknown; the next push here may need the same manual dispatch.

## Review status

Every PR comment was read. GitHub reports zero submitted reviews and zero
unresolved review threads; no critical or suggested changes remain. Round 2's
two critical defects and the follow-up type error are all fixed with regression
pins.

The ticket is **done**: verification is satisfied by a full green CI matrix on
the current head, which was the last outstanding item. Issue #1763 stays open
until PR #1992 merges.
