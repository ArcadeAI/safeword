---
id: P4NDV8
slug: keep-table-alignment-in-codex-skills
type: task
phase: intake
status: todo
scope:
  - preserve each column's alignment colons when normalizing table widths
  - cover left, right, and centre aligned delimiter rows with a regression test
out_of_scope:
  - changing which Markdown constructs the generator normalizes at all
  - table cells containing escaped or inline-code pipes
done_when:
  - a source delimiter row of "| :--- | ---: | :---: |" keeps its colons in generated output
  - a test fails if alignment is silently converted to left-aligned
---

# Keep table alignment intact in generated Codex skills

**Goal:** Stop the Markdown table normalizer from changing how tables render.

**Why:** Every right- and centre-aligned table in a canonical skill silently
becomes left-aligned in the Codex plugin, so Codex users read a differently
formatted document than the one that was authored and reviewed.

## The mechanism

`formatMarkdownTable` in `packages/cli/src/codex-plugin/catalogue.ts` rebuilds
the delimiter row with `'-'.repeat(...)`, discarding the leading and trailing
colons that `isTableDelimiter` explicitly accepts (`/^:?-{3,}:?$/`).

This runs through `formatMarkdownTables` on all workflow Markdown regardless of
whether any other rewrite fired, so it mutates content the transformation was
supposed to leave alone — and it breaks the module's own stated contract that
the plugin is an exact allowed transformation of the canonical corpus.

## Direction

Capture each column's alignment from the source delimiter row and re-emit the
colons while normalizing widths.

## Provenance

Finding 1 of an independent cross-agent Codex review of `catalogue.ts` on main;
independently raised by a second reviewer on PR #3262.
