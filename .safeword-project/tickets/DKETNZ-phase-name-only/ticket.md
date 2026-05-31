---
id: DKETNZ
slug: phase-name-only
type: task
phase: done
status: done
created: 2026-05-30T18:04:54.995Z
last_modified: 2026-05-30T23:43:00.000Z
scope:
  - Replace every numbered "Phase N" reference in the bdd skill with its named phase, using the canonical 1:1 mapping (Phase 0-2 → intake, 3 → define-behavior, 4 → scenario-gate, 5 → decomposition, 6 → implement, 7 → verify, 8 → done). Files in `.claude/skills/bdd/`: DISCOVERY.md, SCENARIOS.md, DECOMPOSITION.md, TDD.md, VERIFY.md, DONE.md, SKILL.md, SPLITTING.md (~50 occurrences).
  - Mirror every edit in `packages/cli/templates/skills/bdd/*.md` — the live skill and the template copy are kept in sync by a contract/test, so both trees must change identically.
  - SKILL.md — convert the numbered "Phase meanings" table to a name-only sequence; cross-file references ("loop back to Phase 3", "Phase 5 is optional") become named ("loop back to define-behavior", "decomposition is optional").
  - DONE 2026-05-30 (landed ahead of the rename, per user instruction): `.safeword-project/glossary.md` "Phase" entry simplified — dropped the now-incorrect "Do not confuse with / numbered substeps" note (figure-it-out established the numbers are a 1:1 bijection over the whole lifecycle, not substeps of define-behavior), and de-numbered the file's top comment ("bdd Phase 0 flow" → "the bdd skill's intake flow").
  - AUDIT FINDING — guides are NOT clean; the original "research says none" was wrong. The same bdd pipeline is referenced by number in three live shipping surfaces outside the bdd skill. Fold them into this rename or the numbered/named split survives in a new place:
    - `.safeword/guides/planning-guide.md` + `packages/cli/templates/guides/planning-guide.md` — 4 refs each (Phase 3 = define-behavior ×3, Phase 6 = implement ×1). Both copies move in lockstep (guide parity).
    - DONE 2026-05-30: the verify "Phase 7 Done Gate" ref — corrected count, it lived in FOUR copies, not two (dogfood skill `.claude/skills/verify/SKILL.md`, template skill `packages/cli/templates/skills/verify/SKILL.md`, dogfood cursor `.cursor/commands/verify.md`, template cursor `packages/cli/templates/commands/verify.md`). Reworded "(Phase 7 Done Gate)" → "(the done gate)" in all four (dropped the number, kept the canonical gate name per the glossary). verify-skill + skill-invocation-log + parity tests green (58 passed).
    - `packages/cli/src/schema.ts` — 2 code COMMENTS only ("BDD skill includes full TDD in Phase 6"; "guidance during Phase 6 implement"). Zero behavior — comment text only. Optional, but recommended for coherence.
  - EXPLICITLY out of scope (do NOT rename): other skills' own internal step numbering — debug / elicit / figure-it-out / refactor each number their own "Phase N" workflow, unrelated to the ticket lifecycle. Also the golang pack spec roadmap, the `setup-python-phase2` test name, and all frozen historical tickets / backlog / known-issues.
out_of_scope:
  - Renaming the named phase values themselves (intake, define-behavior, …) — the enum and its order stay; this only removes the redundant numbered notation.
  - Any change to the phase state machine, gate logic, or hook behavior (`hooks/lib/quality.ts` FEATURE_PHASES, transitions, prompt injections) — names and ordering are unchanged, so no code edits.
  - Renumbering to a clean 1–7 ordinal (rejected alternative B) — we delete the numbers, not re-fix them.
  - The TDD sub-step labels RED/GREEN/REFACTOR — a sub-state of `implement`, not a phase notation; untouched.
done_when:
  - `grep -rE "Phase [0-9]" .claude/skills/bdd packages/cli/templates/skills/bdd .safeword/guides/planning-guide.md packages/cli/templates/guides/planning-guide.md .claude/skills/verify/SKILL.md packages/cli/templates/skills/verify/SKILL.md .cursor/commands/verify.md packages/cli/templates/commands/verify.md` returns nothing. (verify surfaces already clean as of 2026-05-30; schema.ts comments handled separately if the optional coherence edit is taken.)
  - Both skill trees stay in sync — the template-parity / schema check passes. Both planning-guide copies and the verify skill/cursor mirror also stay identical.
  - Glossary "Phase" entry no longer carries the numbered "do not confuse" note; glossary parser reports 0 errors. (DONE 2026-05-30.)
  - Cross-references between skill files read coherently in named form.
  - Full suite + lint green; `safeword check` clean; templates synced (no drift, no unregistered files).
