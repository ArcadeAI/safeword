---
id: PH91BA
slug: concise-intake-guide
type: task
epic: 3TJD0A
phase: done
status: done
created: 2026-11-26T15:37:03.437Z
last_modified: 2026-11-26T16:00:26Z
---

# Keep feature discovery focused on product choices

**Goal:** Remove duplicate demo, project-context and downstream verification prose. Preserve the gate, child demo inheritance and project paths.

**Why:** Reduce intake overhead while preserving correct plans on Claude and Codex.

## Work Log

<!-- Progress history, not part of the accepted contract: record scope and decisions above. -->

- 2026-11-26T15:37:03.437Z Started: Created ticket PH91BA

## Evaluation

Compare the compact discovery explanation on both hosts. Verify the demo, parent inheritance, surface coverage and configured project paths.

## Decision

Keep the current discovery text. The prose-only version passed both authors on the supplied request. Combining it with template and conversation cuts still led Claude to edit a production file before approval. The six initial deterministic failures included loss of the explicit empty-context instruction. The narrower combined candidate repaired the contract checks but still missed the live gate. [Evidence](../3TJD0A-reliable-lean-intake/intake-only-results.md)
