## Verify Checklist

**Test Suite:** ✓ 11629/11629 tests pass in the completed local CLI suite started at 04:16 UTC on implementation head 7f3feb82b, after earlier contention-limited attempts; 198 retro-relay and 153 retro-collector tests also pass. CI package suites pass on Node 22 and 24 at that head.
**Gherkin:** ✅ Acceptance lane passes in the Node 24 CI job at implementation head 7f3feb82b.
**Build:** ✅ Success — CLI and website builds, plus both container build stages.
**Lint:** ✅ Clean — ESLint, Gherkin lint, and Markdown lint.
**Typecheck:** ✅ Clean.
**Scenarios:** All 0 scenarios marked complete — task has no separate test-definitions file.
**Refactor:** ✅ No production-code change warranted — the only handwritten change beyond dependency declarations is the Bun 1.4 compatibility adjustment to a generated-bundle contract test.
**PR Scope:** ✅ Diff matches ticket scope — dependency remediation is separate from the explain prompt PR.
**Dep Drift:** ✅ Clean — updated packages are development tooling, with no new runtime architecture dependency.
**Parent Epic:** N/A.
**Reconcile:** ✅ No pattern deviation.
**Experience:** ⏭️ N/A — internal development tooling.
**Surface Evidence:** ✅ 3/3 affected boundaries have recorded proof: package install and lint, generated plugin parity, and container build stages.
**Evidence limits:** ⚠️ A duplicate local full-suite pass was interrupted after npm registry DNS failed during fixture installs; both CI package suites pass at implementation head 7f3feb82b. Python dead-code inspection could not run without this worktree's virtual environment; changed Python files are lock metadata only.

## Evidence

- `scripts/dev bun audit`: no vulnerabilities in 1,171 packages.
- `scripts/dev uv audit`: no known vulnerabilities in 39 packages.
- `scripts/dev bun run test tests/integration/golden-path.test.ts tests/npm-package.test.ts tests/dogfood-source-worktree.test.ts tests/dependency-override-compatibility.test.ts`: 33/33 passed.
- `scripts/dev bun run test tests/codex-plugin-version.test.ts -t 'runs every hook through the bundled plugin CLI'`: passed.
- That contract rejects a non-literal or non-true guard and compares the inlined identities with an independent expected map, so a missing or wrong identity cannot pass.
- `scripts/dev bun run --cwd packages/cli test:release`: 81/81 passed.
- PR #7201 CI at implementation head 7f3feb82b: 15 successful checks, including package suites on Node 22 and 24, Node 24 Gherkin acceptance, both release gates, and dependency audit; eight workflow jobs were skipped by design.
- `scripts/dev bun packages/cli/scripts/check-generated-surfaces.ts`: all five surfaces current.
- The pinned-Bun contract test checks CI's `setup-bun` version source. I separately compared the explicit website deployment pin and both Dockerfile tags with `packageManager` and `mise.toml`; both container build stages passed.
- Independent quality review of the complete branch diff approved, receipt `ff62baf9-181c-4496-b4fa-407df3a65225`.
- Audit passed — diff-scoped dependency-cruiser found zero violations across 532 modules and 952 dependencies; changed tests, documentation, learnings, principle references, and domain docs had no findings. Python dead-code inspection is limited as noted above.
