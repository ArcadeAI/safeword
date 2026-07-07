# Verify: cleanup-zombies-confirm (2KG1JW)

Ran 2026-07-07 on branch claude/cleanup-zombies-confirm (base: post-#938 main), Node 24 container.

## Verify Checklist

**Test Suite:** ✓ 4980/4980 tests pass (347 files, 7 conditional skips; includes the 5 new consent scenarios — bare preview, --yes/-y kill mode, --dry-run alias, findings-preview hint)
**Gherkin:** ✅ Acceptance lane passes (340/343 scenarios, 3 environment-conditional skips)
**Build:** ✅ Success (tsup ESM + DTS)
**Lint:** ✅ Clean (tsc --noEmit clean via typecheck lane; eslint + markdownlint + shellcheck clean on changed files; lint-staged ran at commit)
**Scenarios:** ⏭️ Skipped — task ticket (inline tests: deny-by-default preview, explicit consent flag, back-compat alias)
**PR Scope:** ✅ Diff matches ticket scope (cleanup-zombies.sh default inversion + tests + 3 prose sites + deny-message wording + parity mirrors + ticket artifacts; nothing else)
**Dep Drift:** ✅ Clean (no new dependencies)
**Parent Epic:** N/A
**Reconcile:** ✅ No pattern deviation (same graduate-then-trim shape as rungs 1–3: script-enforced invariant, prose points at the enforcement; --dry-run kept as alias mirrors the fail-open back-compat convention)
**Experience:** ⚠️ 1 deliberate new step — walked TB through "port blocked → cleanup": preview now always comes first, so the kill takes two invocations instead of one (`cleanup-zombies.sh` then `--yes`). Worst step = an agent that already knows what it wants to kill must still run twice — which is the invariant working as designed (the ritual the prose demanded is now unskippable). Zero new steps for anyone who followed the documented flow before.
**Evidence limits:** ✅ None (all lanes ran clean locally; shellcheck via system binary 0.9.0 — the npm wrapper's download is proxy-blocked in this container)

Audit passed — sync-config ✓, depcruise ✓ (600 modules, 0 violations), knip ✓ clean (no findings, no W005 hints), jscpd 426 clones (8.52%) [repo minus .safeword/.project] — vs 427 at the same scope on the pre-#938 baseline, no new duplication from this diff; learnings Covers: ✓; outdated deps all dev-only patch/minor plus the three already-tracked majors (unicorn 71 pin, typescript 6 → ticket 091, cucumber-messages 34).
