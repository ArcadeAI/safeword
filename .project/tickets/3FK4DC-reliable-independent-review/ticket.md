---
id: 3FK4DC
slug: reliable-independent-review
type: task
phase: verify
status: in_progress
external_issue: https://github.com/ArcadeAI/safeword/issues/2386
created: 2026-08-11T16:09:09.448Z
last_modified: 2026-08-11T17:55:00.000Z
---

# Make independent review failures actionable

**Goal:** Make installed-reviewer discovery, failure diagnosis, and evidence packet roles reliable in Codex-hosted reviews.

**Why:** Opaque capability failures and undifferentiated evidence files make required independent review unreliable on realistic packets.

## Work Log

- 2026-08-11T17:55:00Z REVIEW: Final focused packet hardening completed through Claude with `actual_reviewer: claude`, `independence: cross-agent`, and an approve verdict with no blocking findings.
- 2026-08-11T17:48:00Z REVIEW FIX: Reviewer-controlled snapshot traversal failures now fail closed as typed mutation; 64 focused packet/public-wiring tests pass.
- 2026-08-11T17:25:00Z VERIFY: Full unit/integration suite passed (7,603 tests; 6 skipped), build/type/dependency gates passed, and the three affected acceptance scenarios passed in isolation. The full 1,517-scenario lane had two unrelated retro-relay setup timeouts under load; both pass in 15 seconds when isolated.
- 2026-08-11T16:47:00Z REVIEW: Re-review approved with no blocking findings. Claude was consistently discovered and launched on both live passes but timed out; Safeword preserved `preferred_failure: timed_out` and visibly degraded fallback provenance.
- 2026-08-11T16:39:00Z GREEN: 88 focused tests pass after forwarding context through every review route and preserving typed discovery/probe failures through the public result.
- 2026-08-11T16:36:00Z REVIEW: Live Claude route was discovered and launched, then timed out accurately; degraded review found alternate-model context was dropped, so the route wiring and its public regression proof were corrected.
- 2026-08-11T16:13:00Z RED: Added public CLI, runtime, and packet tests for typed probe failures and target/context separation; implementation did not yet satisfy them.
- 2026-08-11T16:09:30Z Decided: Use typed capability assessment and explicit target/context packet roles; preserve PATH as the executable trust boundary.
- 2026-08-11T16:08:00Z Investigated: Current main has fixed five-minute attempt defaults and bounded route fallback. Remaining causes are boolean capability probing and undifferentiated packet files.
- 2026-08-11T16:09:09.448Z Started: Created ticket 3FK4DC

## Scope

- Report distinct reviewer discovery, compatibility-probe timeout, unsupported-capability, authentication, and launch failures through the public review result.
- Prove Claude selection through the public CLI with both a normal PATH fixture and a constrained-PATH failure.
- Let callers identify supporting context separately from review targets while keeping both bounded and untrusted.

## Out of Scope

- Searching guessed home-directory installation paths.
- Reopening reviewer timeout defaults or route-budget scheduling already covered on main.
- Allowing reviewers tools, repository access, or unbounded packet material.

## Done When

- [x] Public review JSON distinguishes missing, unsupported, probe-timeout, authentication, and launch failures with actionable recovery.
- [x] A compatible Claude executable on PATH is selected through the public CLI; a constrained PATH reports the exact discovery failure.
- [x] Supporting context reaches the reviewer but is explicitly excluded from the work product under review.
- [x] Existing callers that provide only positional targets retain their current behavior.

## Tests

- [x] RED/GREEN/REFACTOR: public CLI classifies each reviewer discovery/probe/launch boundary.
- [x] RED/GREEN/REFACTOR: review packet labels targets and context while enforcing shared containment and size bounds.
- [x] RED/GREEN/REFACTOR: legacy target-only command remains compatible.

## Root Cause

`supportsReviewContract` collapses every capability-probe outcome into a boolean, and
`runReviewerCandidates` maps every compatible-candidate miss to `not_installed`. This
conflates an absent executable with unsupported flags, a hung probe, and launch errors.
Authentication is classified later, but the public recovery text cannot identify the
failed boundary consistently.

Separately, `ReviewPacket.logical_files` has no role field and the public command accepts
only positional files. Supporting evidence is therefore presented as work under review,
which makes realistic packets ambiguous and can produce false findings.

Ruled out: short default deadlines and probe starvation. Current main uses a 300-second
attempt deadline, a 540-second run bound, and divides the route budget across candidates.
