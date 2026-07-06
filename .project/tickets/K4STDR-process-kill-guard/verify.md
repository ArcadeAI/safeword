# Verify: process-kill-guard (K4STDR)

Ran 2026-07-06 on branch claude/bash-denylist-work-log-fxvm2z (commit 4124ab2 + suite evidence from the branch head).

## Verify Checklist

**Test Suite:** ✓ 4823/4823 tests pass (excluding 8 pre-existing `Error.isError` failures — container runs Node 22 vitest workers, repo floor is Node 24 since v0.66.0 — in gherkin/self-report/codify/check suites untouched by this ticket. Targeted: 50/50 guard tests + 1039/1039 hooks/templates/config suites pass.)
**Gherkin:** ⚠️ Local environment limitation: 277/278 scenarios pass; the 1 failure crashes inside `recordCliCrash` on the same Node-22 `Error.isError` gap, unrelated to this ticket
**Build:** ✅ Success (tsup ESM + DTS)
**Lint:** ✅ Clean (`tsc --noEmit` clean; eslint clean on all touched files)
**Scenarios:** ⏭️ Skipped — task ticket (inline tests: 15 predicate scenarios + 4 integration scenarios + 2 cursor-routing scenarios + config-matcher pin)
**PR Scope:** ✅ Diff matches ticket scope (predicate lib + Bash-branch deny + Claude Bash matcher + cursor routing + guide trim + dogfood mirrors; the matcher fix reviving the dormant W42G34/J7VBGJ gates is recorded as a deliberate in-scope deviation in ticket.md Design)
**Dep Drift:** ✅ Clean (no new dependencies)
**Parent Epic:** N/A
**Reconcile:** ✅ No pattern deviation (mirrors the W42G34 bash-ledger-writes architecture: pure predicate + shared shell-segments tokenization + one delegated gate for all three surfaces)
**Experience:** ✅ No new friction — walked TB through a zombie cleanup: `./.safeword/scripts/cleanup-zombies.sh` and all guide-sanctioned scoped kills pass untouched; the deny fires only on the cross-project footgun and names three scoped alternatives in the message.
**Evidence limits:** ⚠️ Node-22 container (repo floor Node 24): `Error.isError` failures in untouched suites are not product evidence until reproduced on Node 24/CI

Audit passed with warnings — depcruise ✓ (580 modules, 0 violations), knip ✓ clean, sync-config ✓, jscpd 415 clones (8.70%) [repo minus .safeword/.project] vs prior 416 baseline (flat). Fixed in-run: README `pre-tool-quality.ts` entry now names the Bash denials (ledger writes, process kills). Warning: `bun outdated` inconclusive (network proxy stall) — no deps changed by this ticket.
