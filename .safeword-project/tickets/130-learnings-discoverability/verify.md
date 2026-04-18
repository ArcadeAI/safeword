# Verify — Ticket 130

Verified: 2026-04-18T03:15:00Z

## Verify Checklist

**Test Suite:** ✓ 1538/1539 tests pass (1 skipped, 78 files)
**Build:** ✅ Success (`packages/cli` tsup + dts)
**Lint:** ✅ Clean for ticket 130 code (pre-existing TS errors in unrelated test files and node_modules remain, out of scope)
**Scenarios:** ⏭️ Skipped — no test-definitions.md (AC-driven task, not BDD)
**Doc Refs:** ✅ Clean — no stale references to removed "check FIRST when stuck" phrase
**Dep Drift:** ✅ Clean — no new dependencies added
**Parent Epic:** N/A

## Acceptance Criteria Cross-Check

- [x] `.claude/skills/project-learnings/SKILL.md` is generated from learnings folder
- [x] `safeword sync-learnings` CLI command exists with unit tests (21 tests: happy, missing Covers:, deletion, idempotency, truncation, empty-state)
- [x] PostToolUse hook fires on Edit/Write of `.safeword-project/learnings/*.md`
- [x] SessionStart hook fires for out-of-band drift
- [x] Pre-commit hook regenerates + auto-stages (dogfood)
- [x] Templates ship: `packages/cli/templates/hooks/` + schema entries + SETTINGS_HOOKS wiring
- [x] `safeword audit` flags learning files missing Covers: (W006)
- [x] All 16 learning files have Covers: on line 3
- [x] SAFEWORD.md + template: "check FIRST when stuck" line replaced with skill-mechanism pointer
- [x] Full test suite passes
- [x] Dogfood verification: `project-learnings` skill visible in this session's skill list with auto-generated description

## Hardening Applied

- Hooks prefer local source in dev (`packages/cli/src/cli.ts`), fall back to `bunx safeword@latest` — closes the dogfood-until-release gap
- `buildDescription` returns `{description, truncated}`; CLI + stderr surface the overflow condition when topic list exceeds the 1024-char cap (observed in our own dogfood corpus: 5/16 topics fit)

Ready to mark done. Update ticket: `phase: done`, `status: done`.
