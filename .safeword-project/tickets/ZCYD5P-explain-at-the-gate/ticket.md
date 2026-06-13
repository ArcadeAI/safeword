---
id: ZCYD5P
slug: explain-at-the-gate
parent: VKNF1T-platform-uplift-epic
type: patch
phase: done
status: done
created: 2026-06-13T01:07:16.435Z
last_modified: 2026-06-13T03:52:00.000Z
---

# Gate block messages point to /explain

**Goal:** When a safeword gate hard-blocks (phase gate, LOC gate, done gate), append one line to the block message pointing at `/explain` for a plain-English translation.

**Why:** Gate messages are the densest jargon in the system — exactly the moment a user (or agent) is confused and stalled. `/explain` now exists (NTT094) to translate safeword state into plain English, but nothing connects the problem surface to the tool. One additive string per gate closes the loop.

## Scope sketch

- Append a `/explain` pointer line to the hard-block outputs in the gate hooks (pre-tool-quality phase/LOC blocks, stop-quality done block).
- Hooks live in `packages/cli/templates/hooks/` with byte-identical dogfood copies in `.safeword/hooks/` — stage together.
- Out of scope: changing gate logic, rewording existing messages, advisory (non-blocking) outputs.

## Work Log

- 2026-06-13T01:07:16.435Z Started: Created ticket ZCYD5P
- 2026-06-13T03:52:00Z Done: added shared EXPLAIN_HINT to lib/quality-state.ts; appended in deny() (phase/LOC/artifact gates) + hardBlockDone() (done gate); 3 hook templates synced byte-identical to dogfood. LOC-gate + done-gate tests assert the pointer. Lint/build clean, 121 hook tests green. verify.md written. Patch closed.
