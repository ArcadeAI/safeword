---
id: MT05DF
slug: denumber-scaffold-templates
type: task
phase: implement
status: in_progress
created: 2026-05-31T00:20:51.534Z
last_modified: 2026-05-31T00:27:00.000Z
scope:
  - Finish DKETNZ's bdd-lifecycle de-numbering in the scaffolding templates it left flagged. Replace numbered ticket-lifecycle "Phase N" references with their canonical named phase (Phase 0-2 → intake, 3 → define-behavior, 4 → scenario-gate, 5 → decomposition, 6 → implement, 7 → verify, 8 → done). Three template files, ~5 occurrences:
  - '`.safeword/templates/spec-template.md` + `packages/cli/templates/spec-template.md` (dual-tree, parity-locked — both copies move in lockstep): line 6 "the bdd Phase 0 flow authors it" → "the bdd intake flow authors it"; line 53 "Each Phase-3 [scenario]" → "Each define-behavior [scenario]".'
  - '`packages/cli/templates/glossary-template.md` (package tree only — no `.safeword/templates/` copy): line 6 "the `bdd` Phase 0 flow reads" → "the `bdd` intake flow reads".'
  - '`packages/cli/templates/personas-template.md` (package tree only): line 6 "during Phase 0" → "during intake".'
out_of_scope:
  - The Cursor `bdd-*.mdc` rules (bdd-core / bdd-scenarios / bdd-decomposition / bdd-tdd / bdd-done / bdd-discovery / bdd-splitting, dogfood + template mirrors) — they number the SAME lifecycle but encode an older verify+done-merged model, so they need structural reconciliation, not a mechanical de-number. Tracked separately (the cursor-rules reconciliation ticket flagged in DKETNZ's verify.md).
  - Other skills' OWN internal step numbering — debug (Phase 1-4), refactor (Phase 1-5), figure-it-out (Phase 1-4), elicit (Phase 1-3), in both `skills/*/SKILL.md` and `cursor/rules/safeword-*.mdc`. These are each skill's own workflow, unrelated to the ticket lifecycle. Leave untouched (same exclusion DKETNZ carried).
  - Renaming the named phase enum values themselves, or any state-machine / gate / hook change. Names and order are unchanged; this only removes the redundant numbered notation.
done_when:
  - '`grep -rnE "Phase[ -][0-9]" .safeword/templates/spec-template.md packages/cli/templates/spec-template.md packages/cli/templates/glossary-template.md packages/cli/templates/personas-template.md` returns nothing.'
  - spec-template.md stays byte-identical across both trees (template-parity / contract check passes).
  - Full suite + parity green; `safeword check` clean; templates synced (no drift, no unregistered files).
---

# De-number bdd lifecycle refs in scaffolding templates

**Goal:** Finish the named-phase rename in the three scaffolding templates DKETNZ flagged but deliberately deferred.

**Why:** DKETNZ (commit `08819652`) collapsed numbered Phase 0-8 into named phases across the bdd skill, guides, and SAFEWORD.md, but left the spec/glossary/personas templates because "Phase 0" there reads as intake-shorthand and needs a per-occurrence judgment rather than a blind swap. Left numbered, the same two-notation split survives in the artifacts users scaffold from — so a fresh `spec.md` would re-teach "Phase 3" as vocabulary.

## Mapping (canonical, from DKETNZ)

| Numbered  | Named (canonical) |
| --------- | ----------------- |
| Phase 0-2 | intake            |
| Phase 3   | define-behavior   |
| Phase 4   | scenario-gate     |
| Phase 5   | decomposition     |
| Phase 6   | implement         |
| Phase 7   | verify            |
| Phase 8   | done              |

The two occurrences here are "Phase 0" (the intake authoring flow → **intake**) and "Phase-3" (the scenario-writing step → **define-behavior**).

## Parity note

`spec-template.md` exists in both trees and is parity-locked — edit the dogfood copy, then `cp` to the package mirror (a Bash `cp` skips the PostToolUse format hook, guaranteeing byte-identity; a direct edit to the `packages/cli/` copy gets reflowed by the hook while `.safeword/` does not → drift). `glossary-template.md` and `personas-template.md` live only under `packages/cli/templates/`, so they have no dogfood pair.

## Verification note

Mechanical doc-only rename — no behavior to drive via TDD. Correctness is grep-clean + the existing suite + the template-sync contract.

## Work Log

- 2026-05-31T00:20:51.534Z Started: Created ticket MT05DF
- 2026-05-31T00:22:00.000Z Intake: scoped from DKETNZ's flagged-but-deferred scaffolding-template cluster. Confirmed via `grep -rnE "Phase[ -][0-9]"`: spec-template (both trees, lines 6 + 53), glossary-template + personas-template (package tree only, line 6 each). Separated from noise — the cursor `bdd-*.mdc` lifecycle refs belong to the verify+done-merged reconciliation ticket, and debug/refactor/figure-it-out/elicit number their own workflows (out of scope, same as DKETNZ). Ready to execute (task).
- 2026-05-31T00:27:00.000Z Implement: all 5 occurrences de-numbered. spec-template (dogfood) line 6 "bdd Phase 0 flow authors it" → "bdd intake flow authors it", line 53 "Each Phase-3 scenario" → "Each define-behavior scenario", then `cp`'d to the package mirror (byte-identical). glossary-template line 6 "`bdd` Phase 0 flow reads" → "`bdd` intake flow reads"; personas-template line 6 "during Phase 0" → "during intake". Verified: `grep -rnE "Phase[ -][0-9]"` clean across all 4 files; spec-template pair byte-identical; `parity.test.ts` green (13/13). Pending: /verify + done close (deferred — done-gate runs the full ~11-min suite, holding to avoid colliding with the concurrent session's vitest).
