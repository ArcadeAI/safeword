---
id: 64J9R1
slug: plain-first-gate-blocks
parent: GD88WJ-interaction-design-uplift
type: feature
phase: intake
status: in_progress
scope: |
  Rewrite every hard-block message so it reads plain-first, without changing
  what any gate enforces. Hard blocks in scope: LOC, phase, plan, done,
  spec/JTBD/criteria, bash-ledger-write, broad process-kill. For each:
    - Lead with one plain-English sentence: what happened and why (R1).
    - Name exactly one concrete next action the reader can take (R2).
    - Replace or gloss bare internal terms — phase names, artifact filenames,
      `frontmatter`, verdict labels (R3).
    - Make the block understandable and actionable on its own; keep `/explain`
      as optional deepening, not the path to understanding (R4).
  Add a regression guard asserting the block messages meet the plainness rules.
  Ship via template sync + Cursor/Codex block-variant parity.
out_of_scope: |
  - Changing any gate's trigger, threshold, or condition — this is text-only.
  - Adding an `audience`/persona config signal or persona branching (→ JVKMSM).
  - The `/explain` capability itself, and soft (bypassable) block copy.
  - Non-block surfaces: `safeword check`/`ticket` CLI output, per-turn reminders.
  - A general interaction judge across other surfaces (→ JVKMSM).
done_when: |
  - Every hard-block message leads with a plain sentence before any
    file/phase/verdict name (R1), verified on a real block fire.
  - Every hard-block message names exactly one next action (R2).
  - No bare internal term stands alone in a block; each is glossed or
    replaced (R3).
  - The block is understandable and actionable without running `/explain`;
    `/explain` is offered as optional deepening (R4).
  - A regression guard/test locks the plainness invariants for block messages.
  - Templates synced; Cursor/Codex block variants hold parity.
  - `npx vitest run` for touched test files passes from packages/cli/.
created: 2026-07-19T12:52:23.158Z
last_modified: 2026-07-19T12:52:23.158Z
---

# Plain-first gate blocks for non-coders

**Goal:** Make every safeword hard-block message understandable on its own — plain reason first, one next action, no bare jargon — so a non-coder can act on it without running any command.

**See:** [spec.md](./spec.md) for personas, jobs-to-be-done, and outcomes.

## Work Log

- 2026-07-19T12:52:23.158Z Started: Created ticket 64J9R1
- 2026-07-19T12:55:00Z Intake framed (user: "make safeword exceptional at interaction design → ticket both, start narrow"). Explored the human↔agent interaction surfaces; scoped this ticket to the highest-pain moment — gate blocks. Key constraint found: no runtime persona signal exists (QQJK5S plainness is instruction-only, quality.ts:29), so chose **plain-first for everyone** (progressive disclosure) over a persona branch — avoids a new config flag. spec.md authored (Intake Brief · one NTB job · four Rules R1–R4); scope/out_of_scope/done_when set. Follow-on (contract + boundary judge across all surfaces) split to JVKMSM. Ready for define-behavior on user go. GitHub: [#1157](https://github.com/ArcadeAI/safeword/issues/1157) under epic [#1156](https://github.com/ArcadeAI/safeword/issues/1156).
