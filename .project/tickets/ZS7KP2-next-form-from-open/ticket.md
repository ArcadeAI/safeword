---
id: ZS7KP2
slug: next-form-from-open
type: patch
phase: done
status: done
created: 2026-10-06T05:31:28.801Z
last_modified: 2026-10-06T05:50:00.000Z
---

# Tell agents which Next form the stop gate expects

**Goal:** Key the Next/Need form to the Open line in the bootstrap contract and say why in the correction (#5441)

**Why:** Agents wrote the Action form with Open naming a human decision and got bounced without knowing Open drives the form.

## Work Log

- 2026-10-06T05:31:28.801Z Started: Created ticket ZS7KP2
- 2026-10-06T05:45:00.000Z Decided: keep the evaluator strict (Open: human → decision form). Accepting the Action form there would leave a named human decision without a Reply. Fix the wording instead. The bootstrap contract now keys both forms to the Open label (derived from the grammar), and the decision-form correction says Open caused it and offers `Open: none` as the exit. SAFEWORD.md already said this; only the hook-injected contract was ambiguous.
- 2026-10-06T05:45:00.000Z Verified: RED 3 failing → GREEN; tests/hooks + quality + stop-hook transcript lane 2252 pass; eslint, prettier, tsc clean; 5 generated surfaces regenerated and current; .safeword/hooks/lib/quality.ts byte-synced (install refuses in nested worktrees — spun off separately).
- 2026-10-06T05:50:30.951Z Phase: intake → done
