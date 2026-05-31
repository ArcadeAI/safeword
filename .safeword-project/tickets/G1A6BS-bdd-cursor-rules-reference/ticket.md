---
id: G1A6BS
slug: bdd-cursor-rules-reference
type: task
phase: intake
status: in_progress
created: 2026-05-31T00:35:29.766Z
last_modified: 2026-05-31T00:36:00.000Z
scope:
  - Convert the seven `bdd-*.mdc` Cursor rules (both trees — `.cursor/rules/` dogfood + `packages/cli/templates/cursor/rules/`) from fat duplicate-content into thin `@reference` pointers at the canonical bdd skill files, the same pattern five rules already use (e.g. `safeword-tdd-review.mdc` → `@.claude/skills/tdd-review/SKILL.md`) and the direction ticket 151 takes for the four non-bdd fat rules. The `@reference` replaces the rule BODY; the `description:`/`alwaysApply:` frontmatter (the USE WHEN triggers Cursor keys off) stays per-rule.
  - 'Reconcile the rule SET to the live 7-phase model. The cursor rules currently encode the OLD 6-phase model where verify is folded into done: `bdd-done.mdc` is titled "# Phase 7: Done Gate" and bundles refactor → /verify → /audit → close. The live skill split these — `verify` is its own phase and DONE.md is close-only ("All verification happened in the verify phase"). So add a new `bdd-verify.mdc` (→ VERIFY.md) and repoint `bdd-done.mdc` at DONE.md.'
  - 'Rule → skill `@reference` mapping: bdd-core → SKILL.md; bdd-discovery → DISCOVERY.md; bdd-scenarios → SCENARIOS.md; bdd-decomposition → DECOMPOSITION.md; bdd-tdd → TDD.md; **bdd-verify (NEW) → VERIFY.md**; bdd-done → DONE.md; bdd-splitting → SPLITTING.md.'
  - Drop all numbered "Phase N" lifecycle notation — made moot by `@reference` (the rules inherit the already-de-numbered skill content from DKETNZ). This clears the ~24 surviving numbered refs (7 rules × 2 trees) that DKETNZ deferred as needing structural reconciliation.
out_of_scope:
  - The four non-bdd fat rules (`safeword-debugging`, `safeword-refactoring`, `safeword-testing`, `safeword-quality-reviewing`) — that is ticket 151's scope (clean 1:1 skill mirrors). This ticket is the bdd cluster only (1-to-many skill, plus set-restructuring).
  - Any edit to the bdd skill files themselves (the `@reference` targets) — they are already correct and de-numbered (DKETNZ / commit 08819652). This ticket only repoints the cursor rules at them.
  - The forward `done` → merge-ready / outcome-validated split (epic `bdd-phase-three-merge`, ticket X59JZE). Thin `@references` auto-track whatever the skills say, so they will reflect that split for free when it lands — no need to pre-empt it here.
  - Renaming phase enum values, or any state-machine / gate / hook change.
done_when:
  - '`grep -rnE "Phase[ -]?[0-9]" .cursor/rules/bdd-*.mdc packages/cli/templates/cursor/rules/bdd-*.mdc` returns nothing.'
  - Every `bdd-*.mdc` (both trees) is a thin rule — `description`/`alwaysApply` frontmatter + a single `@.claude/skills/bdd/<FILE>.md` line — and a new `bdd-verify.mdc` exists pointing at VERIFY.md.
  - The cursor rule set matches the 7-phase skill set (verify is its own rule; done is close-only).
  - Both trees byte-identical (cursor parity); new `bdd-verify.mdc` registered wherever the template manifest / SAFEWORD_SCHEMA enumerates cursor rules (no unregistered-file drift).
  - Full suite + parity green; `safeword check` clean; templates synced.
---

# Convert bdd cursor rules to @reference + reconcile to 7-phase set

**Goal:** Make the bdd Cursor rules thin `@reference` pointers at the canonical bdd skill files, and bring the rule set up to the live 7-phase model (add verify, de-merge done).

**Why:** The bdd Cursor rules are fat duplicate-content that has already drifted a full phase behind — they ship a 6-phase model with verify folded into done, actively mis-teaching the gate to every Cursor user. They also carry the last ~24 numbered "Phase N" refs that DKETNZ deferred (rightly — this is structural, not a mechanical de-number). Converting to `@reference` dissolves both problems at once: the rules inherit the correct, already-de-numbered skill content and can never drift again. This is the pattern five rules already use and ticket 151 applies to the sibling fat rules. Chosen via `/figure-it-out` over in-place reconciliation (which would re-duplicate content and need redoing after the `bdd-phase-three-merge` done-split).

## Rule set after this change

| Cursor rule (both trees) | `@reference` target                    | Note                            |
| ------------------------ | -------------------------------------- | ------------------------------- |
| bdd-core.mdc             | `@.claude/skills/bdd/SKILL.md`         | orchestrator                    |
| bdd-discovery.mdc        | `@.claude/skills/bdd/DISCOVERY.md`     |                                 |
| bdd-scenarios.mdc        | `@.claude/skills/bdd/SCENARIOS.md`     | define-behavior + scenario-gate |
| bdd-decomposition.mdc    | `@.claude/skills/bdd/DECOMPOSITION.md` |                                 |
| bdd-tdd.mdc              | `@.claude/skills/bdd/TDD.md`           | implement                       |
| **bdd-verify.mdc (NEW)** | `@.claude/skills/bdd/VERIFY.md`        | the missing phase               |
| bdd-done.mdc             | `@.claude/skills/bdd/DONE.md`          | repoint — close-only            |
| bdd-splitting.mdc        | `@.claude/skills/bdd/SPLITTING.md`     |                                 |

## Risks / verification notes

- `@reference` injects the referenced file's content — proven in-repo by the five existing thin rules. The `description:` frontmatter must survive per-rule (Cursor uses it to decide when to attach the rule); only the body is replaced.
- Adding `bdd-verify.mdc` changes the rule SET — check the template-install contract / SAFEWORD_SCHEMA cursor-rule manifest so the new file is registered (else parity/`safeword check` flags an unregistered template). [[project_schema_as_manifest]]
- Doc-only; no behavior to drive via TDD. Correctness = grep-clean + cursor parity + the existing suite.

## Lineage

- Surfaced by DKETNZ's `/quality-review` (the cursor cluster was flagged but, per its corrected `verify.md`, never actually ticketed — this is that ticket).
- Approach decided via `/figure-it-out` 2026-05-31: `@reference` over in-place reconcile or defer.
- Precedent: ticket 151 (`migrate-cursor-rules-to-reference-pattern`) — same pattern, the four non-bdd rules.

## Work Log

- 2026-05-31T00:35:29.766Z Started: Created ticket G1A6BS
- 2026-05-31T00:36:00.000Z Intake: scoped from the DKETNZ /quality-review + /figure-it-out decision. Confirmed the structural gap by reading `bdd-core.mdc` (phase table lists 6 phases, verify missing — folded into done) and `bdd-done.mdc` (titled "Phase 7: Done Gate", bundles refactor→verify→audit→close). Confirmed `@reference` viability in-repo (5 live thin rules; `safeword-tdd-review.mdc:6`). Mapping fixed (8 rules incl. new bdd-verify). Ready to execute (task).
