---
id: '115'
title: Stop hook improvements — structural scenario verification + simplified review
type: feature
phase: intake
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

- **Lightweight (every stop):** Done gate evidence check, schema staleness (if not verified)
- **Heavyweight (boundary-only):** Full quality review prompt — only at phase transitions or LOC dirty flag

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
- Quality review frequency: phase-boundary + LOC dirty flag
- Verified-state caching: schema.ts warning
- Lightweight/heavyweight separation

## Work Log

- 2026-04-11T23:17Z Created: Extracted from #109 epic (Group 2)
- 2026-04-12T00:27Z Note: Parallel session already rewrote stop hook implement-phase prompt.
- 2026-04-12T17:55Z Updated: Added frequency reduction mechanism (phase-boundary + LOC dirty flag), verified-state caching, lightweight/heavyweight separation. Backed by dogfooding data (304 fires / 5 catches) and alarm fatigue research.
