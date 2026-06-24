---
id: JZQ85C
slug: ntb-low-jargon-surfaces
parent: K6CAJN-ntb-experience-epic
type: task
phase: intake
status: backlog
created: 2026-06-24T02:21:00Z
last_modified: 2026-06-24T02:21:00Z
---

# De-jargon the three LOW NTB surfaces

**Goal:** Close the remaining low-traffic spots where raw safeword/code vocabulary reaches a non-technical user, finishing the coverage the K6CAJN epic started.

**Why:** Same root issue as the epic's HIGH/MEDIUM findings (jargon reaching a non-coder), but in low-stakes, low-frequency places that don't block the user mid-task — so they were deferred from the epic rather than dropped. Captured from `PRODUCT-AUDIT-ntb.md` (LOW section) so they aren't forgotten.

## The three surfaces (from the audit)

1. **Bypass / config-guard warnings** — `post-tool-bypass-warn.ts` and `pre-tool-config-guard.ts` surface code symbols verbatim (`@ts-ignore`, `eslint-disable`, `tsconfig`). Low exposure: fires on **agent** behavior the user didn't author and rarely must act on. Consider a one-clause gloss ("a marker that silences a safety check") without losing the developer-facing detail.
2. **Session-start lint warnings** — `session-lint-check.ts` prints "ESLint config not found", "run `bun add -D prettier`" at startup. Informational stdout, scrolls by; not a dead end. Plain-lead it, or demote.
3. **Compaction context restore** — `session-compact-context.ts` re-injects "Phase: … | Gate: …" labels after a long chat is compressed. Mostly agent-facing, but leaks phase vocabulary if the user reads the transcript. Lower priority; verify it stays agent-context.

## Scope sketch

- Apply the QQJK5S "gloss at the decision point" contract: gloss only where it's load-bearing in an ask; leave informational narration the developer skims technical.
- Surfaces 1–2 are user-visible (stdout/warning); surface 3 is agent-context — confirm before touching.
- Templates + byte-identical dogfood copies; update any tests that assert the old strings (cf. the merge that caught `stop-done-dependencies-gate.test.ts`).
- Out of scope: the HIGH/MEDIUM surfaces (already shipped).

## Work Log

- 2026-06-24T02:21:00Z Created from PRODUCT-AUDIT-ntb.md LOW findings — deferred polish, captured to backlog so it isn't lost.
