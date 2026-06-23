# Impl Plan: Cold-start executability test for high-blast intake

**Status:** planned

## Approach

**Riskiest assumption:** that the trigger can be pure conversational discipline keyed on the brief's _recorded_ Reversibility field, with no hook enforcement, and still fire reliably only on one-way-door work. Cheapest proof: the content scenarios under `@NTB1.AC1` — `one-way-door → offered`, `two-way-door → no offer`, and `the Intake Exit text directs reading the recorded field and forbids re-judging reversibility there`. If the authored DISCOVERY rung can't express "offer iff the recorded field reads one-way-door/cross-cutting, and do not re-judge" unambiguously, the whole no-hook design is wrong — and it fails on the first slice, cheaply.

This is a prose-instruction feature, so there is no runtime code path; every scenario is proved by **vitest content/subprocess assertions on authored text**, the layer the sibling epic-169 features used. Test layer = unit (content assertions over the template files + a subprocess parity/structure check), no integration/E2E.

**Build order (each slice builds on green):**

1. **The skill** (`packages/cli/templates/skills/<cold-start>/SKILL.md`) — the spawn contract (`isolation: worktree`, spec + ticket + repo, **no conversation**), the two-valued verdict + rubric (sufficient = plans end-to-end without guessing; insufficient = names non-empty gaps), plan-not-build, plain-language render, gaps→Open Questions (append, non-destructive), advisory/error-timeout/no-retry. Proves `@TB1.AC1`, `@NTB1.AC2`, `@TB1.AC2`, `@NTB1.AC3`. _Load-bearing exclusion clause (`no conversation`) lands here first within this slice._
2. **The DISCOVERY Intake Exit rung** (`packages/cli/templates/skills/bdd/DISCOVERY.md`) — the conditional offer keyed on the recorded Reversibility field (with the anti-re-judgment prohibition), YOLO auto-accept+log, the `defer:` reconciliation, and on-demand invocation. Proves `@NTB1.AC1`, `@TB1.AC3`. Depends on slice 1 (the rung points at the skill).
3. **SAFEWORD.md pointer** (if needed) — one line locating the check among the intake surfaces.
4. **Parity + registration** — sync template → dogfood copies (`.claude/`, `.agents/`); register any new skill dir in `SAFEWORD_SCHEMA` (`packages/cli/src/schema.ts`); rebuild dist so subprocess fixtures see the new files.
5. **Tests** (`packages/cli/tests/cold-start-check.test.ts`) — the 19 content/structure scenarios, using `readRepoFile`/`repoRoot` helpers (the NWFT20 pattern).

Sequencing the skill (slice 1) first puts the verdict/exclusion semantics — the substance — under test before the trigger wiring that references them.

## Decisions

| Decision          | Choice                                         | Alternatives considered                         | Rejected because                                                                    |
| ----------------- | ---------------------------------------------- | ----------------------------------------------- | ----------------------------------------------------------------------------------- |
| Trigger mechanism | Prose discipline in DISCOVERY Intake Exit rung | Hook nudge (prompt-questions.ts)                | Hook can't read the brief's spec-resident field; would nag every turn on guesses    |
| Verdict depth     | Cold agent **plans**, not full-builds          | Full TDD build in the worktree                  | Cost; gaps surface during planning; FP-noisy self-judgment doesn't need a build     |
| Gap sink          | Append to `spec.md` `## Open Questions`        | Chat-only report (the replan-on-resume default) | Open Questions is the sink intake already drains at exit — persistence > ephemera   |
| Verdict force     | Advisory; never blocks                         | Fail-closed block on irreversible actions       | Self-judged signals too noisy (LLM-as-judge FP 60–90%); matches epic-169 philosophy |
| Code kernel       | None — no predicate helper                     | `shouldOfferColdStart()` lib + unit tests       | Nothing would call it (trigger is prose) → tested-but-unused bloat                  |

## Arch alignment

skip: no ADRs in this project yet (`paths.architecture` → `ARCHITECTURE.md` holds the workflow ADRs, but no decision record governs intake-surface prose). This feature introduces no new technology, data ownership, or cross-service contract — it reuses the existing `isolation: worktree` sub-agent harness and the existing intake-gate pattern. No new ADR warranted; under autonomous continuation, noted here rather than prompting.

## Known deviations

The reused replan-on-resume pattern reports **in chat only** and never edits the ticket; this check deliberately **writes** to `spec.md` Open Questions. Acceptable: Open Questions is the designated mutable intake scratch, drained at Intake Exit, and the write is non-destructive (append, never overwrite) — scenario `@TB1.AC2` guards it. The divergence is conscious, not inherited by accident.

## Assessment triggers

- If one-way-door offers start firing on most features (nag fatigue — the premortem risk), revisit the trigger condition or promote it to an explicit user toggle.
- If the check is essentially never triggered, reconsider whether it earns maintenance or should fold into the readiness pointer.
- If a future need arises to fail-closed on truly irreversible actions, revisit the advisory-only verdict-force decision (would require a cross-family judge to be defensible).
