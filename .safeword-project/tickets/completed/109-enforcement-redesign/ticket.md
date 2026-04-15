---
id: '109'
title: 'Enforcement redesign: Natural Gates, Reminders, and Output Validation'
type: epic
phase: done
status: done
created: 2026-04-11
last_modified: 2026-04-15T04:22:00Z
related: '100, 101, 107'
children: '113, 112, 114, 115, 111, 124, 125'
---

## Goal

Replace hard blocking (pre-tool denies edits) with a three-layer enforcement model that lets the agent follow our BDD process with its own judgment:

1. **Natural gates** — artifact dependencies where the process enforces itself (can't TDD without scenarios, can't mark done without evidence)
2. **Reminders** — prompt hook injects phase/step context to catch drift on steps without natural gates
3. **Output validation** — done gate hard blocks until evidence proves the work is complete

Lean into what models are improving at (code quality), control for what they won't improve at (process sequencing, place-tracking, self-evaluation).

**Boundary:** Enforcement ensures the process is followed. Quality of each artifact's content is governed by the skills (DISCOVERY.md, SCENARIOS.md, TDD.md) and the propose-and-converge pattern (#100).

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

## Three Layers of Defense

### Layer 1: Natural gates (artifact dependencies)

The BDD process enforces itself through structural dependencies — not rules the agent must obey, but realities it can't bypass:

| Step                      | Natural gate                                                      | Type          | Why it can't be skipped                                         |
| ------------------------- | ----------------------------------------------------------------- | ------------- | --------------------------------------------------------------- |
| Understanding → Scenarios | PreToolUse hook checks ticket.md has Scope/Out of Scope/Done When | Hook-enforced | Can't create test-definitions.md without a complete ticket spec |
| Scenarios → TDD           | TDD skill reads test-definitions.md                               | Inherent      | No file = nothing to implement                                  |
| RED → GREEN               | Test must exist and fail                                          | Inherent      | Test literally fails                                            |
| GREEN → done              | Tests must pass                                                   | Hook-enforced | Stop hook runs test suite                                       |

**Hook-enforced gate for Understanding → Scenarios:** A PreToolUse hook on Write/Edit checks: if the target is `test-definitions.md`, validate that the ticket's `ticket.md` exists and has Scope, Out of Scope, and Done When sections. If missing, deny with actionable error: "Ticket spec is missing [section]. Complete understanding before writing scenarios."

This is the ONE structural gate added by this redesign — the highest-leverage transition point. Understanding determines the quality of everything downstream. A shallow understanding produces bad scenarios, bad tests, bad implementation. Preventing scenario creation without a complete spec is the single most valuable enforcement point.

**Implementation:** ~20-line check in pre-tool-quality.ts (or a dedicated hook). Parse ticket.md for required section headings. Not content quality — just structural presence. The agent has full judgment about WHAT to write in those sections.

**Strongest enforcement** — physics, not policy. 3 inherent gates + 1 hook-enforced gate at the critical transition.

### Layer 2: Reminders (prompt hook context injection)

For steps where artifact dependencies are weak, the prompt hook injects compressed state every turn:

| Step             | Why natural gate is weak                        | Reminder                                                |
| ---------------- | ----------------------------------------------- | ------------------------------------------------------- |
| GREEN → REFACTOR | Nothing structurally prevents skipping refactor | "TDD: GREEN. Next: refactor while keeping tests green." |
| Phase tracking   | Agent can lose its place in long sessions       | "Phase: implement. Scenario 3/5 in progress."           |
| Scope boundaries | Agent can drift beyond Out of Scope             | "Scope: [from ticket]. Out of Scope: [from ticket]."    |

**Catches drift** — the agent is reminded where it is and what's expected. Uses the agent's intelligence rather than fighting it.

### Layer 3: Output validation (done gate)

The hard backstop — can't declare done without proof:

- Tests must actually pass (hook runs the suite, not text-based)
- Features: all scenarios marked complete + audit passed
- Tasks: test evidence
- LOC gate: commit every ~400 lines (blast radius control)

**Catches everything else** — if the agent ignored reminders and skipped steps, the evidence requirements catch it at done. The backtracking cost is the penalty for ignoring reminders.

### How the layers interact

