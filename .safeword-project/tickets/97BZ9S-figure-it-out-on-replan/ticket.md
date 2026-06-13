---
id: 97BZ9S
slug: figure-it-out-on-replan
parent: VKNF1T-platform-uplift-epic
type: task
phase: done
status: done
created: 2026-06-13T01:07:16.467Z
last_modified: 2026-06-13T04:08:00.000Z
---

# Replan heads-up offers /figure-it-out when scope may be stale

**Goal:** Extend the replan-on-resume heads-up (templates/hooks/lib/replan.ts + replan-relevance.ts) so that when sibling commits may have staled a ticket's scope, the injected line also offers `/figure-it-out` to re-decide the approach.

**Why:** The replan heads-up today says "check the plan" but gives no tool for _re-deciding_ — the user's stated intent is that figure-it-out should run during revalidation. This is the narrow slice of ZBVGPF (embed-figure-it-out) that serves that intent without the full embedding work. Same additive-line pattern as E11N48's blocker-moved line.

## Scope sketch

- Additive text in the replan heads-up message offering `/figure-it-out` when scope may be stale.
- TDD: extend existing replan hook tests.
- Byte-identical pair: `packages/cli/templates/hooks/lib/replan.ts` + `.safeword/hooks/lib/replan.ts` (and replan-relevance if touched).
- Out of scope: full ZBVGPF embedding (figure-it-out inside bdd/intake), changing replan detection logic.

## Work Log

- 2026-06-13T01:07:16.467Z Started: Created ticket 97BZ9S
- 2026-06-13T04:08:00Z Done: appended shared REDECIDE_OFFER clause to formatReplanHeadsUp + formatBlockerMovedHeadsUp (templates/hooks/lib/replan-relevance.ts), dogfood synced byte-identical. TDD RED→GREEN (2 new asserts). Lint/build clean, 42 replan tests green. verify.md written. Task closed.
