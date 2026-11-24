# Verify — DYJHJN Make the plugin the only Safeword handbook source

Head verified: `807a738ac` (PR https://github.com/ArcadeAI/safeword/pull/7220), 2026-11-12.

## Verify Checklist

**Test Suite:** ✓ 11647/11647 tests pass (14 skipped). The full run reported 2 failures in `tests/hooks/lint-go-context.test.ts`, caused by a stale local `GOROOT` (Go 1.25.14) against the Go 1.27.1 toolchain; that file passes 18/18 when re-run with `GOROOT` unset. Retro relay 198/198 (1 skipped), retro collector 153/153.
**Gherkin:** ✅ Acceptance lane passes — 599/599 scenarios, 11786/11786 steps; proof-tag suite 52/52
**Build:** ✅ Success (CLI, retro relay, retro collector, website `astro build`)
**Lint:** ✅ Clean (`eslint .`, Gherkin lint, `tsc --noEmit`)
**Typecheck:** ✅ Clean (`tsc --noEmit` for every package, `astro check`)
**Scenarios:** All 5 scenarios marked complete
**Refactor:** ✅ Completed — e55d2de7f (handbook path named once in configured-paths), 14a45c3da (Codex project marker reuses the constant)
**PR Scope:** ✅ Diff matches ticket scope — handbook source, enrollment marker, handbook-copy retirement, the tests and docs they require, regenerated surfaces, and the `main` merge
**Dep Drift:** ✅ Clean — no dependency manifest changed
**Parent Epic:** N/A
**Reconcile:** ✅ No pattern deviation — the marker follows the existing deliberate hook-side duplicate pattern (namespace-root copy, OpenCode plugin string)
**Experience:** ⏭️ N/A — not persona-facing (session bootstrap and install plumbing)
**Surface Evidence:** ✅ 3/3 affected surfaces have recorded proof — Claude plugin dispatch (`tests/claude-plugin/dispatch.test.ts`), Codex bundle CLI (`tests/codex-plugin/packaged-handbook.test.ts`, `tests/codex-plugin/legacy-authority.test.ts`), OpenCode profile plugin (`tests/opencode/marker-resolution.test.ts`)
**Evidence limits:** ⚠️ Local `GOROOT` points at Go 1.25.14 while `go` is 1.27.1; the Go lint tests and `govulncheck` were re-run with `GOROOT` unset (18/18 pass; `bun audit`, `uv audit`, `pip-audit`, `govulncheck` report no vulnerabilities affecting this code). CI's Go lint context jobs pass.

## Audit

Audit passed with 1 error fixed — documentation drift in README and five website pages (c3d7bae4f). No config drift, no dependency violations (639 modules), learnings/principle-trace/domain-doc checks clean.

## Review findings

- tdd-review: new-behavior tests fail on the pre-PR implementation for the intended reason; gap closed by covering both markers in OpenCode and legacy Codex (718156c21).
- quality-review (cross-agent, Codex): empty Codex bundle handbook started silently — fixed (054226aa7). Symlinked `npx` read as unavailable in `packageRunnerIsAvailable` — declined: pre-existing code this PR does not change, and it cannot retire a handbook copy a host reads.
