---
id: '109'
title: 'Enforcement redesign: Track and Remind, not Block and Gate'
type: feature
phase: intake
created: 2026-04-11
related: '100, 101, 107'
---

## Goal

Shift Safeword's enforcement model from hard blocking (pre-tool denies edits) to continuous reminding (prompt hook injects phase/step context). Keep output validation hard (done gate). Lean into what models are improving at (code quality), control for what they won't improve at (process sequencing, place-tracking, self-evaluation).

## The Problem

Hard deterministic blocks create gridlock states, rob the agent of intelligence, and fight against where models are heading. But removing all enforcement lets agents skip phases, forget refactor steps, and declare done prematurely — persistent weaknesses that don't improve with scaling.

## Design Principle

**Control for what models won't improve at. Lean into what they will.**

| Models will improve at          | Models won't improve at                      |
| ------------------------------- | -------------------------------------------- |
| Writing better code             | Following YOUR multi-step process            |
| Generating better tests         | Knowing when they're done                    |
| Understanding complex codebases | Maintaining process state over long sessions |
| Debugging from error messages   | Resisting the shortcut to "just build it"    |

Research basis: Multi-step process adherence is scaling-resistant (Anthropic "Sleeper Agents" 2024, METR task evaluations). "Lost in the middle" persists at 200K+ contexts (Liu et al. 2024). Models declare success prematurely (ARC Evals).

## Three Loops

### Outer loop (feature-level): Understanding → Sizing → Scenarios → Decomposition → Implementation

**Problem:** Agent jumps ahead to implementation, skipping thinking phases.
**Current:** Pre-tool hard blocks code edits during planning phases.
**Proposed:** Prompt hook injects current phase + what's needed next. Agent can proceed but the reminder persists every turn. Artifact dependencies are the natural gate — you can't start TDD without scenarios to implement against.

### Inner loop (task-level TDD): RED → GREEN → REFACTOR per task

**Problem:** Agent loses its place, skips refactor phase.
**Current:** Post-tool sets TDD gate, pre-tool hard blocks edits until commit.
**Proposed:** Post-tool tracks step, prompt hook injects "you're at GREEN — refactor next." No hard block. The agent is reminded where it is every turn. If it skips refactor, the done gate catches it (incomplete scenario checkboxes).

### Wrap-up loop: Cross-task refactor → Verify → Audit → Done

**Problem:** Agent declares done prematurely without evidence.
**Current:** Hard block at done phase until test/scenario/audit evidence.
**Proposed:** Keep as-is. Output validation is the most defensible enforcement. Tests must actually pass (hook runs the suite). Features need scenario + audit evidence. No bypass.

## Enforcement Model

| Mechanism         | Current                                    | Proposed                                                 |
| ----------------- | ------------------------------------------ | -------------------------------------------------------- |
| Phase sequencing  | Pre-tool blocks edits in planning phases   | Prompt hook injects current phase + what's needed next   |
| TDD step tracking | Post-tool sets gate, pre-tool blocks edits | Post-tool tracks step, prompt hook reminds "you're at X" |
| Place tracking    | Session state in quality-state.json        | Same — but used for reminders, not gates                 |
| Done completeness | Hard block until evidence                  | **Keep as-is** — output validation                       |
| LOC checkpoint    | Hard block until commit                    | **Keep as-is** — blast radius control                    |
| Auto-lint         | Auto-fix on every edit                     | **Keep as-is** — zero-cost, high-value                   |
| Config guard      | User approval for config edits             | **Keep as-is** — protecting shared resources             |
| Bypass warnings   | Advisory flags for suppressions            | **Keep as-is** — zero-cost awareness                     |

## Two Layers of Defense

1. **Continuous reminders** (prompt hook re-injects phase/step every turn) — catches drift before it happens
2. **Output validation at done** (hard gate on evidence) — catches skipping after the fact

The reminders lean into context injection (where hooks excel). The done gate is the hard backstop. Everything in between is the agent's judgment.

## Longevity

- Better models need fewer reminders → prompt hook injection can shrink over time
- Better models still need done-gate evidence → organizational process doesn't change with model capability
- Reminder content is configurable per organization → your TDD flow, your phases
- Nothing fights the model → uses improving code quality while compensating for persistent sequencing weakness
- Hard blocks can be reintroduced if monitoring shows reminders aren't sufficient → start permissive, tighten if needed

## What Changes (Implementation)

### Heavily modified: pre-tool-quality.ts (~180 lines → ~50)

**Remove:**

- Phase access control — `PLANNING_PHASES` set and the block that denies edits during intake/define-behavior/scenario-gate/decomposition/done
- TDD step gates — the block that denies edits when `state.gate` starts with `tdd:`
- Phase transition gates — the block that denies edits when `state.gate` starts with `phase:`

**Keep:**

