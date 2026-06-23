# Verify — QYYC5Y (self-report-capture, issue #345)

Verified 2026-06-23. Scope: capture safeword's own runtime signals to a sanitized,
zero-egress local spool + surface at Stop. Built across commits `8b8e24e` (core),
`339dda4` (Stop surfacing), `9988beb` (hook crash backstop).

## Verify Checklist

**Test Suite:** ✓ 3290/3290 tests pass (5 skipped — pre-existing live/release lanes)
**Gherkin:** ✅ Acceptance lane passes (18/18 scenarios)
**Build:** ✅ Success (tsup ESM + DTS)
**Lint:** ✅ Clean (`eslint src tests` + gherkin lint, exit 0). Note: `tsc --noEmit`
reports 9 pre-existing `TS6059` rootDir errors from hook differential tests that
import `.safeword/hooks/lib/*` — present on the clean tree (verified via stash),
not introduced by this work.
**Scenarios:** ⏭️ No `test-definitions.md` — built via direct vitest TDD (RED→GREEN).
Issue #345's measurable acceptance criteria are realized as executable tests (mapping below).
**Dep Drift:** ✅ Clean (no new third-party deps — only `node:*` builtins + existing `commander`)
**Parent Epic:** #344 (GitHub tracker; siblings Slice 1b + Slice 2 not started) — local N/A
**Reconcile:** N/A — conformed to existing patterns (self-contained `templates/` module
imported by `src/`, per the `templates/config.ts` precedent; hook/test idioms matched)

## #345 acceptance criteria → evidence

- Hook failure path → exactly one sanitized record, still exits 0 →
  `tests/integration/self-report-crash-capture.test.ts`
- Non-zero `safeword` CLI exit → record with source + exitCode →
  `tests/self-report-capture.test.ts`
- **Guardrail (load-bearing):** abs path + `ghp_` token + file snippet → none persisted,
  safeword frame + errorClass retained → `tests/hooks/self-report.test.ts` (buildRecord GUARDRAIL)
- `safeword self-report` groups by signature with counts (+ `--json`) →
  `tests/commands/self-report.test.ts`
- Capture is best-effort (never throws / never alters exit) →
  `tests/hooks/self-report.test.ts` (recordSignal best-effort)
- Stop surfacing via factual `additionalContext` →
  `tests/integration/stop-self-report.test.ts` + `tests/hooks/self-report.test.ts`
- `.safeword/self-reports/` registered transient → `tests/schema.test.ts`, `tests/parity.test.ts`

## Deviation (recorded)

Process: feature built via direct vitest TDD rather than the BDD scenario-gate flow,
given the breadth and the slice being capture-mechanism work. Coverage is unit +
integration + the guardrail; the "scenarios" live in issue #345's acceptance criteria,
mapped above. `/audit` (the done-gate's other evidence leg) not separately run.
