# Verify — 0WQA9V (smoke test for safeword)

## Verify Checklist

**Test Suite:** ✓ 2488/2488 tests pass (1 skipped — the live tier, correctly excluded without a key)
**Build:** ✅ Success — tsup ESM + DTS
**Lint:** ✅ Clean — `eslint . && tsc --noEmit`, exit 0
**Scenarios:** ⏭️ N/A — task (no test-definitions.md; tasks carry no scenarios)
**Dep Drift:** ✅ Clean — no dependency changes (only `test:smoke*` scripts added; `package.json` deps untouched)
**Parent Epic:** N/A
**Reconcile:** ✅ No pattern deviation — `vitest.live.config.ts` mirrors the existing `vitest.{slow,release}.config.ts` pattern; the path-based smoke scripts mirror `test:done`.

**Audit:** Audit passed — see /audit run this session (no new findings attributable to this change; baseline knip/jscpd noise only).

## Done-when evidence

- **`test:smoke:fast`** green in <1 min — 386 tests, ~18s, hermetic (no build/network/model). ✓
- **`test:smoke`** — fast set + the real `setup → install → hook → lint` golden-path e2e. ✓
- **`test:smoke:live`** — drives a real Claude agent into the intake-phase gate and asserts the `permission_denials` Write entry; **skips cleanly** with no `claude`/no key (suite stays green). Confirmed live (~1.5¢) against claude 2.1.161. ✓
- **Drift guard** (`hook-coverage.test.ts`, runs in the default suite) — red when a shipped hook lacks smoke coverage or an `EXEMPT_HOOKS` entry; green for the current 21-hook set (19 `.ts` + 2 `.sh`). ✓
- All committed on `smoke-test`; **PR #190** open. ✓

## Notes

The live run also demonstrated the gate holds against an agent _actively circumventing_ it: after the blocked Write, the agent tried to Edit `ticket.md` to flip `phase: intake → define-behavior`; that Edit was permission-denied separately (Edit not in `--allowedTools`), and the assertion correctly targets only the hook-denied Write.

CI wiring for the live tier (`workflow_dispatch` + `ANTHROPIC_API_KEY` secret + pinned `curl … | bash` install) is out of scope — tracked for follow-up.
