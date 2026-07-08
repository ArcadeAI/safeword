# Verify — HRDN42 (gate-basename-hardening)

## Verify Checklist

**Test Suite:** ✓ 221/221 tests pass across the 8 tokenizer/gate files (8 new HRDN42 pins). Full suite 5017/5024; the 2 failures are unrelated — see Evidence limits.
**Gherkin:** ⏭️ Skipped — no acceptance lane for this task
**Build:** ✅ Success (tsup ESM + DTS)
**Lint:** ✅ Clean (eslint + tsc --noEmit + gherkin)
**Scenarios:** ⏭️ Skipped — task ticket, no test-definitions.md
**PR Scope:** ✅ Diff matches ticket scope — only the 4 gate/tokenizer hook libs (shell-segments, process-kill-guard, bash-ledger-writes, cursor/gate-adapter) + byte-identical `.safeword/` mirrors, their test files, and this ticket. No unrelated files; the deferred 5c/5d are documented, not touched.
**Dep Drift:** ⏭️ Skipped — no dependency manifest changes, no ARCHITECTURE.md
**Parent Epic:** N/A
**Reconcile:** ✅ No pattern deviation — basename-matching reuses dep-readiness's established `nodePath.basename(binary)` pattern; no new abstraction introduced.
**Experience:** ⏭️ N/A — internal security-gate plumbing, not persona-facing
**Evidence limits:** ⚠️ Two full-suite failures are pre-existing and unrelated to this diff — `tests/integration/rust-golden-path.test.ts` (a `cargo clippy` workspace-targeting E2E, environment-gated on the local Rust toolchain, ~5 min runtime) and `tests/scripts/cleanup-zombies.test.ts` (a `pgrep`-based victim-process-detection pin from #949). Both SUTs are byte-identical to base; this diff touches only shell-segments/kill-guard/ledger/gate-adapter, none of which those tests exercise. CI's isolated suite is authoritative.

Audit passed — 0 errors, 0 new warnings. Config in sync (W007 ✓); depcruise clean (no cycles / violations, 602 modules — the new `nodePath` imports add none); knip flagged nothing on the changed files; jscpd 426 clones / 8.64% [repo minus `.safeword`,`.project`], +8 vs the 418 EDDABK baseline — entirely the new gate test pins' repeated `it.each` assertion shapes (benign test duplication), no source clones.

## Notes

- All 16 evasions re-verified reproducing on base, then all 6 in-scope fixes verified landing; `command -v git` query guardrail preserved.
- 3-lens adversarial review (false-positive / gate-weakening / tokenizer-regression), every claim bun-verified → clean sweep, zero findings survived.
- Deferred (documented in ticket, filed conceptually): glued `(pkill node)` and escaped `\>|` — both need risky shared-tokenizer changes (splitting `(`/`)` as metacharacters; escape-state in the splitter) and are adversarial-path; backstops exist (ledger done-gate distinct-SHA validation; kill-guard's documented subshell limitation).
- Semver: every gate strictly stricter / more forms caught — surface as a minor at next release; new-detection list in the PR body.
