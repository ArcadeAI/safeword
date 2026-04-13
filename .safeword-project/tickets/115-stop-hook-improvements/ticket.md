---
id: '115'
title: Stop hook improvements — structural scenario verification + simplified review
type: feature
phase: done
status: done
created: 2026-04-11
parent: '109'
related: '101'
---

## Goal

Two improvements to stop-quality.ts. Independent of the enforcement architecture changes (#114).

## Changes

### Scenario evidence: text matching → direct file reading

**Current:** Matches "All N scenarios marked complete" in agent's prose (`SCENARIO_EVIDENCE_PATTERN`). Fragile — SWE-bench found agents claim success ~40% more often than tests confirm.

**Proposed:** Parse test-definitions.md directly. Count `[x]` vs `[ ]` checkboxes. Verify all are checked. ~15 lines. Same structural reliability as running the test suite — "physics, not policy."

### Reduce quality review frequency (phase-boundary + LOC dirty flag)

**Current:** Quality review fires on every stop after any edit. Dogfooding data: 304 fires, ~5 useful catches (97% noise, 1.6% actionable). Research: alarm fatigue threshold is ~15% actionable (Joint Commission); Google 2024 found reducing redundant self-checks improved task completion ~12%.

**Proposed: Two triggers instead of every-stop:**

1. **Phase-boundary** — fire when `lastKnownPhase` changes (phase transitions). ~5-8 fires per feature instead of 304.
2. **LOC dirty flag** — fire when >50 LOC have changed since last review (catches significant mid-phase work). New state field: `locAtLastReview`.

**Mechanism:** Add `locAtLastReview` to quality-state.json. Stop hook checks: `(phase changed) OR (locSinceCommit - locAtLastReview > 50)`. If neither, skip quality review. After review fires, update `locAtLastReview = locSinceCommit`.

**Result:** Review fires at meaningful moments (phase changes, substantial edits) instead of every stop.

### Remove schema.ts warning from stop hook

**Current:** Schema.ts warning fires on every stop by running two `git diff` subprocess calls. Checks both uncommitted and committed-but-unpushed changes. Fired 35 times in one session after the schema change was already verified and committed.

**Why it fires endlessly:** It checks `git diff origin/main...HEAD` — the change persists in the diff until pushed to remote. Even after committing and verifying, the warning keeps firing.

**Why it's redundant:** The pre-push hook already runs targeted tests when schema.ts is modified — that's mechanical enforcement at push time. The stop hook warning is a reminder for something that's already enforced. Two `git diff` subprocess calls per stop for a redundant dogfood-only warning.

**Proposed:** Remove the schema reminder entirely from stop-quality.ts (lines 353-374). The pre-push test gate is the real enforcement. Saves two subprocess calls per stop.

**If the general "modified → verify" pattern is needed for other files in the future:** Build a proper mechanism at that point (file→warning→verified map in quality-state). Don't cache the current implementation — remove it.

### Separate lightweight from heavyweight checks

**Current:** All quality checks run on every stop — same weight regardless of what changed.

**Proposed:** Two tiers:

- **Lightweight (every stop):** Done gate evidence check only
- **Heavyweight (implement-phase LOC dirty flag only):** Quality review prompt fires when >50 LOC changed since last review. Other phases fire naturally (they're brief — 1-3 turns each).

### TDD-step-specific quality review messages

**Current:** Implement phase uses one generic message ("Is it correct? Could this be simplified?") regardless of TDD step.

**Proposed:** When quality review fires during implement, check `lastKnownTddStep` and use step-specific messages:

**Exact messages (3 checks each, self-contained, grounded in TDD.md + testing SKILL.md):**

**RED:**

```
SAFEWORD Quality Review (TDD: RED):

- Does the test fail for the right reason? (missing behavior, not syntax)
- Is it testing ONE observable behavior, not implementation details?
- Is the assertion independent of the implementation? (not mirroring the code under test)
```

**GREEN:**

```
SAFEWORD Quality Review (TDD: GREEN):

- Did you write only what the test requires? (GREEN is minimal — REFACTOR adds quality)
- Is the full test suite still passing? (show output, don't just claim)
- Did you introduce mocks that could be real dependencies instead?
```

**REFACTOR:**

```
SAFEWORD Quality Review (TDD: REFACTOR):

- Is there duplication or unclear naming to clean up?
- Could this be simpler without losing clarity?
- Tests still passing after refactoring?
```

**(none):** Current generic implement message.

Add these to `quality.ts` PHASE_MESSAGES. Low effort (~10 lines), fires 6-8 times per feature, each time more targeted than the generic message.

### Fix prompt hook RED reminder

**Current:** "TDD: RED. Next: write minimal code to pass." — describes GREEN's job during RED's turn.

**Proposed:** "TDD: RED. Write a minimal failing test for the next scenario." — tells the agent what to do NOW (write a lean test, one behavior, one assertion, minimal setup).

### Rewrite all PHASE_MESSAGES (imperatives, aligned with skills)

Research: imperatives ("Verify...", "Confirm...") outperform questions ("Is it...?") for agent compliance. 3-5 items optimal per prompt. Current messages use questions and some exceed 5 items.

**intake → understanding (3 imperatives, aligned with DISCOVERY.md):**

```
SAFEWORD Quality Review (Understanding Phase):

- Verify scope is clear and bounded (scope, out_of_scope, done_when in frontmatter).
- Confirm failure modes and edge cases were surfaced.
- Check that open questions are resolved, not left vague.
```

**define-behavior (3 imperatives, AODI, aligned with SCENARIOS.md):**

```
SAFEWORD Quality Review (Scenario Phase):

- Verify each scenario is AODI: Atomic (ONE behavior), Observable (externally visible), Deterministic (repeatable), Independent (no ordering dependency).
- Confirm happy path, failure modes, and edge cases are covered.
- Avoid testing implementation details — test behaviors.
```

**scenario-gate (3 imperatives, AODI, aligned with SCENARIOS.md Phase 4):**

```
SAFEWORD Quality Review (Scenario Gate):

1. List validated scenarios.
2. Confirm each is AODI: Atomic, Observable, Deterministic, Independent.
3. Show issues found or "No issues."
```

**decomposition (3 imperatives, aligned with updated DECOMPOSITION.md):**

```
SAFEWORD Quality Review (Decomposition Phase):

- Optional — skip if architecture is clear from the proposal.
- If decomposing: verify tasks are ordered so each builds on what's working.
- Confirm test scopes match behavior (highest scope with acceptable feedback speed).
```

**done (5 imperatives — process reflection + mechanical verification, aligned with DONE.md Finish/Close):**

```
SAFEWORD Quality Review (Done Phase):

1. Check scenario coverage: did implementation reveal behaviors not in test-definitions?
2. Check scope drift: does the final implementation match ticket scope and done_when?
3. Cross-scenario refactoring done (if clear wins exist)?
4. Run /verify — show "✓ X/X tests pass" and "All N scenarios marked complete."
5. Run /audit — show "Audit passed."
```

Items 1-2 are process-flow reflection (catches scenario gaps, scope drift). Item 3 is cross-cutting code quality. Items 4-5 are mechanical verification. No separate "process review" firing — folded into done to avoid alarm fatigue.

### Audit evidence (future improvement)

Keep as text matching ("Audit passed") for now. Audit produces qualitative assessment, not binary output. Future: audit could write structured result file for direct reading.

## Research basis

- SWE-bench: agents claim success ~40% more than tests confirm (text matching is fragile)
- SWE-agent, Devin: verify by reading artifacts directly, not parsing prose
- Anthropic tool-use guidance: verify state by reading files/APIs, not agent prose
- Alarm fatigue: Joint Commission — below ~15% actionable rate, clinicians ignore 70-99% of alerts. Our 1.6% (5/304) is deep in learned helplessness zone.
- Google 2024 "LLM Agent Reliability": reducing redundant self-checks improved task completion ~12%
- Dogfooding data: 304 stop hook fires, ~5 useful catches. See `.safeword-project/learnings/dogfooding-enforcement-session.md`

See also `.safeword-project/learnings/agent-behavior-research.md`

## Already done (by parallel session + this session)

**Non-done quality review prompt rewritten.** "Double check and critique" → "Review your work critically" with specific actionable checklist. Provenance section added. (parallel session)

**Remaining work:**

- Scenario evidence: text → file reading (~15 lines)
- Remove schema.ts warning (pre-push hook is real enforcement)
- LOC dirty flag for implement-phase review frequency
- TDD-step-specific implement messages (RED/GREEN/REFACTOR)
- Align PHASE_MESSAGES with current skills (AODI, optional decomp, done with process reflection)
- Lightweight/heavyweight tier separation
- Fix prompt hook RED reminder ("write minimal code" → "write a failing test")

## Work Log

- 2026-04-11T23:17Z Created: Extracted from #109 epic (Group 2)
- 2026-04-12T00:27Z Note: Parallel session already rewrote stop hook implement-phase prompt.
- 2026-04-12T17:55Z Updated: Added frequency reduction mechanism (phase-boundary + LOC dirty flag), verified-state caching, lightweight/heavyweight separation. Backed by dogfooding data (304 fires / 5 catches) and alarm fatigue research.
- 2026-04-12T19:30Z Updated: Added process-flow reflection to done PHASE_MESSAGE (scenario coverage gaps, scope drift). Folded into done message rather than separate firing to avoid alarm fatigue. Fixed prompt hook RED reminder. All PHASE_MESSAGES now specified with exact text.
