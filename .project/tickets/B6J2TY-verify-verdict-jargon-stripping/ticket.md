---
id: B6J2TY
slug: verify-verdict-jargon-stripping
parent: K6CAJN-ntb-experience-epic
type: task
phase: intake
status: backlog
created: 2026-06-21T14:24:00Z
last_modified: 2026-06-21T14:24:00Z
---

# Confirm the agent strips verdict/phase jargon; gloss CONFIDENT/BLOCKED

**Goal:** Verify the mediation actually lands in replies, and define the invented verdict labels on first use.

**Why (audit M3):** The per-prompt reminders ("Phase: scenario-gate. AODI…") and stop verdict (CONFIDENT/BLOCKED, RED/GREEN/REFACTOR) are agent-context instructions that *tell* the agent to produce plain output — mechanism working, not a direct dead-end. Residual risk: an NTB reading the transcript still sees untranslated reminders, and the verdict's own `**CONFIDENT**`/`**BLOCKED**` labels surface verbatim with no definition. Lower severity; the design intent is sound.

## Scope sketch

- Verify (transcript spot-check / test) that the agent strips phase/AODI vocabulary from user-facing replies per the contract.
- Gloss CONFIDENT/BLOCKED on first use in a turn, or in the verdict template, so the NTB meets a definition.
- Files: `hooks/lib/quality.ts` (verdict template), `prompt-questions.ts` (reminder phrasing) if needed.
- Out of scope: H1 (the governing contract) — this is the verification fast-follow.

## Work Log

- 2026-06-21T14:24:00Z Created from PRODUCT-AUDIT-ntb.md M3.
