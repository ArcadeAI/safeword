# Verify — QHXE6W (self-report-filing, issue #353)

Verified 2026-06-24. Scope: `selfReport.*` config gating + the agent filing guide that
closes the self-observation loop. Shipped in commit `b58c87e` (builds on the earlier
issue #345 and #353 draft-emitter work).

## Verify Checklist

**Test Suite:** ✓ 3305/3305 tests pass (5 skipped — pre-existing live/release lanes; full
`vitest run` on this exact commit)
**Gherkin:** ✅ Acceptance lane passes (18 scenarios / 100 steps)
**Build:** ✅ Success (tsup ESM + DTS)
**Lint:** ✅ Clean (`eslint src tests` + gherkin lint, exit 0). Note: `tsc --noEmit` reports
the same 9 pre-existing `TS6059` rootDir errors (hook differential tests importing
`.safeword/hooks/lib/*`) present on the clean tree — not introduced by this work.
**Scenarios:** ⏭️ No `test-definitions.md` — built via direct vitest TDD. Issue #353's
acceptance criteria are realized as executable tests (mapping below).
**Dep Drift:** ✅ Clean (no new third-party deps — `node:*` builtins only)
**Parent Epic:** #344 (GitHub tracker; remaining sibling: Slice 1b) — local N/A
**Reconcile:** N/A — conformed to existing patterns (config read mirrors the
namespace-root config reader; the guide follows the existing `.safeword/guides/*`
managed-file pattern; no new divergent pattern introduced)

## #353 acceptance criteria → evidence

- Signature is the dedup key; one draft per signature → `tests/hooks/self-report.test.ts`
  (formatIssueDrafts) + `tests/commands/self-report.test.ts` (`--format issue`)
- `file` disabled (default) → no filing nudge; enabled → guide pointer →
  `tests/integration/stop-self-report.test.ts` (surface/file cases)
- `capture` disabled → no record → `tests/self-report-capture.test.ts`
- Config defaults capture-on/surface-on/file-OFF; malformed → defaults →
  `tests/hooks/self-report.test.ts` (readSelfReportConfig)
- Spam guards: spool capped (crash-loop bound) → `tests/hooks/self-report.test.ts`
  (spool cap); per-session issue cap is documented in the guide
- No customer data in the issue surface → guaranteed upstream by the Slice 1 sanitizer
  (segment-match + tail allowlist), pinned by the leak-regression tests

## Deviation (recorded)

Same as QYYC5Y: built via direct vitest TDD rather than the BDD scenario-gate flow;
`/audit` not separately run. Coverage is unit + integration; scenarios live in #353's
acceptance criteria, mapped above.
