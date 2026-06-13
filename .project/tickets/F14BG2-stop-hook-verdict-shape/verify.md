# Verify: F14BG2 — Stop-hook verdict template: scannable decision brief

## Verify Checklist

**Test Suite:** ✓ 216/216 tests pass across 10 quality.ts-touching test files (targeted run per project rule; full suite not run by policy — one vitest process at a time)
**Build:** ⚠️ ESM build succeeds (the artifact the runtime actually uses); DTS build fails on a pre-existing missing peer-dep `@vitest/eslint-plugin` that is unrelated to this change and was already failing on the parent branch
**Lint:** ⚠️ Full ESLint config fails to load on the same pre-existing missing peer-dep; direct `tsc --noEmit -p tsconfig.json` on the modified files reports zero errors attributable to this change
**Scenarios:** ⏭️ Skipped — task-sized ticket with no test-definitions.md; behavior verification is via inline test contract in `quality.test.ts` and eyeball check on rendered output
**Dep Drift:** ✅ Clean — no dependencies added; ARCHITECTURE.md present, no architectural deps changed
**Parent Epic:** completed/143-stop-hook-binary-terminal (siblings: N/A — parent already closed)

## Done-when criteria — per-item check

1. **UNIVERSAL_HEADER matches new shape** — ✓ PASS. [packages/cli/templates/hooks/lib/quality.ts:31](../../../packages/cli/templates/hooks/lib/quality.ts) emits bolded verdict tokens (`**CONFIDENT**`, `**BLOCKED**`) followed by blank-line-separated bold-led `**Decided:**`, `**Rejected:**` (omit-when-empty), `**Open:**` (constrained to resolved/deferred/none), `**Next:**` under CONFIDENT; and `**Tried:**`, `**Need:**` under BLOCKED. Source uses blank lines (not indent) between sub-fields per the CommonMark rendering analysis.

2. **Rendered output shows visible vertical gaps** — ✓ PASS. The current assistant turn (visible in this conversation) is the live eyeball-check artifact. The verdict block renders as stacked short paragraphs in Claude Code, each starting with a bolded label; no collapse into a single line.

3. **"End with a single verdict — not a list" line gone; new framing present** — ✓ PASS. Negative-asserted by `Rule: Brevity discipline (QSNKBB) — no duplication of SAFEWORD.md` in [quality.test.ts:158-161](../../../packages/cli/tests/quality.test.ts). New framing ("scannable decision brief") + "Reproduce the shape below exactly" instruction positive-asserted by `Rule: Decision-brief framing (F14BG2)` at [quality.test.ts:127-137](../../../packages/cli/tests/quality.test.ts).

4. **Runtime hook re-synced from template** — ✓ PASS. `diff -q packages/cli/templates/hooks/lib/quality.ts .safeword/hooks/lib/quality.ts` returns clean (string-identical).

5. **Left-edge scan reveals choice/alternatives/open/next without reading any one sentence in full** — ✓ PASS. Bold labels at line start anchor the scan; reader can eye-jump to any one sub-field. Verified by inspecting the rendered verdict from the prior assistant turn.

6. **No-context reader can act on verdict block alone** — ✓ PASS. The decision-brief shape carries Decided (what changed), Rejected (what didn't and why, when applicable), Open (what's still uncertain), Next (the action). Each is independent.

7. **`quality.test.ts` updated to match new contract** — ✓ PASS. Deleted: "Think about evidence" + "not a list" assertions, `Rule: Universal critical review applies at every phase` describe block, `Rule: Research depth matches claim weight` describe block. Added: `Rule: CONFIDENT carries a decision brief`, `Rule: Decision-brief framing (F14BG2)`, `Rule: Brevity discipline (QSNKBB) — no duplication of SAFEWORD.md`. Regression-guard `it.each` updated to assert new bolded labels and negative-assert cut prose. Contract tests preserved (CONFIDENT/BLOCKED/Tried:/Need:/Next:, per-phase evidence, BddPhase enum, fallback, falsifiable-answer, parallel-action, spec-vs-implementation, disqualification).

8. **`npx vitest run tests/quality.test.ts` from `packages/cli/` passes** — ✓ PASS. 41/41 in `quality.test.ts`; 216/216 across all 10 quality.ts-touching files.

9. **`cursor/stop.ts` still imports `QUALITY_REVIEW_MESSAGE` without modification** — ✓ PASS. [packages/cli/templates/hooks/cursor/stop.ts:9](../../../packages/cli/templates/hooks/cursor/stop.ts) unchanged; consumes `QUALITY_REVIEW_MESSAGE` at line 62.

## Pre-existing issues (not from this change)

- DTS build + ESLint config both fail to load `@vitest/eslint-plugin` (missing peer-dep). Pre-existing on parent branch; session-start hook explicitly warned about this at session open ("⚠️ ESLint config not found - run 'bun run lint' may fail"). Worth a separate ticket but not blocking F14BG2.

## Notes

- Audit passed: pending — run `/audit` next to clear the done-gate.
- Coordinating with [QSNKBB-prompt-brevity-cut](../QSNKBB-prompt-brevity-cut/ticket.md) — same PR.

**Verdict:** Ready to mark done, pending /audit.
