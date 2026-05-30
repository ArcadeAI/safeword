---
id: DKETNZ
slug: phase-name-only
type: task
phase: intake
status: in_progress
created: 2026-05-30T18:04:54.995Z
last_modified: 2026-05-30T22:34:00.000Z
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
- 2026-05-30T22:34:00.000Z Done-gate cross-ref landed ahead of the rename (per user "tackle the done gate"): "(Phase 7 Done Gate)" → "(the done gate)" across all four verify copies (audit had undercounted this as 2 files; it is 4 — dogfood + template, skill + cursor). Tests green (verify-skill + skill-invocation-log + parity, 58 passed). Remaining: the 47-ref bdd-skill rename (both trees) + planning-guide (both copies) + the 2 optional schema.ts comments.
