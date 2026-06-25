---
id: F20E26
slug: prevent-ticket-index-emphasis-corruption
type: task
phase: done
status: done
external_issue: https://github.com/ArcadeAI/safeword/issues/397
created: 2026-06-24T22:22:14.047Z
last_modified: 2026-06-24T23:47:19.000Z
---

# Prevent ticket index emphasis corruption

**Goal:** Prevent generated ticket indexes from being markdown-emphasis-corrupted during dogfood sessions.

**Why:** Corrupted indexes silently break ticket status tokens, readability, and grep-based discovery.

## Context

GitHub issue #397 reports `.project/tickets/INDEX.md` and `INDEX-completed.md` repeatedly reappearing with Prettier-style emphasis escaping during a session, despite `.prettierignore`. Current `origin/main` already generates ticket indexes directly from `packages/cli/src/ticket-sync/index.ts` without calling Prettier, so the pickup starts by revalidating whether the bug is still reproducible on current main and whether an out-of-tree hook/CLI fallback can still corrupt generated index content.

Related local tickets:

- `1GGD28` shipped the generated ticket index surface.
- `MF1DGA` tracks issue #398, the adjacent but separate generated-index merge-conflict problem.

## Acceptance Criteria

- [x] Reproduce or explicitly fail to reproduce the reported `in_progress` -> `in*progress` / escaped-emphasis corruption on current `origin/main`.
- [x] Identify and document the root cause, including ruled-out competing hypotheses.
- [x] Add regression coverage for the confirmed failure mode.
- [x] Implement the smallest fix that prevents index corruption.
- [x] Verify targeted tests and the relevant ticket-index command path pass.

## Root Cause

Generated ticket indexes render user-authored ticket titles and goals as ordinary Markdown inside list items, while also wrapping the title/reference in `**...**`. If a Markdown formatter touches the generated index, unbalanced or literal emphasis markers in that generated content can be reparsed and normalized by Prettier, producing the observed corruption such as `in_progress` -> `in*progress`, `\_draft*`, or escaped `\*\*survive`.

Confirmed by forcing Prettier over a copy of the current `origin/main` generated `INDEX.md`, which reproduced the same corruption signature from GitHub issue #397. Current source `sync-tickets` does not call Prettier, and current `.prettierignore` plus the PostTool lint hook do skip the real index paths, so the immediate current-tree command path is clean. The remaining bug is that the generated artifact is formatter-fragile: any out-of-tree CLI, editor integration, old hook, or direct formatter call that bypasses ignore state can corrupt it.

Ruled out:

- Current `sync-tickets` generation as the corruptor: `bun packages/cli/src/cli.ts sync-tickets --quiet` regenerated clean indexes with no `in*progress` / escaped-emphasis diff.
- Current PostTool lint hook as the corruptor: invoking `.safeword/hooks/post-tool-lint.ts` against the real index path produced no corruption because Prettier saw the current ignore paths.
- Escaping every dynamic string as the best fix: a quick forced-format test showed it is noisy and Prettier still normalizes escaped underscores in generated list text.

Figure-it-out decision: use Prettier's documented generated-content range ignore (`<!-- prettier-ignore-start -->` / `<!-- prettier-ignore-end -->`) around the dynamic index body. It is smaller than full Markdown escaping, preserves the readable grep surface, and makes the generated file self-protecting even when a formatter is run directly on the file.

## Work Log

- 2026-06-24T22:22:14.047Z Started: Created ticket F20E26
- 2026-06-24T22:25:00Z Pickup: Synced worktree to `origin/main` (`5df87329`), created branch `codex/397-ticket-index-corruption`, read GitHub issue #397, and confirmed no existing local ticket linked to #397.
- 2026-06-24T22:29:00Z Implemented: Added Prettier range-ignore markers around generated ticket index bodies and regression coverage proving `prettier.format(..., { parser: 'markdown' })` is a no-op for risky generated content. Verified forced Prettier on copies of both real index files is now diff-free.
- 2026-06-24T22:35:00Z Quality-review: APPROVE. Prettier docs verify range ignore is intended for top-level generated Markdown and requires surrounding blank lines; implementation satisfies that. Prettier is current at 3.8.4 and OSV returned no advisory for `prettier@3.8.4`. `bun audit` found unrelated pre-existing low/moderate advisories outside this diff.
- 2026-06-24T23:18:00Z Verify: Wrote verify.md. Targeted ticket-sync tests, lint, BDD lane, safeword check, forced-Prettier copy checks, and PostTool lint hook check passed. Full `bun run test` was polluted by concurrent test runs in other worktrees and failed only `tests/test-runner-lock.test.ts`; isolated rerun of that file passed. Leaving ticket in progress pending a clean full-suite rerun or maintainer acceptance of the isolated-rerun evidence.
- 2026-06-24T23:47:19Z Done: After clearing stale external safeword runners and safeword temp fixtures, a clean `bun run test` passed: 248 test files, 3631 tests passed, 3 skipped. Marked F20E26 done.
