## Verify Checklist

**Test Suite:** ✓ 11629/11629 tests pass in the first full local CLI suite; 198 retro-relay and 153 retro-collector tests also pass.
**Gherkin:** ✅ Acceptance lane passes in the Node 24 CI job on commit 4424cd53c.
**Build:** ✅ Success — CLI and website builds, plus both container build stages.
**Lint:** ✅ Clean — ESLint, Gherkin lint, and Markdown lint.
**Typecheck:** ✅ Clean.
**Scenarios:** All 0 scenarios marked complete — task has no separate test-definitions file.
**Refactor:** ✅ No change warranted — changed source is dependency declarations, generated bundles, and compatibility tests.
**PR Scope:** ✅ Diff matches ticket scope — dependency remediation is separate from the explain prompt PR.
**Dep Drift:** ✅ Clean — updated packages are development tooling, with no new runtime architecture dependency.
**Parent Epic:** N/A.
**Reconcile:** ✅ No pattern deviation.
**Experience:** ⏭️ N/A — internal development tooling.
**Surface Evidence:** ✅ 3/3 affected boundaries have recorded proof: package install and lint, generated plugin parity, and container build stages.
**Evidence limits:** ⚠️ A second local full-suite pass was interrupted after npm registry DNS failed during fixture installs. The Node 22 CI release gate timed out once and its retry is pending; the same release gate passes locally (81/81) and on Node 24 CI. Python dead-code inspection could not run without this worktree's virtual environment; changed Python files are lock metadata only.

## Evidence

- `scripts/dev bun audit`: no vulnerabilities in 1,171 packages.
- `scripts/dev uv audit`: no known vulnerabilities in 39 packages.
- `scripts/dev bun run test tests/integration/golden-path.test.ts tests/npm-package.test.ts tests/dogfood-source-worktree.test.ts tests/dependency-override-compatibility.test.ts`: 33/33 passed.
- `scripts/dev bun run test tests/codex-plugin-version.test.ts -t 'runs every hook through the bundled plugin CLI'`: passed.
- `scripts/dev bun run --cwd packages/cli test:release`: 81/81 passed.
- `scripts/dev bun packages/cli/scripts/check-generated-surfaces.ts`: all five surfaces current.
- Independent quality review of the complete branch diff approved, receipt `ff62baf9-181c-4496-b4fa-407df3a65225`.
- Audit passed — diff-scoped dependency-cruiser found zero violations across 532 modules and 952 dependencies; changed tests, documentation, learnings, principle references, and domain docs had no findings. Python dead-code inspection is limited as noted above.

## Remaining

- Confirm the Node 22 CI retry of the release gate after network access returns.
