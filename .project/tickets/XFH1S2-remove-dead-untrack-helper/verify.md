# Verify: Remove dead untrack helper so the CLI carries no unreachable code

Verified: 2026-11-15 against `origin/main` merge base 094a0fb67 on commit 5c027341c (PR ArcadeAI/safeword#7535).

## Verify Checklist

**Test Suite:** ⚠️ Local environment limitation: local full run 11786/11803 pass; 3 failures are the known GOROOT 1.25.14 vs go 1.27.1 mismatch in `lint-go-context.test.ts` and an `opencode-ai --version` bunx timeout in `opencode/host-contract.test.ts`, neither touching `utils/git.ts`. CI's full suite on 5c027341c passes on node 22.23.2 and 24.18.1. Targeted `project-directory-parity` + `reconcile` 111/111.
**Gherkin:** ⚠️ Local environment limitation: 597/599 locally; the two failures (a 40s review-timeout scenario and a ranked-route scenario that launched the locally installed `claude` instead of its scripted reviewers) depend on this machine's reviewer CLIs and load, not on this diff. CI's acceptance lane (`bun run test:bdd`, node 24.18.1 job) passes on 5c027341c.
**Build:** ✅ Success
**Lint:** ✅ Clean (ESLint)
**Typecheck:** ✅ Clean (`tsc --noEmit`)
**Scenarios:** ⏭️ Skipped — patch ticket has no test-definitions.md; dead-code removal adds no behavior
**Refactor:** ✅ No change warranted — `git.ts` is now two short, still-used functions with no unused imports
**PR Scope:** ✅ Diff matches ticket scope (`utils/git.ts` helper removal, `tests/git.test.ts` deletion, this ticket)
**Dep Drift:** ✅ Clean (no dependencies changed; `bun audit`, `uv audit`, Go/Rust advisories clean)
**Parent Epic:** N/A
**Reconcile:** ✅ No pattern deviation
**Experience:** ⏭️ N/A — not persona-facing (internal dead code)
**Surface Evidence:** ⏭️ N/A — no affected surfaces; generated plugin runtimes byte-identical
**Evidence limits:** ⚠️ Local Go toolchain mismatch, OpenCode bunx timeout, and local reviewer CLIs affecting two review scenarios; all pass in CI on 5c027341c

Audit passed — 0 errors and 0 warnings. Diff-scoped sync-config healthy; dependency-cruiser 0 violations across 365 modules; no references to the deleted test file; ARCHITECTURE.md already records the untrack-on-upgrade migration as retired.

Quality review APPROVED by an independent Codex reviewer (cross-agent). First pass requested evidence that no consumers remain; with a repo-wide search, the public `src/index.ts` export check, the 6b905e374 removal of the last caller, and the ARCHITECTURE.md decision supplied, the second pass approved with no findings.
