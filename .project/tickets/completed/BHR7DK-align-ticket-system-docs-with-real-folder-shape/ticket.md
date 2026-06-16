---
id: BHR7DK
slug: align-ticket-system-docs-with-real-folder-shape
type: task
phase: intake
status: done
created: 2026-06-16T03:17:01.287Z
last_modified: 2026-06-16T03:51:29Z
scope:
  - Correct the ticket-system skill instructions so new tickets are documented as `{ID}-{slug}/`, matching `safeword ticket new`.
  - Explain that lookup still supports older `{ID}/` and numeric `{id}-{slug}/` folders for backward compatibility.
  - Update shipped template docs, dogfood installed copies, and public/project docs that describe the ticket folder shape.
  - Add regression coverage so the ticket-system skill cannot drift back to ID-only new-ticket wording.
out_of_scope:
  - Changing the on-disk ticket format or CLI behavior.
  - Renaming existing ticket folders.
  - Refactoring ticket lookup logic.
done_when:
  - Shipped ticket-system instructions describe current creation and backward-compatible lookup accurately.
  - Relevant docs use `<namespace-root>/tickets/{ID}-{slug}/` for current ticket folders.
  - Tests fail on stale "ID alone" new-ticket wording and pass with the corrected copy.
---

# Align ticket system docs with real folder shape

**Goal:** Make the ticketing instructions describe the real `safeword ticket new` folder shape and supported historical formats.

**Why:** Agents follow these docs during planning; stale ID-only guidance caused the previous epic creation to look surprising even though the CLI was correct.

## Work Log

- 2026-06-16T03:51:29Z Fixed review criticals: figure-it-out #1 chose the smallest creation-comment correction in `ticket-new.ts` (`{ID}-{slug}` only, because compatibility belongs in lookup/writer docs); figure-it-out #2 chose renaming the lowercase lookup test as historical ID-only rather than changing lookup behavior. Revalidated with focused ticket tests (21 passed) and `git diff --check`.
- 2026-06-16T03:23:42Z Verified: Done-gate subset passed (`bun run --cwd packages/cli test:done`, 39 files / 458 tests). Existing ambiguous fixture warning remains: `Ambiguous ticket ID "7K9M3P": 7K9M3P, 7K9M3P-spurious`.
- 2026-06-16T03:22:37Z Verified: Focused tests passed (`bun run --cwd packages/cli test tests/skills/ticket-system-prompt.test.ts tests/hooks/active-ticket-lookup.test.ts tests/commands/ticket-new.test.ts`, 21 tests); `bun packages/cli/src/cli.ts check` passed and regenerated ticket indexes; `git diff --check` passed.
- 2026-06-16T03:21:10Z Implemented: Updated shipped ticket-system, BDD, verify, planning, architecture, README, glossary, and task-template docs to use current `{ID}-{slug}/` creation shape while documenting `{ID}/` and numeric folders as readable historical formats; added prompt and lookup regressions.
- 2026-06-16T03:17:06Z Scoped: Current creation is `{ID}-{slug}/`; lookup remains compatible with older `{ID}/` and numeric slug folders. No CLI behavior change.
- 2026-06-16T03:17:01.287Z Started: Created ticket BHR7DK
