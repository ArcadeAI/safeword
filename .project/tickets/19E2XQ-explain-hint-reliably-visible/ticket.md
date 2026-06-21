---
id: 19E2XQ
slug: explain-hint-reliably-visible
parent: K6CAJN-ntb-experience-epic
type: task
phase: intake
status: backlog
created: 2026-06-21T20:04:00Z
last_modified: 2026-06-21T20:04:00Z
---

# Make the /explain block-hint reliably reach the user (systemMessage)

**Goal:** Ensure the always-on `/explain` pointer on a gate block actually reaches the human's eyes — the passive safety net for when the agent misses the confusion-signal that 5XOUDJ's offer rule depends on.

**Why (figure-it-out on 5XOUDJ, option c):** EXPLAIN_HINT already rides inside `permissionDecisionReason` on hard blocks, but that field is unreliably shown to the user in Claude Code (bug [#17356](https://github.com/anthropics/claude-code/issues/17356)) — it can be swallowed before the NTB sees it. 5XOUDJ (option a) adds an agent-offered `/explain` on confusion-signal, but that leans on the agent _noticing_; if it misses, the NTB still slips through. This ticket is the higher-floor mechanism: a static, always-visible pointer that doesn't depend on the agent's judgment or the NTB reading docs.

## Scope sketch

- Surface the `/explain` pointer through `systemMessage` (the field verified to reach the user) on hard blocks, in addition to / instead of the `permissionDecisionReason` line. Confirm the actual rendering in Claude Code rather than trusting the field name.
- Touches the gate hooks (`pre-tool-quality.ts` deny, `stop-quality.ts` hardBlockDone) + their byte-identical dogfood copies — broader blast radius than 5XOUDJ, which is why it's split out.
- Keep it one line; this is a footnote, not a banner (TB skims past it). Verify the parity/contract tests still pass.
- Cross-agent: check whether Cursor/Codex block surfaces have an equivalent user-visible channel; if not, note the gap rather than forcing one.
- Out of scope: changing the EXPLAIN_HINT wording, the `/explain` skill, or the confusion-signal offer rule (shipped in 5XOUDJ).

**Evidence:** Claude Code skills/hooks docs + bug #17356, verified during the 5XOUDJ figure-it-out (2026-06-21).

## Work Log

- 2026-06-21T20:04:00Z Created as the (c) fast-follow from the 5XOUDJ figure-it-out — the always-visible safety net behind the agent-offered `/explain`.
