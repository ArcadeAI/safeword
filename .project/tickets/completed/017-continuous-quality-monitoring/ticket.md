---
id: 017
type: epic
phase: intake
status: superseded
superseded_by: ['022', '024', '025']
created: 2026-01-10T20:00:00Z
last_modified: 2026-01-11T22:00:00Z
children: ['017a', '017b']
---

# Continuous Quality Monitoring for Long-Running Agent Sessions

> **Superseded by [022 - Hierarchical Work State Machine](../022-hierarchical-work-state/ticket.md)**
>
> This epic identified the problem and initial flat-state solution. Epic 022 provides the full solution with hierarchical state, unified context injection, and enforcement.

**User Story:** When I run `/bdd` for a complex feature, the agent may implement for 30+ minutes without stopping. I want quality checks to happen during that time so I don't discover a pile of compounding errors at the end.

**Goal:** Ensure quality checks happen at appropriate intervals during long BDD runs, not just when the agent stops for user input.

## The Problem

**Current quality check timing:**

| Hook        | When It Fires        | What It Checks      |
| ----------- | -------------------- | ------------------- |
| PostToolUse | Every file edit      | Linting only        |
| Stop        | Agent waits for user | Full quality review |

**BDD phases and typical duration:**

| Phase           | Duration    | Human Gate?        | Quality Review? |
| --------------- | ----------- | ------------------ | --------------- |
| intake          | 5-10 min    | Yes (questions)    | Stop hook fires |
| define-behavior | 10-15 min   | No                 | May not fire    |
| scenario-gate   | 2-5 min     | **Yes (approval)** | Stop hook fires |
| decomposition   | 5-10 min    | No                 | May not fire    |
| implement       | **30+ min** | No                 | **Gap!**        |
| done            | 5 min       | Yes (verification) | Stop hook fires |

**The gap:** Implement phase can run 30+ minutes without quality review. Agent may:

- Accumulate technical debt
- Drift from spec/scenarios
- Skip TDD commits (RED/GREEN/REFACTOR)
- Make compounding errors

## Solution: Flat State (017a/017b)

Two mechanisms using PostToolUse -> state -> PreToolUse pattern:

| Layer | Ticket | What It Does                 | Trigger                   |
| ----- | ------ | ---------------------------- | ------------------------- |
| 1     | 017a   | LOC-based commit enforcement | 400 LOC uncommitted       |
| 2     | 017b   | Phase transition gates       | Phase change in ticket.md |

> **Note:** These remain valid for simple flat-state enforcement. For hierarchical work tracking (nested epics/tickets/scenarios), see [022](../022-hierarchical-work-state/ticket.md).

### The Hook Timing Problem (Key Insight)

| Hook        | When        | Can Block? | Knows Changes? |
| ----------- | ----------- | ---------- | -------------- |
| PostToolUse | After edit  | **No**     | Yes            |
| PreToolUse  | Before edit | **Yes**    | No             |

**Solution:** State file bridges observation (PostToolUse) -> enforcement (PreToolUse).

### Single "Proceed" Action

Both gates clear on **commit**:

- Aligns with AGENTS.md: "commit after each GREEN phase"
- No new mechanisms - enforces existing best practice
- Git commits ARE the checkpoints

## TDD Cycle Enforcement

LOC gating (017a) naturally enforces TDD discipline:

| TDD Phase | Expected LOC | Commit             |
| --------- | ------------ | ------------------ |
| RED       | 20-50        | `test: [scenario]` |
| GREEN     | 50-150       | `feat: [scenario]` |
| REFACTOR  | 20-100       | Cleanup commit     |

Each cycle is ~100-300 LOC total. 400 LOC threshold catches agents not committing at GREEN.

### TDD Substate Tracking

017b tracks TDD progress during `implement` phase (tracking only, no blocking):

| State Field          | Source                             | Purpose                    |
| -------------------- | ---------------------------------- | -------------------------- |
| `lastCommitType`     | Parsed from commit message         | Infer expected next action |
| `scenariosCompleted` | `[x]` count in test-definitions.md | Progress tracking          |
| `scenariosTotal`     | Total `[ ]` + `[x]` count          | Progress tracking          |

