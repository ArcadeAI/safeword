---
id: W9GPE7
slug: decomposition-phase-removal
type: task
phase: done
status: done
epic: bdd-chain-hardening
parent: EECVXB
created: 2026-06-02T15:01:21.748Z
last_modified: 2026-06-02T23:25:00Z
---

# Remove deprecated decomposition phase — enum value, DECOMPOSITION.md, Cursor rule, migrate ticket 153

**Goal:** Complete the decomposition retirement started in FSX1PP — delete the now-deprecated `decomposition` machinery once nothing references it.

**Why:** FSX1PP collapsed the behavior (scenario-gate → implement) and deprecated `decomposition`, but kept the enum value, `DECOMPOSITION.md`, and the Cursor rule for back-compat because a live ticket (`153-boundary-resilience`) sits at `phase: decomposition` and the removal is cross-cutting. This ticket finishes the job once that's safe.

**Scope** (rescoped 2026-06-02 via the replan-on-resume investigation — see work log):

- Remove `decomposition` from the phase enum (`lib/quality.ts` `BddPhase` union + the `PHASE_EVIDENCE` map) and the `prompt-questions.ts` reminder map (`:69`).
- Delete `packages/cli/templates/skills/bdd/DECOMPOSITION.md` + its dogfood copy, and the Cursor rule `bdd-decomposition.mdc` + its dogfood copy.
- Update `schema.ts` `ownedFiles`/`managedFiles` (drop the removed files) and the `skill-cursor-pairs` parity fixture; update `quality.test.ts`'s phase lists and `stop-quality.ts`'s `phasesRequiringTestDefs` (`:188`).
- Drop the `decomposition` enum/table row from the active phase lists the original scope missed (found by replan): `quality-review/SKILL.md:29`, `ticket-system/SKILL.md:76`, `doc-templates/ticket-template.md:12` **+** its dogfood copy `.safeword/templates/ticket-template.md:12`, and `bdd/SKILL.md` phase tables / `SPLITTING.md`.

**Out of scope:** the behavior collapse + ADR (done in FSX1PP). Migrating `153` off `phase: decomposition` (already done — 153 is `done`). Scrubbing the historical retirement-rationale prose that cites the ADR (`bdd/DISCOVERY.md:187`, `bdd/SCENARIOS.md:173`) — kept deliberately so the "why it's gone" survives.

**Depends on:** ~~`153` clear of `phase: decomposition`~~ — satisfied (153 done).

**Done when:** `decomposition` no longer appears in any **active phase list** — the enum, hooks, schema, parity fixtures, skill phase tables, or ticket-template — and the deprecated files are gone; full suite + parity + typecheck green; no ticket parks at the phase. Historical prose that references the retired phase to explain its removal (citing the ADR) may remain.

**Blocked/deferred:** backlog — pick up after 153 is migrated. The deprecated machinery is harmless in the meantime (FSX1PP routes new work scenario-gate → implement).

## Work Log

- 2026-06-02T23:25:00Z Done. Executed in 3 groups: (A) enum + hooks + tests — dropped `decomposition` from `BddPhase`/`PHASE_EVIDENCE`, `prompt-questions.ts`, `stop-quality.ts`, `quality.test.ts`; (B) deleted `DECOMPOSITION.md` + `bdd-decomposition.mdc` (both copies), dropped `schema.ts`/parity-fixture refs; (C) scrubbed skill/doc phase tables (`bdd/SKILL.md`, `SPLITTING.md`, `quality-review`, `ticket-system`, `ticket-template.md`). /verify + /audit green: 2386/2386 tests, build/lint/typecheck clean, 116 parity pairs (−2), depcruise clean, no dead refs to the deleted files. Updated the FSX1PP ADR in ARCHITECTURE.md from "staged removal (follow-up)" → "completed (W9GPE7)". Kept the ADR-citing retirement prose in DISCOVERY.md/SCENARIOS.md. verify.md present. Status → done.
- 2026-06-02T15:01:21.748Z Started: Created ticket W9GPE7
- 2026-06-02T15:01Z Filed as the staged follow-up to FSX1PP (decomposition removal). Backlog until ticket 153 is migrated off the phase.
- 2026-06-02T20:36Z Unblocked: 153 migrated `decomposition → implement` (and no other active ticket parks at that phase), so the prerequisite is satisfied. Ready to execute — remove the enum value + DECOMPOSITION.md + Cursor rule + schema/parity/test references. Still backlog by choice (sequence after the live workflow test + branch PR).
- 2026-06-02T23:05Z Replan-on-resume (dogfooded the 153 feature): a fresh `isolation: worktree` sub-agent revalidated this plan → verdict **change-scope**. Findings (all grep-verified at `path:line`): (1) bullet 1 (migrate 153) already done — 153 is `done`; dropped. (2) Scope undercounted — five live `decomposition` refs it never named: `quality-review/SKILL.md:29`, `ticket-system/SKILL.md:76`, `doc-templates/ticket-template.md:12` + `.safeword/templates/ticket-template.md:12`, `bdd/DISCOVERY.md:187`. (3) Decision (keep + soften): `DISCOVERY.md:187` and `SCENARIOS.md:173` reference the phase to explain its retirement and cite the ADR — kept as historical rationale; "Done when" softened to "no active phase list" rather than literal token-absence. Status → in_progress.
