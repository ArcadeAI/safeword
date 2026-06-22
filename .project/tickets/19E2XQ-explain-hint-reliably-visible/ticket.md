---
id: 19E2XQ
slug: explain-hint-reliably-visible
parent: K6CAJN-ntb-experience-epic
type: task
phase: done
status: done
created: 2026-06-21T20:04:00Z
last_modified: 2026-06-22T03:54:00Z
---

# Make the /explain block-hint reliably reach the user (Claude systemMessage)

**Goal:** Ensure the always-on `/explain` pointer on a gate block actually reaches the human's eyes on Claude Code — the passive safety net for when the agent misses the confusion-signal that 5XOUDJ's offer rule depends on.

**Why (figure-it-out on 5XOUDJ option c, + cross-agent figure-it-out):** `EXPLAIN_HINT` already rides inside `permissionDecisionReason` / `reason` on hard blocks, but that field is shown to the _model_, not reliably to the _user_ in Claude Code (bug [#17356](https://github.com/anthropics/claude-code/issues/17356)). `systemMessage` is the documented top-level field that shows to the user, valid on all hook events.

## Approach (converged) — augment, don't replace

Keep `EXPLAIN_HINT` in `permissionDecisionReason` / `reason` AND add a top-level `systemMessage: EXPLAIN_HINT` on the hard-block paths. Two reasons replace loses:

- The Codex adapter (`codex/pre-tool-quality.ts:127`) reads the hint **out of `permissionDecisionReason`** to forward to Codex stderr — removing it there would silence Codex.
- The model still needs the reason text in its own context to act on the block.

So `systemMessage` is purely additive: one constant (`EXPLAIN_HINT`), surfaced through a second, user-reliable channel.

## Scope

- Add `systemMessage: EXPLAIN_HINT` to `pre-tool-quality.ts` `deny()` output and `stop-quality.ts` `hardBlockDone()` output — template + byte-identical dogfood copies (4 files).
- Leave `permissionDecisionReason` / `reason` exactly as-is.
- Run the hook test suite (`tests/hooks/`); add/extend a test asserting `systemMessage` carries the hint on a deny + a done-block.

## Cross-agent (from the cross-agent figure-it-out, 2026-06-22)

- **Codex:** already covered — `codex/pre-tool-quality.ts` forwards the deny reason (incl. the hint) to stderr + `exit 2`, which Codex surfaces. **Verify-only** (confirm in a live Codex block); no code change expected.
- **Cursor:** out of scope — Cursor has no deny/block gate to attach a hint to, and no `/explain` command at all. Spun out as **DC6276** (ship `/explain` to Cursor), the real Cursor gap.

## Out of scope

- Changing the `EXPLAIN_HINT` wording or the `/explain` skill.
- The confusion-signal offer rule (shipped in 5XOUDJ).
- Any Codex or Cursor code (Codex verify-only; Cursor is DC6276).

## Premortem

If `systemMessage` turns out not to surface on the **Stop** hook (docs confirm it for PreToolUse; Stop is "every event" but unexampled), the done-block hint still rides the `reason` field as today — no regression — but the reliability win would be PreToolUse-only until verified live. Confirm Stop rendering in a real Claude Code session before claiming the done-gate is covered.

**Evidence:** Claude Code Agent-SDK hooks docs (`systemMessage` is the user-facing field, coexists with deny) + bug #17356, verified 2026-06-22.

## Work Log

- 2026-06-21T20:04:00Z Created as the (c) fast-follow from the 5XOUDJ figure-it-out.
- 2026-06-22T03:46:00Z Reshaped after the cross-agent figure-it-out: Claude `systemMessage` augment (this ticket), Codex verify-only, Cursor spun out to DC6276. Approach converged to augment-not-replace (Codex adapter + model both read the reason field).
