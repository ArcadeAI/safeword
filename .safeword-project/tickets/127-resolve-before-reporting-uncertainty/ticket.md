---
id: '127'
type: patch
phase: implement
status: backlog
created: 2026-04-15T04:53:00Z
last_modified: 2026-04-15T04:53:00Z
scope:
  - Change quality review implement-phase prompt from "state uncertainty" to "resolve uncertainty, then state what remains"
out_of_scope:
  - New hooks, gates, or skill triggers
  - Changes to other phase messages (intake, done, etc.)
  - Automated detection of uncertainty severity
done_when:
  - lib/quality.ts implement-phase message says "If uncertain about something that affects correctness, research it now. State what remains uncertain after research."
  - Template synced
---

# Resolve Before Reporting Uncertainty

**Goal:** Change the stop hook quality review from declaring uncertainty to resolving it first.

**Why:** Dogfooding session (#121) showed a repeated pattern: agent states "most uncertain about X" in quality review, human says "go research that," agent resolves it. The human decider step is valuable but the initial "state uncertainty" instruction produces passive declaration instead of active resolution. One line change in the prompt shifts the agent toward resolving before reporting.

## Change

`lib/quality.ts` line 65, implement-phase message:

```diff
  - Is it correct?
  - Could this be simplified without losing clarity?
  - Does it follow latest docs and research? If unsure, say so — don't guess.
- - If questions remain: research first, then ask targeted questions.
+ - If uncertain about correctness, research it now.
  - Report findings only. No preamble.
- - State what you're most uncertain about.
+ - State what remains uncertain after research.
```

## Why this approach

- Fires at the right moment (stop boundary — after work, before session ends). The soft block creates a normal agentic turn with full tool access (WebSearch, Read, Agent, etc.), so "research it now" means actual web research, not just "think harder"
- Zero new infrastructure (one line change in existing prompt)
- Aligns with Opus 4.6's improved self-correction ("more carefully revisits its reasoning")
- Doesn't suppress honesty — agent still reports remaining uncertainty, just after attempting resolution
- Human decider pattern preserved — user can still push "go deeper" on remaining uncertainties

## Rejected alternatives

- **Self-trigger quality-review skill:** Adds 50-200 tokens/turn for relevance eval. Interrupts mid-work flow. Stop hook already fires at the natural boundary.
- **Stop hook re-blocks on stated uncertainty:** Incentivizes suppressing honesty. Agent learns to not state uncertainty to avoid re-blocking.
- **Add to prompt hook (every turn):** ACE paper context collapse. 97% noise from dogfooding.

## Work Log

- 2026-04-15T04:59:00Z Tightened: Simplified diff to "If uncertain about correctness, research it now." Qualifier "correctness" is narrow enough to avoid trivial research, broad enough to catch real issues. Removed clunky "or" join. Confirmed soft-block gives full tool access (WebSearch, Agent, etc.) during quality review response.
- 2026-04-15T04:53:00Z Created: One-line prompt change. Shifts quality review from passive uncertainty declaration to active resolution. Derived from #121 dogfooding pattern where human consistently pushed "go research that" on stated uncertainties.