```
Agent tries to create scenarios without understanding
  → Layer 1 (natural gate): PreToolUse hook checks ticket.md → missing Out of Scope → write denied
  → Agent must complete understanding and write spec before scenarios

Agent wants to skip scenarios and jump to coding
  → Layer 1 (natural gate): TDD skill can't find test-definitions.md → nothing to implement
  → No hard block needed — the process doesn't have a next step without the artifact

Agent is at GREEN and wants to skip REFACTOR
  → Layer 1 (natural gate): weak — nothing structurally prevents skipping
  → Layer 2 (reminder): "TDD: GREEN. Next: refactor"
  → Layer 3 (output validation): REFACTOR checkbox not marked → done gate blocks

Agent declares done without running tests
  → Layer 3 (output validation): stop hook runs tests → they fail → hard block
```

## Longevity

- Better models need fewer reminders → prompt hook injection can shrink over time
- Better models still need done-gate evidence → organizational process doesn't change with model capability
- Reminder content is configurable per organization → your TDD flow, your phases
- Nothing fights the model → uses improving code quality while compensating for persistent sequencing weakness
- Hard blocks can be reintroduced if monitoring shows reminders aren't sufficient → start permissive, tighten if needed

## What Changes (Implementation)

### Heavily modified: pre-tool-quality.ts (~180 lines → ~70)

**Remove:**

- Phase access control — `PLANNING_PHASES` set and the block that denies edits during intake/define-behavior/scenario-gate/decomposition/done
- TDD step gates — the block that denies edits when `state.gate` starts with `tdd:`
- Phase transition gates — the block that denies edits when `state.gate` starts with `phase:`

**Keep:**

- LOC gate — block edits when `state.gate === 'loc'` (blast radius control, not process enforcement)
- META_PATHS exemption — `.safeword/`, `.claude/`, `.cursor/`, `.safeword-project/` never blocked

**Add:**

- Artifact prerequisite check — if target file is `test-definitions.md`, validate ticket.md exists and has Scope, Out of Scope, Done When sections. Deny with actionable error if missing. ~20 lines. This is the one structural gate at the highest-leverage transition.

**After:** This hook becomes two-purpose: LOC enforcer + artifact prerequisite checker. Everything else removed.

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

## BDD Phase File Changes

Changes to BDD skill files found during critical review. These reduce ceremony that doesn't earn its weight and increase agent judgment.

### SCENARIOS.md (Phase 3-4)

**Add to Phase 3, step 1:** "Draw from resolved questions during understanding to determine which behavioral space to cover." Connects understanding output to scenario input — currently only referenced in DISCOVERY.md's planning note, which the agent may have forgotten by Phase 3.

**Add to Phase 3, after step 2:** "Focus on key behaviors — happy path, critical edge cases, error cases. Avoid testing implementation details." Prevents scenario bloat (agent writing 15 scenarios for a 3-component feature).

**Phase 4 (validation):** Keep as separate phase — research supports distinct review step even for self-review (blind-spot gap between drafting and validation). Add Independence criterion:

| Criterion         | Check                          | Red flag                        |
| ----------------- | ------------------------------ | ------------------------------- |
| **Atomic**        | Tests ONE behavior             | Multiple When/Then pairs        |
| **Observable**    | Has externally visible outcome | Internal state only             |
| **Deterministic** | Same result on repeated runs   | Time/random/external dependency |
| **Independent**   | No ordering dependency         | "After Scenario 2 runs..."      |

Keep AOD structure (now AODI). Industry standard is BRIEF (Rose & Nagy) but AODI is more structural and mechanically checkable — better for AI agents.

### test-definitions-feature.md (template) — Major simplification

The current template is ~120 lines per feature with: status emojis, numbered Steps, Expected sections, Summary tables with coverage percentages, Skipped Tests Rationale, Test Execution commands, Last Updated date.

**Research:** High-level behavioral specs outperform step-by-step procedures for AI agents (Osmani 2026). Presenting too many detailed fields causes the AI to overlook later items.

**What the agent needs:** Given/When/Then + RED/GREEN/REFACTOR checkboxes.
**What the template adds as ceremony:** Status emojis (redundant with checkboxes), Steps (redundant with Given/When/Then), Expected (redundant with Then), Summary tables (tracking overhead), Skipped rationale (~5% relevance), execution commands (agent knows), Last Updated (never maintained).

**Proposed simplified template:**

```markdown
## Scenario: [Name]

Given [context]
When [action]
Then [outcome]

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR
```

Repeat per scenario. Cut everything else. If a human stakeholder needs a richer format, they can request it — don't pre-load ceremony the agent doesn't need.

### DECOMPOSITION.md (Phase 5)

**Add:** Optional note at entry: "Optional — skip if the architecture is clear from the converged proposal and the agent can sequence work naturally." The file currently reads as mandatory. DISCOVERY.md says it's optional but DECOMPOSITION.md doesn't know.

