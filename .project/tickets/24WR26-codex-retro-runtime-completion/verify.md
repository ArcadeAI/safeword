## Verify Checklist

**Test Suite:** ⚠️ Focused issue suite passes 66/66 (`bun run test tests/hooks/retro-trigger-codex.test.ts tests/integration/codex-stop-retro.test.ts tests/hooks/retro-extract.test.ts tests/hooks/retro-debug.test.ts tests/commands/retro.test.ts`); full `bun run test` has 2 unrelated isolated failures
**Gherkin:** ✅ 340 passed, 3 skipped (`cucumber-js --tags 'not @wip'` via full verify block)
**Build:** ✅ Success (targeted test wrapper rebuilt `packages/cli/dist` with `tsup`)
**Lint:** ✅ Clean (`bun run lint`; `git diff --check`)
**Scenarios:** ⏭️ Skipped — task ticket has no `test-definitions.md`
**PR Scope:** ✅ Diff matches ticket scope
**Dep Drift:** ✅ Clean — no runtime dependency changes; Knip clean after marking `shellcheck` as an intentional external binary
**Parent Epic:** N/A
**Reconcile:** ✅ Template/dogfood hook copies match for touched files
**Experience:** ⏭️ N/A — internal hook diagnostics
**Evidence limits:** ⚠️ Full suite currently fails outside this PR's scope: Rust clippy workspace-member scenario and cleanup-zombies preview/--yes scenario both reproduce when run alone

## Notes

- `bun run lint` passed, including ESLint, Gherkin lint, and `packages/cli` typecheck.
- `bun run test tests/schema.test.ts -t "should have entry for every template file"` passed.
- Real Codex Desktop Stop capture passed through the trigger and child boundary: `codex_stop_retro_decision` was `outcome: run`, `retro_cli_extraction` reported `failureReason: spawn_nonzero` / `exitCode: 1`, `codex_stop_child_exit` reported `status: 1` and `pendingOffsetState: true`, and no offset-state file was written because the child failed.
- Re-ran the focused retro suite, `bun run typecheck`, `bun run lint:eslint`, and `git diff --check` after removing the temporary capture switch.
- Captured the nested extractor stderr with the exact helper argv: Codex refused the neutral temp cwd because `--skip-git-repo-check` was missing.
- Replayed the same real transcript after adding `--skip-git-repo-check`; `retro_cli_extraction` returned `ok:true` and the retro command exited 0.
- `bun run test tests/hooks/retro-extract.test.ts` passed after pinning the Codex argv flag.
- `bun run test tests/schema.test.ts -t "should have entry for every template file"` passed after final cleanup.
- `/verify` run proof was unavailable in this Codex shell (`no run identity`); this is a task ticket and is not being marked done.
- Full audit rerun passed config sync, dependency-cruiser, and Knip after adding `shellcheck` to the intentional external binaries. It still reports baseline jscpd duplication and `knip` 6.25.0 patch freshness.
- Quality-review improvement: added direct unit coverage for `recordRetroDebugEvent` redaction and fail-open behavior.
- Refactor improvement: extracted shared `readJsonlFile` test helper for diagnostics JSONL parsing.
- Full verify attempt: `bun run test` ran 4,999 tests with 4,992 passed, 5 skipped, and 2 unrelated failures; BDD then passed 343 scenarios (340 passed, 3 skipped), and typecheck passed.
- Isolated reruns confirmed the two full-suite failures reproduce outside the retro changes:
  - `bun run test tests/integration/rust-golden-path.test.ts -t "lint hook runs cargo clippy with -p <package> for workspace member"` fails expecting Clippy to rewrite `"l"` to `'l'`.
  - `bun run test tests/scripts/cleanup-zombies.test.ts -t "the victim survives a bare preview and dies under --yes"` fails because preview finds no matching process.
