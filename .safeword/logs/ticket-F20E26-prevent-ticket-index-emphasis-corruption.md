# Work Log: Prevent Ticket Index Emphasis Corruption

**Anchored to:** `.project/tickets/F20E26-prevent-ticket-index-emphasis-corruption/ticket.md`

---

## Session: 2026-06-24

- [22:25] Started from `origin/main` at `5df87329` on branch `codex/397-ticket-index-corruption`.
- [22:25] GitHub issue #397 says Prettier can produce the exact corruption, but current tree-local `ticket-sync` does not call Prettier.
- [22:26] Initial hypotheses: (1) current generator emits unescaped markdown that Prettier corrupts when some hook formats the index; (2) a version-skewed hook still falls back to an out-of-tree CLI that formats generated indexes; (3) current generator already protects enough and #397 is obsolete on main.
- [22:27] Revalidated: `sync-tickets --quiet` regenerated cleanly; invoking the current PostTool lint hook on the real index path did not corrupt because `.prettierignore` is honored.
- [22:27] Reproduced the formatter-fragile artifact: forcing Prettier over a copy of `INDEX.md` still produced `in_progress` -> `in*progress`, `\_draft*`, and escaped `\*\*survive`.
- [22:28] Figure-it-out: picked generated-content range ignore over status/title escaping. Prettier docs explicitly support `prettier-ignore-start/end` for top-level generated content; a copy test proved it makes forced Prettier byte-stable.
- [22:29] RED: added `generated_index_is_stable_when_markdown_formatter_runs`; it failed before production changes because no range-ignore markers existed.
- [22:29] GREEN: wrapped generated index bodies with `<!-- prettier-ignore-start -->` / `<!-- prettier-ignore-end -->`. Focused regression and full `tests/ticket-sync/ticket-sync.test.ts` passed.
- [22:30] Runtime verification: forced Prettier on copies of regenerated `INDEX.md` and `INDEX-completed.md` produced no diff; PostTool lint hook on real `INDEX.md` stayed clean.
- [22:35] Quality-review: APPROVE. Docs/version/security checked: Prettier range-ignore docs match this use; npm registry latest and installed Prettier are both 3.8.4; OSV query for prettier@3.8.4 returned no advisories. `bun audit` reports unrelated existing low/moderate advisories in @babel/core, dompurify, js-yaml, and markdown-it.
- [23:18] Verify: lint + BDD + targeted reruns passed. Full `bun run test` completed with one lock-test failure caused by concurrent safeword test runs in other worktrees (`Waiting for another safeword package test run to finish...` on stderr). Isolated rerun of `tests/test-runner-lock.test.ts` passed. Wrote `verify.md` with next action to rerun the full suite once the external runners clear.
- [23:47] Final verification: after clearing stale external safeword runners and safeword temp fixtures, `bun run test` passed cleanly: 248 test files, 3631 tests passed, 3 skipped. Marked F20E26 done.