- LOC gate — block edits when `state.gate === 'loc'` (blast radius control, not process enforcement)
- META_PATHS exemption — `.safeword/`, `.claude/`, `.cursor/`, `.safeword-project/` never blocked

**After:** This hook becomes a single-purpose LOC enforcer.

### Modified: post-tool-quality.ts (~238 lines)

**Keep as-is:**

- Phase change detection (reads ticket.md frontmatter, tracks `lastKnownPhase`)
- TDD step detection (parses test-definitions.md sub-checkboxes, tracks `lastKnownTddStep`)
- LOC accumulation tracking (git diff --stat, counts insertions + deletions)
- Active ticket binding (tracks `activeTicket` from ticket.md id field)

**Change:**

- LOC threshold: still sets `state.gate = 'loc'` (pre-tool enforces this)
- TDD step transitions: stop setting `state.gate = 'tdd:*'`. Instead, only update `state.lastKnownTddStep` for prompt hook consumption.
- Phase transitions: stop setting `state.gate = 'phase:*'`. Instead, only update `state.lastKnownPhase` for prompt hook consumption.

**Net effect:** State detection unchanged. Gate-setting removed for TDD/phase (kept for LOC only). Same data flows to prompt hook instead of pre-tool.

### Modified: stop-quality.ts (~377 lines)

**Keep as-is:**

- Done phase hard blocks (tests must pass, features need scenario + audit evidence)
- Cumulative artifact check (features at scenario-gate+ must have test-definitions.md)
- Hierarchy navigation after done (cascade done, find next work)
- Usage limit detection

**Change:**

- Non-done quality review: simplify the generic "double check everything" prompt. Make it phase-specific and less frequent. (Overlaps with ticket #101 scope.)

### Extended: prompt-questions.ts (~18 lines → ~40)

**Keep:**

- Current two lines: "Contribute before asking..." and "When proposing..."

**Add:**

- Read quality-state.json (per-session state file)
- If active ticket with known phase/step, inject one-line phase-aware reminder:
  - `"Phase: define-behavior. Next: write scenarios from your proposal."`
  - `"TDD: GREEN. Next: refactor while keeping tests green."`
  - `"Phase: implement. Scenario 3/5 in progress."`
- If no active ticket or no phase, inject nothing extra (current behavior)

**Constraints:**

- Keep total injection under ~150 tokens. The two existing lines + one status line.
- Use compressed cognitive state (one bounded status line), not accumulated context. Research (Anthropic context engineering, ACE paper arXiv 2510.04618) warns naive repeated injection causes "context collapse" — details erode as transcript grows. One structured status line avoids this.

### Updated: SAFEWORD.md

- Update enforcement description to reflect remind model
- Remove references to "edits blocked during planning phases"
- Add: "Safeword tracks your phase and TDD step, reminding you each turn. The done gate requires evidence."

## What Doesn't Change (9 hooks untouched)

- **post-tool-lint.ts** — Auto-lint on every edit
- **post-tool-bypass-warn.ts** — Warns about eslint-disable, @ts-ignore, test.skip
- **pre-tool-config-guard.ts** — User approval for config edits
- **prompt-timestamp.ts** — Injects current time
- **session-version.ts** — Displays Safeword version
- **session-verify-agents.ts** — Verifies AGENTS.md link
- **session-lint-check.ts** — Checks lint config exists
- **session-compact-context.ts** — Re-injects ticket context after compaction
- **session-cleanup-quality.ts** — Cleans stale session state files

Also unchanged:

- Done gate (tests + scenarios + audit for features)
- LOC gate (commit every ~400 lines)
- quality-state.json structure and per-session state files
- Ticket frontmatter tracking (phase, type, status)

## Open Questions

- Should the prompt hook reminder include the full phase description, or just a one-line status? (Context budget tradeoff)
- Should reminders escalate in urgency if the agent repeatedly ignores them? ("You've been in GREEN for 3 edits without refactoring")
- How do we measure whether reminders are sufficient vs whether hard blocks need to return? (Monitoring/metrics)
- Does the prompt hook need to inject on every turn, or can it cycle reminders (phase on turn 1, TDD step on turn 2, scope on turn 3)? See John Lindquist's `promptCount % N` pattern for Claude Code hooks.
- Backtracking cost: if the agent ignores reminders and skips scenarios, the cumulative artifact check (stop hook) catches it — but the agent has to backtrack and write scenarios post-hoc, which is less valuable than writing them upfront. Is the reminder sufficient to prevent this, or does the cumulative artifact check need to fire earlier?

## Origin

Critique of enforcement system during ticket #100 conversation (2026-04-11). Research showed: process enforcement has no published evidence of proportional quality gains; output validation does. Models are scaling-resistant on process adherence but improving on code quality. Hard blocks create gridlock and rob the agent of intelligence.

## Work Log

- 2026-04-11T18:34Z Created: Captured from enforcement system critique
