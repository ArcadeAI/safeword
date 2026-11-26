---
id: 4BAM6A
slug: simplify-bdd-phase-map
type: task
epic: 3TJD0A
phase: intake
status: in_progress
created: 2026-11-26T07:41:04.624Z
last_modified: 2026-11-26T07:41:04.624Z
---

# Give feature authors one phase map

**Goal:** Test removal of the second phase-to-file table.

**Why:** Assess this change independently on both hosts.

## Work Log

<!-- Progress history, not part of the accepted contract: record scope and decisions above. -->

- 2026-11-26T07:41:04.624Z Started: Created ticket 4BAM6A

## Latest evidence

The isolated cut removes the second phase-to-file table (15 source lines). Both hosts retain the first table and the explicit discovery handoff. See the per-host trial results.

[Full scorecard](../3TJD0A-reliable-lean-intake/scorecard.md)
