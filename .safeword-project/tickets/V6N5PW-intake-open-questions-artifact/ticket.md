---
id: V6N5PW
slug: intake-open-questions-artifact
type: feature
phase: intake
status: in_progress
epic: bdd-chain-hardening
parent: EECVXB
created: 2026-06-02T04:58:17.803Z
last_modified: 2026-06-02T04:58:17.803Z
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
