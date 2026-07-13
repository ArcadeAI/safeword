# Verify — EDDABK (shell-tokenizer-consolidation)

## Verify Checklist

**Test Suite:** ✓ 213/213 tests pass across the 8 tokenizer-touching files (shell-segments, process-kill-guard, bash-ledger-writes, dependency-readiness, cursor-gate-adapter, cursor-shell-gate, + 2 integration). Full suite 5009/5016; the 2 failures are unrelated — see Evidence limits.
**Gherkin:** ⏭️ Skipped — no acceptance lane for this task
**Build:** ✅ Success (tsup ESM + DTS)
**Lint:** ✅ Clean (eslint + tsc --noEmit + gherkin)
**Scenarios:** ⏭️ Skipped — task ticket, no test-definitions.md
**PR Scope:** ✅ Diff matches ticket scope — only the 5 tokenizer hook libs (+ byte-identical `.safeword/` mirrors), their 5 test files, and this ticket. No unrelated files.
**Dep Drift:** ⏭️ Skipped — no dependency manifest changes, no ARCHITECTURE.md
**Parent Epic:** N/A
**Reconcile:** ✅ No pattern deviation — consolidates onto the existing shared hook-lib pattern (`shell-segments.ts`), the direction the ticket targeted; removes a divergent copy rather than adding a new pattern.
**Experience:** ⏭️ N/A — internal hook plumbing, not persona-facing
**Evidence limits:** ⚠️ Two full-suite failures are pre-existing and unrelated to this diff — `tests/integration/rust-golden-path.test.ts` (a `cargo clippy` workspace-targeting E2E, environment-gated on the local Rust toolchain) and `tests/scripts/cleanup-zombies.test.ts` (a `pgrep`-based victim-process-detection behavioral pin from #949: `expected '…' to contain 'Re-run with --yes to kill them'` — the preview didn't detect the spawned victim on this box). Both SUTs are byte-identical to `main`, both fail in isolation with none of this diff's test files loaded, so they are not product evidence against this change. CI's isolated suite is authoritative.

Audit passed — 0 errors, 0 new warnings. Config in sync (W007 ✓); depcruise clean (no cycles / violations, 602 modules — `dependency-readiness → shell-segments` adds no cycle); knip flagged nothing on the changed files or the new `commandWords` export; jscpd 418 clones / 8.34% [repo minus `.safeword`,`.project`] is repo baseline (this diff reduced duplication — ~190-line private copy deleted, shared helper added).

## Notes

- Two companion gate fixes verified empirically against the real modules: `pkill 'n\ode'` (interior-backslash ERE literal) now re-detected; `npm ci --help` / `bun install --help` / `pnpm install -h` no longer stamp a false-ready.
- Adversarial design panel (3 lenses) + high-effort code review (8 angles → verify) both run; 2 genuine regressions caught and fixed, remaining findings triaged as pre-existing and filed as follow-ups.
- Semver: gates become strictly stricter / false-positive-removing — surface as a minor at next release (new-denial list in the PR body).