Quality review displays: "TDD Progress: 2/5 scenarios. Last: test:, Expected: feat:"

## Phase-Specific Context Injection

Skills are soft enforcement—agents _may_ read phase files, but it's not guaranteed. 017b solves this by reading phase files at runtime and injecting them into gate messages:

| Phase             | Source File Read |
| ----------------- | ---------------- |
| `intake`          | DISCOVERY.md     |
| `define-behavior` | SCENARIOS.md     |
| `scenario-gate`   | SCENARIOS.md     |
| `decomposition`   | DECOMPOSITION.md |
| `implement`       | TDD.md           |
| `done`            | DONE.md          |

**Why read full files:** No drift (source IS the message), no "click through" needed, single source of truth. Phase files are small (~45-70 lines each).

## What We Removed / Moved

| Original                   | Decision             | Rationale                                              |
| -------------------------- | -------------------- | ------------------------------------------------------ |
| 017c: Hierarchical state   | **Extracted to 022** | Became its own epic with full scope                    |
| 017d: Smart quality review | **Moved to 021**     | Adds latency/cost. Core problem solved by 017a/017b.   |
| Time-based thresholds      | **Dropped**          | No timer hooks exist. LOC is the direct measure.       |
| Rich checkpoint metadata   | **Dropped**          | Not needed for rollback. Git log provides history.     |
| 200 LOC soft reminder      | **Dropped**          | Adds context without blocking. Just use 400 hard gate. |

## State File

**Flat state (017a/017b):**

```json
// .safeword-project/quality-state.json
{
  "locSinceCommit": 234,
  "lastCommitHash": "a1b2c3d",
  "lastKnownPhase": "implement",
  "phaseGate": null,
  "tdd": {
    "lastCommitType": "test",
    "scenariosCompleted": 2,
    "scenariosTotal": 5
  }
}
```

**Evolution:** See [022 - Hierarchical Work State](../022-hierarchical-work-state/ticket.md) for stack-based state with nested work items and history.

## Cursor Parity

| Mechanism       | Claude Code        | Cursor                       |
| --------------- | ------------------ | ---------------------------- |
| LOC enforcement | PreToolUse exit(2) | stop hook `followup_message` |
| Phase gates     | PreToolUse exit(2) | stop hook `followup_message` |

Cursor's `afterFileEdit` is fire-and-forget (can't block). Use stop hook for soft enforcement.

## Success Criteria (Flat State)

- [ ] PreToolUse blocks at 400 LOC since last commit
- [ ] PreToolUse blocks at phase transitions until commit
- [ ] Implement phase message includes TDD prompts (RED/GREEN/REFACTOR)
- [ ] Works during 30+ minute continuous execution
- [ ] Cursor gets soft enforcement via `followup_message`
- [ ] State persists in `.safeword-project/quality-state.json`

> **For hierarchical state criteria**, see [022](../022-hierarchical-work-state/ticket.md).

## Work Log

---

- 2026-01-11T22:00:00Z Superseded: Hierarchical state extracted to 022 as full solution
- 2026-01-11T21:27:00Z Added: TDD substate tracking (Option A - tracking only)
- 2026-01-11T21:15:00Z Revised: Read phase files at runtime (no hardcoded excerpts, no drift)
- 2026-01-11T17:15:00Z Added: Phase-specific context injection
- 2026-01-11T16:35:00Z Revised: Simplified to 2-layer architecture after deep research
- 2026-01-11T16:00:00Z Research: PostToolUse can't block, need PreToolUse for enforcement
- 2026-01-11T06:00:00Z Research: Context rot, checkpoint patterns, SubagentStop analysis
- 2026-01-10T20:31:00Z Added: User stories to epic and all subtickets
- 2026-01-10T20:23:00Z Refactored: Converted to epic with 4 focused subtickets
- 2026-01-10T20:00:00Z Created: Research complete, initial multi-layer solution designed

---
