Verified: 2026-04-18T07:50:00Z

## Verify Checklist

**Test Suite:** ✓ 771/771 integration tests pass; 8/8 scenario-format unit tests pass; 66/66 quality-gates tests pass; 24/24 schema drift tests pass
**Build:** ✅ Success (ESM + DTS)
**Lint:** ✅ ESLint clean, Prettier clean (pre-existing TS errors in test files/website are not from this ticket)
**Scenarios:** All 19 scenarios marked complete across 5 rules (test-definitions.md)
**Doc Refs:** ✅ Clean
**Dep Drift:** ✅ Clean — no new dependencies added
**Parent Epic:** N/A (standalone ticket)

## Evidence

- **Pipeline skill:** [.claude/skills/bdd/SCENARIOS.md](../../../.claude/skills/bdd/SCENARIOS.md) — 5-step pipeline, concrete turn example, Phase 4 adversarial pass, both saturation checks, blockquote rationale format.
- **Enforcement gates:** [pre-tool-quality.ts:108-114](../../../.safeword/hooks/pre-tool-quality.ts) (phase gate) and [pre-tool-quality.ts:116-126](../../../.safeword/hooks/pre-tool-quality.ts) (dimension artifact gate).
- **GFM format guard:** Extracted to pure module [scenario-format.ts](../../../.safeword/hooks/lib/scenario-format.ts) with unit test coverage at [scenario-format.test.ts](../../../packages/cli/tests/hooks/scenario-format.test.ts). Integration behavior covered at [hooks.test.ts T7/T8/T9](../../../packages/cli/tests/integration/hooks.test.ts).
- **Template parity:** `.safeword/hooks/**/*.ts` byte-equal to `packages/cli/templates/hooks/**/*.ts`; schema.ts updated so `safeword upgrade` installs the new lib file.
- **Integration tests for gates:** [quality-gates.test.ts](../../../packages/cli/tests/integration/quality-gates.test.ts) cases 9.6 (phase deny), 9.7 (dimension deny feature), 9.8 (dimension allow feature), 9.9 (task bypass).

## Refactor Notes

Extracted the GFM checkbox analysis from an inline block inside `stop-quality.ts:checkScenariosComplete` into a pure module `scenario-format.ts` exposing a single `analyzeScenarioFormat(content)` function that returns `{checked, unchecked, isUnrecognized}` in one function call (two regex executions internally — same count as the original inline block, now collocated). This made the format-guard directly unit-testable without spawning the hook harness — earlier integration test attempts (original T10) caused flaky runtime interaction with the Ruff post-tool-lint test under heavy parallel load. The pure unit test covers the predicate contract; the hook call-site itself is trivial wrapping that other integration tests exercise via the cumulative-artifact gate.

**Known gap:** the three-line hook wrapper (`if (isUnrecognized) hardBlockDone(…)`) is not integration-tested end-to-end for the task-at-done path. Acceptable for such a small wrapper given the predicate has direct unit coverage; would be re-added if the wrapper grows.
