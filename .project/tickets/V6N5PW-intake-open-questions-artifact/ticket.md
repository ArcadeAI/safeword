---
id: V6N5PW
slug: intake-open-questions-artifact
type: task
phase: done
status: done
epic: bdd-chain-hardening
parent: EECVXB
created: 2026-06-02T04:58:17.803Z
last_modified: 2026-06-02T15:10:00.000Z
---

# Tracked open-questions artifact in intake (Example-Mapping red-card parity)

**Goal:** Give intake a persistent, eyeball-able list of open questions — the equivalent of Example Mapping's red "question" cards — with a readiness signal, instead of leaving unknowns purely conversational.

**Why:** P3. The BDD-methodology comparison found this is the one genuine structural gap vs. canonical Example Mapping (Matt Wynne): red question-cards are first-class and their count is a readiness diagnostic ("a table covered in red … we still have a lot to learn"). Safeword surfaces open questions via propose-and-converge and the specificity self-test ([DISCOVERY.md](packages/cli/templates/skills/bdd/DISCOVERY.md)) but keeps them in conversation — there's no tracked list, so questions can fall through across sessions and there's no "too many unknowns → not ready" signal.

**Scope (to refine in Phase 0):** a tracked open-questions section — likely in `spec.md` or a `questions.md` sibling — that intake populates and resolves, with a soft readiness signal (many unresolved → not ready to advance). Mirror the existing `skip:`/resolved discipline so questions are auditable.

**Out of scope (tentative — confirm during intake):** a hard gate on question count (canonical Example Mapping uses a thumb-vote, not a blocker — keep it advisory); changing the propose-and-converge flow itself.

**Done when (to firm up):** intake produces a persistent open-questions list; resolved vs. open is visible; an advisory surfaces when many remain unresolved at the intake-exit boundary.

**Note:** lowest priority in the epic; this is an enhancement, not a defect. Depends on no other child. Full Phase 0 (JTBD/AC/scope) still required before its scenarios.

## Work Log

- 2026-06-02T04:58:17.803Z Started: Created ticket V6N5PW
- 2026-06-02T15:02Z Reclassified feature→task. Shape decided: an `## Open Questions` section in the per-ticket spec.md (consistent with JTBD/AC), maintained during intake, with a SOFT readiness signal as conversational discipline — no hook gate (matches "advisory, never a gate" + the existing Phase 0 sub-gate model). RED: update ticket-writer.test.ts to expect a 7th section.
- 2026-06-02T15:07Z GREEN: added `## Open Questions` to spec-template.md (scaffolded comment, parses to zero); DISCOVERY.md now records unresolved questions there during Understanding and checks the section is resolved/deferred at the intake exit (soft, conversational — no hook gate). Synced spec-template + DISCOVERY dogfood copies. 55/55 spec-related tests pass (ticket-writer 7-section assertion green; phase0-walkthrough, jtbd, ac-gate, jtbd-gate unaffected); parity clean. Done-when met.
- 2026-06-02T15:10Z Complete: /verify green (full suite 2364/2364, lint+build clean; /audit this session). verify.md written. Closed — status/phase → done.