**Change 1:** Replace fixed dependency ordering (data → logic → API → UI → E2E) with a principle: "Order tasks so each builds on what's already working. Avoid building layers that depend on unfinished layers." Research (SWE-bench evaluations): top agents determine order dynamically; fixed ordering assumes greenfield and removes agent judgment. Risk of loose interpretation mitigated by the dependency principle itself.

**Change 2:** Soften test layer assignment. Current: static mapping (pure logic → unit, API → integration, flows → E2E). Change to: "Prefer the highest scope that covers the behavior with acceptable feedback speed." Aligns with Testing Trophy (Kent C. Dodds) and Google testing research. The feedback-speed qualifier prevents E2E drift — agent won't use E2E to test a pure function because it's unnecessarily slow.

### TDD.md (Phase 6)

**Change 1:** Remove line 7 announcement ("Entering implementation. TDD mode for each scenario."). Stale pattern — #100 removed announcements. Replace with: "Begin TDD for the first unchecked scenario."

**Change 2:** Soften outside-in ordering. Current: "E2E first → Integration → Unit." Research: no published evidence that E2E-first is optimal for AI agents. Pragmatic guidance says "most constraining test first." Change to: "Start with the most constraining test — usually E2E or integration. Test at the highest scope that covers the behavior with acceptable feedback speed."

**Change 3:** Lighten refactor invocation. Current: "Run /refactor for cleanup after GREEN." The /refactor skill enforces "one change → test → commit" cycle — heavyweight for renaming a variable. Change to: "Refactor if needed. For small changes (rename, extract helper), refactor directly. For structural changes, run /refactor."

### DONE.md (Phase 7) — Reorganize from 7 steps to 2 sections

Current: 7 numbered steps mixing quality, correctness, completeness, and bookkeeping. Research (Wang et al. 2023): LLMs treat unordered lists as unordered; explicit ordering within sections preserves sequencing.

**Proposed structure:**

```markdown
## Finish

1. Cross-scenario refactor if clear wins exist — run full test suite after to verify no regressions
2. Run /verify
3. Run /audit

## Close

1. Update parent epic if applicable
2. Update ticket: phase: done, status: done
3. Final commit
```

**What's removed:**

- BDD Compliance Self-Check (self-reporting unreliable — Huang et al. 2023; evidence requirements already validate)
- Flake Detection as a full step (move to testing guide; one-line note: "If tests are flaky, investigate before proceeding")

**What's reorganized:**

- Two conceptual sections (Finish = quality/correctness checks; Close = bookkeeping) instead of 7 flat steps
- Ordered lists within each section to preserve sequencing (research: LLMs reorder flat prose)
- Cross-scenario refactor gets explicit regression check (Microsoft AutoDev: final refactoring passes risk regressions)

**Result:** 7 steps → 2 sections with 3 ordered sub-steps each. Clearer cognitive model ("finish the work, then close the ticket") with reliable sequencing.

### stop-quality.ts — Scenario evidence: text matching → direct file reading

**Current:** Stop hook matches "All N scenarios marked complete" in the agent's last message (text pattern: `SCENARIO_EVIDENCE_PATTERN`). Fragile — SWE-bench found agents claim success ~40% more often than tests confirm.

**Proposed:** Replace text pattern matching with direct file reading — parse test-definitions.md, count `[x]` vs `[ ]` checkboxes, verify all are checked. Same structural reliability as running the test suite. ~15 lines of code.

This makes scenario verification "physics, not policy" — consistent with the natural gates philosophy. The hook reads the artifact directly, like it runs the test suite directly, rather than trusting the agent's prose.

**Audit evidence:** Keep as text matching for now ("Audit passed"). Audit produces qualitative assessment, not binary executable output. Future improvement: audit could write a structured result file.

### TDD.md — RED phase (Phase 6.1) — Simplification

**Critical finding: TDAD "TDD Prompting Paradox"** (arxiv 2603.17973). Verbose TDD workflow prompts increased regressions from 6.08% to 9.94% — worse than no intervention. Agents don't need to be told HOW to do TDD; they need to be told WHICH tests to check. Tested on open-weight models (Qwen3-Coder 30B).

**Change 1:** Remove "Load the testing skill and read testing guide" from RED step 1. Context overload degrades model accuracy (context rot research, arxiv 2510.05381). The testing skill auto-triggers when the agent writes tests. The guide should be consulted for specific questions, not front-loaded entirely.

**Change 2:** Simplify RED from 6 steps to 3:

1. Pick first unchecked scenario from test-definitions
2. Write a failing test for that behavior — state test type choice, must fail for the right reason (missing behavior, not syntax)
3. Mark `[x] RED`, commit: `test: [scenario name]`