---

# Use named phases only in bdd skill — drop numbered Phase 0-8

**Goal:** Collapse the two parallel "Phase" notations into one — delete the numbered Phase 0–8 headings from the bdd skill and use the named, code-enforced phase values everywhere.

**Why:** The numbered scheme and the named `phase:` frontmatter values are the same 7-state pipeline expressed twice. Only the names are load-bearing (every hook, guide, and the frontmatter key off them; the numbers appear in no TS). The numbers add a translation table, a misaligned range (7 states numbered to 8 because `intake` = 0-2), and a glossary name-collision — with no benefit the names don't already provide. Named states are also refactor-stable: insert or merge a phase and nothing renumbers.

## Mapping (canonical, from SKILL.md)

| Numbered  | Named (canonical) |
| --------- | ----------------- |
| Phase 0-2 | intake            |
| Phase 3   | define-behavior   |
| Phase 4   | scenario-gate     |
| Phase 5   | decomposition     |
| Phase 6   | implement         |
| Phase 7   | verify            |
| Phase 8   | done              |

## Sub-decision (RESOLVED 2026-05-30 via /figure-it-out → full deletion)

Full deletion of numbers vs. retaining them as a one-line legend inside SKILL.md's mapping table. **Resolved: full deletion** — a retained legend would re-introduce the numbered notation as "real" vocabulary, which is the exact thing being removed; the named sequence in SKILL.md is self-sufficient.

## Verification note

