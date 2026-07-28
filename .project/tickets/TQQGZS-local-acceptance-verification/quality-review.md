# Quality Review — 2026-07-28

## Pass 1

**Currency:** ✓ No dependencies or runtime versions changed. The new command uses the repository's existing Bun script runner.

**Sources:** ✓ Bun documents `bun run <script>` as execution of named `package.json` shell commands.

**Correct:** ✓ The command runs the existing unit lane before the existing acceptance lane and short-circuits on a failing unit command.

**Elegant:** ⚠ The contract test should also prove that the two named scripts it composes are present.

**No-bloat:** ✓ One root script and a small contract test are the smallest scoped change.

**Wiring:** ✓ `packages/cli/tests/local-test-contract.test.ts` reads the real root manifest and README. It intentionally does not spawn `test:all`, because that would recursively invoke the Vitest suite containing the test itself.

**Verdict:** REQUEST CHANGES

**Critical issues:** None.

**Suggested improvements:**

1. Assert that the root `test` and `test:bdd` scripts exist, so `test:all` cannot silently lose one of its named collaborators.
2. Match the documented commands by content rather than their exact alignment spaces, so a harmless Markdown reformat does not fail the contract test.

**Provenance:**

- (verified: https://bun.sh/docs/runtime) — fetched this session; `bun run <script>` executes named `package.json` shell commands.
- (verified: `.github/workflows/ci.yml`) — the current CI runs the existing unit and Cucumber lanes separately and in that order.

**Next:** Apply the two listed test refactors, then re-review and run the complete validation set.
