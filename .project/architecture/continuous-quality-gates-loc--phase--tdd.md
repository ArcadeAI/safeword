# Continuous Quality Gates (LOC + Phase + TDD)

[Done-phase evidence](hard-block-for-done-phase-stop-decision-block.md).

**Status:** Accepted
**Date:** 2026-02-07 (updated 2026-03-20: added phase access control, meta-path exemption, null→phase skip, shared active-ticket module)

**What.** PostToolUse hook counts changed lines via `git diff --stat HEAD` and binds `activeTicket` on ticket.md edits. Phase and TDD step are derived at read time from ticket files, not cached.

**Why.** Prevents 1000-line PRs; forces commit discipline. Phase/TDD derivation avoids stale cache in multi-session/multi-developer scenarios.

**Trade-off.** Adds ~50ms per tool call (git diff + ticket scan); per-session state in `<namespace-root>/quality-state-{sessionId}.json`

**Alternatives.** LOC check in stop hook only (rejected: too late), commit-prefix detection (rejected: convention-based, bypassable), manual discipline (rejected)

**Implementation.** `packages/cli/templates/hooks/post-tool-quality.ts` + `pre-tool-quality.ts`; per-session state files; shared `lib/active-ticket.ts` (includes `deriveTddStep()`)

**Gate types:**

- **LOC gate** (`loc`) — triggers when `git diff --stat HEAD` exceeds 400 LOC of project code; forces commit before more edits. Meta paths (`META_PATHS` in `hooks/lib/quality-state.ts`: `.safeword/`, `.claude/`, `.cursor/`, `.codex/`, `.agents/`, and the namespace root—`.project/` by default, legacy `.safeword-project/`) are excluded from the count via git pathspec, so setup convergence output doesn't inflate it.
- **Phase reminders** — prompt hook derives current phase from ticket.md via `getTicketInfo()` and injects phase-specific one-liner each turn. No blocking gate — guidance only.
- **TDD step reminders** — prompt hook derives TDD step from test-definitions.md via `deriveTddStep()` during `implement` phase. Shows RED/GREEN/REFACTOR status each turn.

**Phase-based access control:** PreToolUse reads the active ticket's phase directly from ticket files (via `lib/active-ticket.ts`). For features, `plan-implementation` is a code freeze (application edits are denied until `impl-plan.md` is done and the phase advances to `implement`), and `implement` requires `test-definitions.md` before application code. Planning phases (intake, define-behavior, scenario-gate, plan-implementation) are otherwise governed by phase-transition and artifact gates on ticket files, not by a blanket code-edit block. Tasks are exempt from the feature-only gates. No ticket or no in_progress ticket = no restriction.

**Meta-path exemption:** Files under `META_PATHS` (`.safeword/`, `.claude/`, `.cursor/`, `.codex/`, `.agents/`, `.project/`, legacy `.safeword-project/`) are always editable regardless of gates or phase. These are tooling/metadata, not application code. This prevents circular dependencies where a gate blocks editing the file that caused the gate.

**Active ticket resolution:** Session-scoped. Each session's state file (`quality-state-{session_id}.json`) tracks the `activeTicket` it's working on. Both `pre-tool-quality.ts` and `stop-quality.ts` read this session binding, then call `getTicketInfo()` to re-read the ticket's current phase and status from disk (stateless re-evaluation). Other sessions’ tickets cannot block this one. `getActiveTicket()` (global scan) is only used for hierarchy navigation after the done gate passes. Post-tool auto-clears `activeTicket` when the ticket reaches `done` or `backlog` status.

**TDD step detection:** PostToolUse watches `test-definitions.md` in ticket directories. Each scenario has three sub-checkboxes (`- [ ] RED`, `- [ ] GREEN`, `- [ ] REFACTOR`). The parser finds the first scenario with mixed checked/unchecked items and determines which step just completed. `.feature` files are the scenario source for authoring and acceptance runs, but `deriveTddStep()` reads only the `test-definitions.md` R/G/R ledger; a ticket without that ledger has no derived TDD step.

**Denied tool calls (#5760).** When PreToolUse denies a call, `permissionDecisionReason` gives the reason, the remedy, and an `/explain` hint. The hook omits `additionalContext`. Every host delivers the reason to the agent. Cursor and OpenCode’s exit-code mode discard `additionalContext`, so placing the remedy there hid it from those agents. Remedies still reference skills by name rather than inlining review content, which keeps skills the single owner of that content.

**Quality review cadence (SXSCJQ; implement-step reviews quieted by JENFZX):** The quality review fires at phase boundaries, not on a LOC throttle. PostToolUse surfaces a phase-appropriate review (`getQualityMessage`) as `additionalContext` on each `phase:` change in `ticket.md` — at the edit, so it works in long autonomous runs where the Stop hook never fires. Ordinary implement-step (RED/GREEN/REFACTOR) reviews no longer surface per step; they are folded into the whole-ticket review at the implement→verify exit (JENFZX). The Stop hook requests a review only if the session has not marked the phase boundary (`lastReviewedPhase` in session state). With no resolvable ticket phase — no active ticket, or one in a status escape hatch — a generic review is recorded once per user-prompt boundary: `stopQualityReviewAwaitingUserPrompt` keeps later idle Stops silent until `UserPromptSubmit` clears it, while typecheck, phase, and done gates remain independent. The former implement-phase LOC review throttle (`LOC_REVIEW_THRESHOLD`) is removed. Shared decision logic lives in `lib/review-trigger.ts` (`shouldReviewPhase`); checkbox-flip detection in `lib/checkbox-transitions.ts`.

**Cross-agent Stop delivery (JN403D/P30CRP):** Claude Code keeps the hard done-gate/review behavior in `stop-quality.ts`. Cursor uses a lighter local Stop adapter for continuation nudges (`cursor/stop.ts` appends `followup_message`). Codex uses the profile-scoped Safeword plugin, whose hook manifest calls the CLI bundled into that exact plugin version. It emits Codex continuation output (`decision: "block"`, `reason`) from queued project context. When a Codex ticket is closed by edit, Stop checks the owed ticket before allowing the session to finish. Failed evidence keeps the ticket owed on continuation Stops.

The [terminal handoff contract](terminal-handoff.md) governs completion messages across hosts.

**Codex Desktop session identity (S2CWBE):** Hook payload `session_id` and a
fresh Codex proof-bridge cache remain the preferred sources. When Codex Desktop
code-mode does not deliver the documented PreToolUse bridge, the shared
run-identity resolver may use non-empty `CODEX_THREAD_ID` as a Codex-only,
session-stable fallback. This comes after explicit and cached identities, never
uses `turn_id`, and is unavailable to explicit Claude and Cursor callers. The
single resolver is shared by invocation proof, review-stamp session binding,
and Codex Stop so all three address the same state key.

**Gate clearing.** When a commit changes `git rev-parse --short HEAD`, the gates clear automatically. The LOC gate cannot overwrite an active TDD gate.
