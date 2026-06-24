# Verify: CXP9LM Codex live parity smoke

## Verify Checklist

**Test Suite:** ✓ 5/5 targeted Codex adapter tests pass; ✓ 1/1 opt-in Codex live smoke test passes
**Gherkin:** ⏭️ Skipped — `codex-live-parity-smoke.feature` is tagged `@live @manual`; the executable live coverage is `tests/smoke/codex-parity.live.test.ts`
**Build:** ⏭️ Skipped — no production build required for this smoke/evidence update
**Lint:** ⏭️ Skipped — targeted test/evidence update only
**Scenarios:** ❌ 0/4 complete — live feature scenarios remain manual until unsupported Codex execution paths are resolved or deliberately scoped
**Dep Drift:** ✅ Clean — no dependency changes
**Parent Epic:** QM5G9M (siblings: live smoke still open)
**Reconcile:** ✅ No pattern deviation
**Experience:** ⚠️ Walked Codex user through clean setup + blocked edit help; worst step = the blocking hint previously said `/explain`, which is Claude/Cursor syntax, not Codex skill syntax. Fixed the Codex adapter to surface `$explain`.

## Evidence

- `bun install` completed and rebuilt `packages/cli/dist`.
- `bun run --cwd packages/cli vitest run tests/integration/codex-pretooluse-spike.test.ts`
  - Result: 5/5 passing.
- `SAFEWORD_RUN_CODEX_LIVE_SMOKE=1 bun run --cwd packages/cli vitest run tests/smoke/codex-parity.live.test.ts --config vitest.live.config.ts`
  - Result: 1/1 passing on local `codex-cli 0.141.0`.
- Clean fixture setup from `node packages/cli/dist/cli.js setup --yes --no-modify` creates `.codex/config.toml`, `.agents/skills/explain/SKILL.md`, and `.safeword/hooks/codex/pre-tool-quality.ts`, and prints the `/hooks` trust next step.

## Findings

- Supported Codex hook payload path works: invoking `.safeword/hooks/codex/pre-tool-quality.ts` with an `apply_patch` payload denies an incomplete feature ticket and allows the same path after `scope`, `out_of_scope`, `done_when`, `dimensions.md`, `spec.md`, and `personas.md` are present.
- Codex-specific help text now points at `$explain` instead of `/explain`, matching Codex skill invocation syntax while leaving the shared Claude/Cursor hint unchanged.
- Current `codex exec` live editing on Codex CLI 0.141.0 used a `file_change` execution item for the requested file edit. That path was not intercepted by the configured `PreToolUse` matcher, so the edit succeeded even though the direct supported hook payload would deny it.
- `codex debug prompt-input` in the clean fixture did not expose repo-scoped `.agents/skills/explain` in the visible skill roots during this run. That keeps the #360 manual `/explain` verification open.

## Agent's next actions

- Decide whether safeword can intercept Codex `file_change` via a current hook event/config path; if yes, add support and convert the live smoke from finding-tolerant to denial-required.
- If Codex intentionally does not expose `file_change` to hooks, update the Codex parity support boundary and decide whether #394 can close with direct-adapter coverage plus the documented live limitation.
- Run the remaining #360 manual UI check in an interactive Codex session: confirm the block text reaches the screen and `$explain` is invokable/read-only.
