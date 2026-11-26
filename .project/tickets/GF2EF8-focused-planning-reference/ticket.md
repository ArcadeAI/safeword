---
id: GF2EF8
slug: focused-planning-reference
type: task
epic: 3TJD0A
phase: done
status: done
created: 2026-11-26T15:37:03.625Z
last_modified: 2026-11-26T16:00:26Z
---

# Load planning details only when the work needs them

**Goal:** Compare fresh feature routing with repair and stale resume. Measure real reads, input and outcomes.

**Why:** Reduce intake overhead while preserving correct plans on Claude and Codex.

## Work Log

<!-- Progress history, not part of the accepted contract: record scope and decisions above. -->

- 2026-11-26T15:37:03.625Z Started: Created ticket GF2EF8

## Evaluation

Compare routine fresh feature intake against the same project with the narrower guide trigger. Check guide reads, usage, and whether repair and consent instructions remain discoverable.

## Decision

Keep the current planning-guide trigger. Fresh Codex dropped from two identifiable planning-guide read commands to zero, but input rose from 472,981 to 530,576 tokens. Fresh Claude had no identifiable read in either arm. All four matched repair runs passed; Codex still read the guide in both. This sample does not establish consistent input savings. Stale implementation-plan resumes were outside the intake boundary. [Evidence](../3TJD0A-reliable-lean-intake/intake-only-results.md)
