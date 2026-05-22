---
id: MKVNFB
slug: phase-skip-reason
type: task
phase: done
status: done
created: 2026-05-20T14:39:14.352Z
last_modified: 2026-05-21T18:30:00.000Z
depends_on: [J7VBGJ]
scope:
  - Extend the dimensions.md artifact-existence check at packages/cli/templates/hooks/pre-tool-quality.ts:116 so the gate accepts either (a) real content (current behavior), or (b) a file whose entire content is a single line of the form `skip: <non-empty reason>`.
  - Reuse `isValidSkipReason` from packages/cli/templates/hooks/lib/parse-annotation.ts (shipped in J7VBGJ) — no new helpers.
  - Add one line to bdd/DISCOVERY.md (the skill file that teaches dimensions) describing the skip syntax.
out_of_scope:
  - Adding a gate for `decomposition` — originally in scope per the v1 ticket, dropped after J7VBGJ-session audit confirmed decomposition has no artifact gate today (decomposition tasks live inline in ticket.md as a markdown table). Out per the original out_of_scope rule "Adding new artifact gates for phases that don't currently have one."
  - The TDD SHA-on-checkbox feature (J7VBGJ — landed).
  - Commit-message conventions or RED/GREEN/REFACTOR prefixes.
  - Auto-skip heuristics — the agent must write the skip line; the hook only validates.
  - Categorized skip reasons / allowlists — free-form non-empty string is the rule.
  - Migration / grandfathering of pre-existing tickets.
done_when:
  - A dimensions.md whose entire content is `skip: <non-empty reason>` allows the test-definitions.md edit/create to proceed.
  - A dimensions.md whose entire content is `skip:` (empty reason) or `skip:    ` (whitespace) is rejected by the gate with a clear message.
  - A normal content-bearing dimensions.md still passes (no regression).
  - bdd/DISCOVERY.md mentions the `skip: <reason>` syntax in one line.
  - Existing safeword test:done suite stays green.
  - New tests cover skip-accept and empty-reason-reject paths.
---

# Skip-with-reason for the dimensions.md gate

**Goal:** Give the dimensions phase a deliberate escape valve — `skip: <reason>` as the entire file content — instead of forcing agents to produce a real dimensions.md when they have one obvious behavioral dimension and no real partitioning to do.

**Why:** [pre-tool-quality.ts:116](packages/cli/templates/hooks/pre-tool-quality.ts:116) currently requires dimensions.md to exist before test-definitions.md can be created. For tiny features (single behavioral dimension, trivial partitions), this forces the agent to either write a ceremonial dimensions.md or game the gate by creating a near-empty file. The skip-with-reason mechanic (proven in J7VBGJ) lets the agent record "I considered dimensions and there was nothing to enumerate, because X" — auditable, not silent.

## Reclassified mid-flight

Original ticket was scoped as a feature targeting both `decomposition.md` AND `dimensions.md`. The J7VBGJ-session audit confirmed `decomposition.md` does not exist as an artifact in safeword — decomposition lives inline in `ticket.md`. With only one gate to extend, the work is task-sized: one file change in pre-tool-quality.ts (~10 lines), one helper reused from J7VBGJ, one doc line, two new tests. Reclassified `feature → task` 2026-05-21 to avoid BDD-ceremony bloat per the user's standing "avoid bloat" rule.

## Context anchor

The relevant gate is at [packages/cli/templates/hooks/pre-tool-quality.ts:116-130](packages/cli/templates/hooks/pre-tool-quality.ts:116) — fires on create of test-definitions.md for features, requires dimensions.md to already exist. The new behavior: if dimensions.md exists AND its content is just `skip: <non-empty reason>`, allow. If `skip:` with empty reason, deny with the same message shape J7VBGJ uses for its skip-reason validations.

`isValidSkipReason` from [packages/cli/templates/hooks/lib/parse-annotation.ts](packages/cli/templates/hooks/lib/parse-annotation.ts) is already exported and does exactly the right validation (`reason.trim().length > 0`).

## Work Log

- 2026-05-20T14:39:14.352Z Started: Created ticket MKVNFB
- 2026-05-20T14:40:00Z Scoped: filled scope / out_of_scope / done_when from the 2026-05-20 research session; noted dependency on the TDD SHA-checkbox feature (slug pending — referenced as [tdd-sha-checkbox-ledger]); deferred ticket to await that dependency.
- 2026-05-21T18:30:00Z Unblocked: J7VBGJ shipped at v0.34.0 (commit 5a71199). Reclassified feature → task after re-reading scope and confirming the `decomposition` portion was based on a misread (decomposition lives inline in ticket.md, has no gate to extend, and adding one is out of scope per original ticket's own rule). Remaining work targets dimensions.md only.