Mechanical doc-only rename — no behavior to drive via TDD. Correctness is verified by grep-clean + the existing suite + the template-sync contract (tests assert the _named_ phase strings, which don't change, so they stay green).

## Work Log

- 2026-05-30T18:04:54.995Z Started: Created ticket DKETNZ
- 2026-05-30T18:06:00.000Z Intake: scope established from a /figure-it-out decision. Finding — numbered Phase 0–8 and named `phase:` values are a 1:1 bijection over one pipeline; numbers live only in `.claude/skills/bdd/*` markdown (~50 refs across 8 files), absent from all hooks/TS. Decision: delete numbers, name-only everywhere (rejected: renumber-to-1–7, status-quo). Mirror across the templates tree; simplify the glossary "Phase" entry afterward.
- 2026-05-30T18:18:00.000Z Pre-execution audit: confirmed the rename breaks nothing — numbers are in no executable code; the 3 integration tests that mention "Phase 0" do so only in JSDoc comments (assertions key off named headings); both bdd trees are byte-identical (47 numbered refs each). BUT the ticket's "guides carry no numbered refs" premise was false: found the same pipeline referenced by number in planning-guide.md (both trees, 4 each), verify SKILL.md + cursor mirror ("Phase 7 Done Gate"), and 2 schema.ts comments. Folded these into scope/done_when. Confirmed other skills' own "Phase N" step numbering (debug/elicit/figure-it-out/refactor) and frozen historical tickets are out of scope. Open sub-decision resolved: full deletion (no retained legend).
- 2026-05-30T18:18:00.000Z Glossary landed ahead of the rename (per user instruction): "Phase" entry simplified, top comment de-numbered. Remaining bdd-skill + cross-reference rename deferred to a later run of this ticket.
- 2026-05-30T22:34:00.000Z Done-gate cross-ref landed ahead of the rename (per user "tackle the done gate"): "(Phase 7 Done Gate)" → "(the done gate)" across all four verify copies (audit had undercounted this as 2 files; it is 4 — dogfood + template, skill + cursor). Tests green (verify-skill + skill-invocation-log + parity, 58 passed).
- 2026-05-30T22:44:00.000Z Count correction: the bdd skill had 49 _occurrences_ per tree (47 lines — two lines carry two refs), not "47 refs" as earlier noted. TDD.md + DECOMPOSITION.md renamed across both trees this round (6 occurrences/tree removed): `# Phase 6: Implementation (TDD)` → `# Implement: Outside-in TDD`, "proceed to Phase 7" → "proceed to verify"; `# Phase 5: Technical Decomposition` → `# Decomposition: Technical Breakdown`, "Phase 5 Exit" → "Decomposition Exit", "proceeding to Phase 6" → "proceeding to implement", work-log template "Complete: Phase 5" → "Complete: decomposition". Parity test green. **Remaining: 43 occurrences/tree** across SKILL.md (11), SCENARIOS.md (12), DISCOVERY.md (7), SPLITTING.md (5), VERIFY.md (4), DONE.md (2); plus planning-guide.md (4, both copies) and the 2 optional schema.ts comments.
- 2026-05-30T23:05:00.000Z Rename COMPLETE. Final round cleared the remaining 43 occurrences/tree across the six bdd files (SKILL, SCENARIOS, DISCOVERY, SPLITTING, VERIFY, DONE), the four planning-guide refs (both copies), and the two schema.ts comments. Naming convention held: section headings `# <PhaseName>: <Descriptive Title>` (`# Intake: Understanding & Scope`, `# Verify: Evidence Gate`, `# Done: Close Ticket`), exit headings use the bare phase name (`## Intake Exit`, `## Verify Exit`, `### Define Behavior Exit`, `### Scenario Gate Exit`), cross-refs and work-log templates use the bare named value ("proceed to scenario-gate", "loop back to define-behavior", "Complete: define-behavior"). Four judgment calls resolved: SCENARIOS.md compound title → `# Define Behavior & Scenario Gate` (descriptive title already names both phases); SPLITTING.md restart range `Phase 5+` → `decomposition+`; the SKILL "Phase meanings" table dropped its `(Phase N)` column entirely (name-only); both schema.ts comments → "the implement phase". Edits done on the dogfood copies then `cp`'d to the template tree for byte-identical parity. **Parity gotcha:** a format hook reformats `packages/cli/` markdown on write but skips `.safeword/`; my single-cell planning-guide edit left the dogfood table ragged while the template got re-aligned → release-parity flagged drift. Fixed by copying the canonical (template) copy back to `.safeword/guides/`. Verification: canonical `done_when` grep empty across all 8 paths + schema.ts clean; `dogfood-parity.release` green (1 passed); discovery + skill-gate + skills-validation + invocation-gate suites green (532 passed); parity + verify-skill + invocation-log green (58 passed); `safeword check` healthy; full suite running. Next: /quality-review → apply fixes → /refactor, then /verify to close.
- 2026-05-30T23:14:00.000Z Verify phase. Full suite green (138 files, 2284 passed, 1 skipped); build success; lint+tsc clean (exit 0). /quality-review: APPROVE on scope — surfaced one out-of-scope finding (Cursor bdd rules `.cursor/rules/bdd-*.mdc` + mirrors still numbered AND on an older verify+done-merged model → needs structural reconciliation, spun into its own ticket; ARCHITECTURE.md ADRs + AGENTS.md bad-example left as intentional/historical). /refactor: no-op (doc-only, no code structure). /audit: passed with warnings — deps unchanged, learning files conform, no dead refs; W007 stale `.safeword/depcruise-config.cjs` is NOT in this ticket's diff (pre-existing/cross-session, untouched). verify.md written. Phase → verify. Awaiting user go-ahead for final commit + done transition.
- 2026-05-30T23:43:00.000Z Complete: verify - /verify + /audit passed, verify.md written. Closing per user go-ahead: phase → done, status → done, final commit of the rename (20 files + verify.md, staged by name).
- 2026-05-30T23:55:00.000Z Post-close correction (holistic /quality-review caught it): the `done_when` grep tested only `Phase [0-9]` (space) and omitted SAFEWORD.md, so it false-cleaned — the hyphenated `Phase-3` form survived in DISCOVERY.md (in-scope, both trees) and SAFEWORD.md (both trees, 2 occ each). De-numbered all four ("Phase-3 scenarios" → "define-behavior scenarios"); re-verified clean for BOTH `Phase [0-9]` and `Phase-[0-9]`; pairs byte-identical; parity test green (13/13). verify.md evidence line corrected. Flagged out-of-scope: scaffolding templates (spec/glossary/personas) still carry "Phase 0"/"Phase-3" shorthand needing per-occurrence judgment — follow-up.
- 2026-05-31T00:40:00.000Z Ticket-claim correction: the 2026-05-30T23:14 verify-phase log and verify.md both said the out-of-scope Cursor-rule cluster was "spun into its own ticket" — that was an unverified assertion; no such ticket existed at close. Now actually filed: **G1A6BS** (`bdd-cursor-rules-reference`) for the Cursor `bdd-*.mdc` cluster (convert to thin `@reference` + add the missing verify rule), and **MT05DF** (`denumber-scaffold-templates`) for the spec/glossary/personas shorthand. verify.md "Out-of-scope finding" repointed at both. No code change — record correction only.
