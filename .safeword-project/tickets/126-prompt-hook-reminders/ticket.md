---
id: '126'
type: task
phase: done
status: done
created: 2026-04-15T04:14:00Z
last_modified: 2026-04-16T13:30:00Z
scope:
  - Add one-shot reminder to prompt-questions.ts when agent writes a learning file
  - Tests covering flag trigger (post-tool) and inject+clear (prompt hook)
out_of_scope:
  - Structural gates (no new artifact prerequisites or hard blocks)
  - Brainstorm → ticket handoff reminder (dropped — hooks can't detect skill activity, and brainstorm skill already has convergence check-in at line 32-35)
  - Changes to the brainstorm skill itself
  - Changes to the quality-review skill
  - Redesigning to use PostToolUse additionalContext (evaluated and rejected — see design notes)
done_when:
  - Post-tool hook sets novelResearchReminder flag in session state when file created in .safeword-project/learnings/
  - Prompt hook injects "Novel claim — verify with /quality-review before building on it" when flag is set, then clears it (one-shot)
  - Tests cover trigger and clear
---

# Prompt Hook Reminder for Research Validation

**Goal:** Add one conditional reminder to the prompt hook for a moderate-risk transition that doesn't warrant a structural gate.

**Why:** Dogfooding session (#121) revealed a research assumption ("prose over lists") was baked into design before validation, requiring 15 min rework when debunked. The quality review caught it, but earlier detection would have been cheaper.

## Design

**Reminder-tier** intervention per safeword's three-tier enforcement model (natural gates → reminders → output validation). Uses **one-shot firing with flag-and-clear**.

### Firing pattern: one-shot with flag-and-clear

Post-tool hook detects file creation in `.safeword-project/learnings/`. Sets `novelResearchReminder: true` in session state. Next prompt hook turn: inject reminder, clear flag. Agent sees it exactly once.

**Why one-shot:**

- ACE paper (arxiv 2510.04618): "naive repeated injection causes context collapse"
- Dogfooding: 304 quality review fires → 5 useful catches (97% noise)
- Stop hook quality review is the backstop if agent ignores the reminder

### Dropped: Brainstorm → ticket handoff reminder

Originally scoped as a second reminder. Dropped because:

- Hooks receive `tool_name` but not `skill_name` — no way to detect brainstorm skill activity
- Skills are prompt context, not tools. The hook system can't see which skill influenced the agent.
- The brainstorm skill already has a convergence check-in: "Sounds like we're converging on X — want me to pull this together?" (SKILL.md line 32)
- Adding unreliable detection duplicates an existing mechanism with worse accuracy

## Research basis

- ACE paper (arxiv 2510.04618): bounded state replacement, not raw accumulation
- Anthropic "Building Effective Agents": start simple, add complexity when needed
- TDAD (arxiv 2603.17973v2): procedural steps degrade performance — reminders are lighter weight
- Safeword dogfooding: high-frequency reminders = 97% noise

### Evaluated and rejected: direct PostToolUse additionalContext

An alternative approach would skip the state file entirely — PostToolUse outputs `{ additionalContext: "verify this claim" }` directly. Evaluated and rejected for five reasons:

1. **Timing:** Direct injection fires during the Write that creates the learning file. The dangerous moment is the _next_ turn, when Claude acts on the unverified claim. Flag-and-clear fires at the decision point.
2. **Output competition:** PostToolUse additionalContext competes with lint errors, bypass warnings, and quality gate messages on the same tool event. Prompt-questions output appears as a clean, isolated context block.
3. **Idempotency:** If Claude writes two learning files in one turn, direct injection fires twice (context accumulation). Flag-and-clear is idempotent — setting `true` twice produces one reminder.
4. **Debuggability:** All conditional reminders centralized in prompt-questions.ts. One file to inspect, one state file to check.
5. **Marginal cost:** The state file is already being written (LOC counts, active ticket, gates). Net new code is 7 lines across an established pattern.

## Work Log

- 2026-04-16T03:10:00Z Design review: Evaluated PostToolUse additionalContext as simpler alternative. Rejected — flag-and-clear wins on timing, idempotency, output isolation, and debuggability at ~7 lines marginal cost. Implementation already in place (post-tool-quality.ts:143-146, prompt-questions.ts:98-102, quality-state.ts:30). Remaining work: tests only.
- 2026-04-15T04:24:00Z Narrowed: Dropped brainstorm→ticket reminder. Hooks can't detect skill activity (skills are prompt context, not tools). Brainstorm skill already has convergence check-in. Kept only novel research reminder (clean structural trigger via learnings/ file creation).
- 2026-04-15T04:14:00Z Created: From #121 dogfooding observations. Originally two reminders, narrowed to one after research.