Cut: separate guide loading step (auto-triggers), separate announce step (folded into step 2), over-specified procedure that TDAD shows degrades outcomes.

**Change 3:** Add tautological test to red flags table. Tests whose assertions mirror the implementation rather than specifying behavior independently — pass coverage metrics but catch no bugs. Established testing anti-pattern (Roy Williams, widely cited in AI testing literature).

| Flag                    | Action                                            |
| ----------------------- | ------------------------------------------------- |
| Test passes immediately | Rewrite — you're testing nothing                  |
| Syntax error            | Fix syntax, not behavior                          |
| Wrote implementation    | Delete it, return to test                         |
| Multiple tests at once  | Pick ONE                                          |
| **Tautological test**   | **Assert on behavior, not implementation mirror** |

### testing/SKILL.md — One consistency fix

Line 22: "prefer the highest scope that's practical" → add "with acceptable feedback speed" for consistency with DECOMPOSITION.md and TDD.md changes.

### TDD.md — GREEN phase (Phase 6.2) — One addition

**Add over-implementation warning** after step 1: "If you wrote more than the test requires, delete the excess. GREEN is minimal — REFACTOR adds quality." Documented agent failure mode — LLMs tend to write complete implementations at GREEN, violating the minimal principle (Beck "Canon TDD" 2023, practitioner consensus).

Keep GREEN at 5 steps — no research-backed reason to simplify (unlike RED where TDAD measured regressions from verbosity).

### TDD.md — REFACTOR phase (Phase 6.3-6.4)

**Merge 6.3 + 6.4 into one section.** Currently split into "REFACTOR - Clean Up" (4 lines) and "Mark & Iterate" (10 lines). These are sequential steps in one phase, not distinct activities. Merging reduces artificial separation.

Note: the main REFACTOR change (conditional invocation instead of mandatory `/refactor`) is already captured above in TDD.md Change 3.

### refactor/SKILL.md — One consistency fix

**Remove "Load the testing skill" from PROTECT phase** (line 59). Same pattern as RED phase fix — front-loading a 280-line skill file adds context rot risk. The testing skill auto-triggers when writing tests. Consistent with the "don't front-load reference docs" principle (context rot research, arxiv 2510.05381).

## Open Questions

- Should the prompt hook reminder include the full phase description, or just a one-line status? (Context budget tradeoff)
- Should reminders escalate in urgency if the agent repeatedly ignores them? ("You've been in GREEN for 3 edits without refactoring")
- How do we measure whether reminders are sufficient vs whether hard blocks need to return? (Monitoring/metrics)
- Does the prompt hook need to inject on every turn, or can it cycle reminders (phase on turn 1, TDD step on turn 2, scope on turn 3)? See John Lindquist's `promptCount % N` pattern for Claude Code hooks.
- Backtracking cost: natural gates prevent the worst case (skipping scenarios entirely — TDD skill can't proceed without test-definitions.md). Remaining risk is steps with weak natural gates (skipping refactor). If the agent ignores refactor reminders, the done gate catches it — but the agent backtracks to refactor code it wrote turns ago, which is less effective than refactoring immediately. Is the reminder sufficient for refactor, or does this specific step need stronger enforcement?

## Origin

Critique of enforcement system during ticket #100 conversation (2026-04-11). Research showed: process enforcement has no published evidence of proportional quality gains; output validation does. Models are scaling-resistant on process adherence but improving on code quality. Hard blocks create gridlock and rob the agent of intelligence.

## Work Log

- 2026-04-11T18:34Z Created: Captured from enforcement system critique
- 2026-04-11T21:14Z Updated: Evolved from two-layer (remind + validate) to three-layer (natural gates + reminders + output validation). Artifact dependencies as primary enforcement — physics, not policy.
- 2026-04-11T21:29Z Updated: Honest audit of natural gates. Understanding → Scenarios was instruction-based, not structural. Added PreToolUse artifact prerequisite check — one hook-enforced gate at the highest-leverage transition. 3 inherent + 1 hook-enforced natural gates.
- 2026-04-11T22:22Z Updated: Critical review of BDD phase files (SCENARIOS.md, DECOMPOSITION.md, TDD.md, DONE.md). Identified ceremony that doesn't earn its weight — removed compliance self-check, softened TDD ordering, lightened refactor invocation, connected understanding output to scenario input.
- 2026-04-11T22:40Z Updated: RED phase deep review. TDAD finding: verbose TDD prompts increase regressions. Simplified RED 6→3 steps, removed front-loading of reference docs, added tautological test red flag. Citations verified.
