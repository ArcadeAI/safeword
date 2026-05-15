---
id: 146
type: feature
phase: intake
status: in_progress
related: [143]
created: 2026-05-15T06:32:00Z
last_modified: 2026-05-15T06:32:00Z
scope: |
  Restructure the `/verify` skill's output report so it cleanly separates
  three concerns: (1) status facts (test counts, build/lint/scenario state),
  (2) decisions the user needs to make (spec/scope/value questions),
  (3) the agent's planned next actions (implementation work the agent owns).
  Currently the report mixes all three together, producing confusion when
  there are many unchecked scenarios or open questions.

  Applies the same spec-vs-implementation contract encoded in 143:
  implementation choices are the agent's to make and own; only spec/scope/
  value ambiguities go in the "user decisions needed" section. Caps on
  enumeration to prevent dump-style reports.
out_of_scope: |
  - Changing the stop-hook prompt (143 already done).
  - Changing what /verify actually checks (test suite, build, lint, scenarios,
    doc refs, dep drift). Only the output report's structure changes.
  - Changing how scenarios are tracked in test-definitions.md.
  - Auto-fixing identified gaps (still surfaces them; doesn't apply fixes).
  - The "test pinning the bug" failure mode from Nate's trace — separate concern,
    deferred unless recurs.
done_when: |
  - The `/verify` skill's instructions in `.claude/skills/verify/SKILL.md`
    (and synced template at `packages/cli/templates/skills/verify/SKILL.md`
    if applicable) produce output in three distinct sections with clear headings:
    "Status", "Decisions needed (spec/scope/value)", "Agent's next actions".
  - Each section has a hard cap on enumerated items (e.g., max 5; agent must
    triage and surface the load-bearing items).
  - "Decisions needed" section explicitly excludes implementation-path questions
    (mirrors 143's spec-vs-implementation contract).
  - "Agent's next actions" section is the propulsive surface — commits to
    concrete forward motion the agent will execute, not a list of options.
  - When all checks pass and no decisions are needed, the report collapses to
    a single CONFIDENT-style verdict (no empty sections).
  - At least one realistic test case (synthetic ticket with N unchecked
    scenarios + mixed decision types) shows the new output shape is clearer
    than current.
---

# /verify output shape: status / decisions / next-actions separation

**Goal:** Restructure the `/verify` skill's report so it cleanly separates status facts, user-decision questions, and agent next-actions. Eliminate the dump-style "everything in one verdict" pattern.

**Why:** Customer trace (Nate, 2026-05-14) ran `/verify` and described the output as "felt a little confused at what it was asking me." The report mixed 14 unchecked scenarios + elaborate triage + multiple "open questions embedded in the verdict" — making it hard to tell what's status vs. what needs user input vs. what the agent will do next. 143 fixed the stop-hook prompt; this fixes the analogous problem on the `/verify` surface.

## Customer trace excerpts (problem evidence)

From Nate's `/verify` invocation on slice 3:

> "**Scenarios:** ❌ 29/43 complete (14 unchecked — see breakdown below)"
> "### Unchecked Scenarios (14) Triaged by category: **(A) In-scope gaps that need attention before close (likely implementation gaps, not just missing tests):** ..."
> "**Three options:** A. Change the existence-check (recommended): ... B. Amend the spec: ... C. Defer to a separate ticket: ..."

The structure that confused: triage + recommendations + decision-asks + plans were interleaved. The user had to parse what's evidence vs. what's a request for input.

## Adjacent work

- **143** (just shipped on PR #91) — encoded the spec-vs-implementation contract in the stop-hook prompt. This ticket applies the same contract to the `/verify` surface.

## Open Questions (resolve in define-behavior)

- **Hard cap on enumerated items per section** — N=5 feels right intuitively, but could be 3 or 7. Worth empirical testing on realistic tickets. Lean: 5.
- **When MANY items exist** — e.g., 14 unchecked scenarios as in Nate's trace — does the report list the top 5 most-load-bearing and aggregate the rest ("9 others, see test-definitions.md"), or does it always surface all 14? Lean: triage and aggregate; force the agent to identify "what does the user actually need to act on."
- **Where the verify skill template lives** — verify if there's a templated copy that ships to customers (`packages/cli/templates/skills/verify/SKILL.md`) vs. just the local `.claude/skills/verify/SKILL.md`. Adjusts scope of edits.
- **Whether the "Decisions needed" section should support empty state** — if no decisions are required, does the section appear with "None" or disappear entirely? Lean: disappear (no empty sections in clean reports).
