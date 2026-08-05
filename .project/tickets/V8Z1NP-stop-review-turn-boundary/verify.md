# Verify — V8Z1NP

Branch `fix-stop-review-turn-boundary`, base `fba74ddd3`. PR: https://github.com/ArcadeAI/safeword/pull/1954

## Verify Checklist

**Test Suite:** ✓ 6571/6571 tests pass (434 files, 5 skipped, 0 failed); done-gate `test:done` ✓ 1468/1468 (87 files)
**Gherkin:** ⚠️ Local environment limitation: 954/959 pass, 3 skipped, 2 failed — `test-codex-plugin-migration.feature:103` and `:112` fail identically on `main` at base `fba74ddd3` (CI run 30984010293) and are unrelated to this change; filed as #1964
**Build:** ✅ Success
**Lint:** ✅ Clean (eslint + lint-gherkin + tsc --noEmit)
**Scenarios:** ⏭️ Skipped — task ticket, no test-definitions.md
**PR Scope:** ✅ Diff matches ticket scope
**Dep Drift:** ✅ Clean — no dependency manifest changes in the diff
**Parent Epic:** N/A
**Reconcile:** ✅ No pattern deviation — the bound is still a constant beside `MAX_MESSAGES_FOR_TOOLS`, the fallback ladder is unchanged
**Experience:** ⏭️ N/A — internal hook plumbing, not persona-facing
**Surface Evidence:** ✅ 1/1 — see matrix below
**Evidence limits:** ⚠️ Acceptance-lane red is inherited from `main`; those two scenarios are not evidence about this change. The done-gate's first two `test:done` runs were SIGTERM'd while queued on the machine-global build lock (owner PID 84779, main checkout) — signal-terminated with zero assertions is contention, not failure; the re-run passed 1468/1468 once the lock freed.

**Audit passed** — 0 errors, 0 warnings (diff scope, merge base `fba74ddd3`).

## Surface evidence

| Affected surface | Proof command / manual check | Result |
| --- | --- | --- |
| Claude Code Stop hook (`stop-quality.ts`) | `tests/integration/stop-review-long-turn.test.ts` via `runStopHook` against `.safeword/hooks/stop-quality.ts` | ✅ 6/6 — firing cases, silent cases, and both sides of the notification-vs-system-reminder boundary |

## Test evidence

Four cases, two directions:

| Case | Transcript | Expected |
| --- | --- | --- |
| Control | edit + 1 tool round | blocks with the implement review |
| Regression | edit + 12 tool rounds | blocks with the implement review |
| No-edit turn | 12 tool rounds, no edit | silent |
| Previous-turn edit only | edit, user prompt, 12 tool rounds | silent |

**Mutation check.** Forcing `detectEditToolsUsedInCurrentUserTurn` to `return true` fails exactly the two silent cases (2 failed / 47 passed) and leaves the firing cases green — the silent cases are load-bearing, not vacuous. Mutant reverted; parity re-verified.

## Audit — diff scope

Merge base `fba74ddd3`; 7 changed files.

- **Architecture (depcruise):** ✔ no dependency violations (2 modules cruised)
- **Config drift:** `sync-config --check` healthy — no W007
- **Learning files (W006):** no changed learnings
- **Principle trace (E010):** clean
- **Domain docs (E008/E009/W008):** out of diff scope — no changed persona/surface/glossary/feature/spec files
- **Agent config:** no `CLAUDE.md` / `AGENTS.md` / `.cursor/rules` files in the diff
- **Documentation:** `ARCHITECTURE.md` describes `stop-quality.ts`'s gate ordering ("hoisted above the edit-activity early-exit"), which this change preserves — no drift, no structural claim about the scan bound
- Knip, duplication, and dependency freshness are repository-mode checks, skipped in diff scope by design

**Audit findings self-applied before this record:** the first draft of the test file used `expect(stdout).not.toBe('')` (weak assertion — a hook printing anything unrelated would pass) and had no negative case (an always-fire implementation would have passed). Both fixed: assertions now check `decision === 'block'` and the reason content, and the two silent cases were added and mutation-verified.

## Quality review — findings on my own change

The independent-review coordinator could **not** run, so this is self-review, not independent:

```
safeword review run quality-review …
  status: blocked | author_agent: claude | assigned_reviewer: codex
  preferred_failure: invalid_output | fallback_failure: timed_out | independence: none
```

That is three already-filed retro issues firing at once — #1933 (Codex fallback never receives `--output-schema`), #1932 (fixed 120s deadline), #1934 (shared deadline starves later candidates). No independent verdict was minted; the top-level `healthy/degraded` summary is misleading and only the `data` block tells the truth.

**Critical issue found and fixed — a regression this ticket introduced.** Widening the boundary walk to 400 lines made it reach *past* a `<task-notification>` to the previous turn's edit, so a pure status turn got a decision-brief demand — precisely the #1431 false positive. The old 5-message cap had accidentally hidden it. Verified empirically on a probe transcript (old: silent, new: fired) before fixing.

Fix: a task-notification ends the turn; a `<system-reminder>` deliberately does not (it rides along mid-turn). Both directions are pinned by tests, and the notification boundary is mutation-checked.

**Refactorings applied** (each its own change → test → commit):

1. `startsNewTurn` — the stop condition read as two unrelated checks; the stale doc comment went with it.
2. `parseTranscriptLine` + `isAssistantMessage` — both scans repeated the same parse-then-check body; each now shows only its bound and stop condition.

## Not fixed here, deliberately

Issue #1964 (`main`'s red acceptance lane) is a product-vs-test disagreement in the Codex plugin migration: the product writes a `safeword-plugin-setup` bootstrap skill and exits 0 where the steps assert exit 2 and no such skill. Root cause posted to the issue. Choosing either side edits a rejection-path assertion on someone else's feature, so it is not riding this ticket.
