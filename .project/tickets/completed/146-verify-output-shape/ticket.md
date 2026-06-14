---
id: 146
type: feature
phase: done
status: done
related: [143]
created: 2026-05-15T06:32:00Z
last_modified: 2026-05-15T06:32:00Z
scope: |
  Update the `/verify` skill instructions (canonical templates at
  `packages/cli/templates/skills/verify/SKILL.md` and `packages/cli/templates/commands/verify.md`;
  sync runtime copies; 144's parity validates) to require the agent's
  additional commentary (when failures exist) to follow three clean sections
  beyond the existing Verify Checklist:

    (1) **Status** — facts only (already covered by existing checklist;
        the new structure makes the checklist the entire status section).
    (2) **Decisions needed (spec / scope / value)** — only questions the
        user must answer because they involve spec interpretation, scope
        boundaries, or value judgments. Implementation paths NEVER go here.
    (3) **Agent's next actions** — concrete forward motion the agent will
        execute (implementation work). Falsifiable, single-step framing.

  Hard cap of 5 items per section; aggregate the rest with count
  ("+ N others, see test-definitions.md"). Empty sections hidden.
  When all green and no decisions/actions needed, report collapses to a
  single-line "Ready to mark done" verdict.

  Preserves the existing evidence patterns (`✓ X/X tests pass`,
  `All N scenarios marked complete`, `Audit passed`) — done-gate hook
  depends on these and cannot move.
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

## Resolved Open Questions (intake-final)

Per the spec-vs-implementation contract (these are UX/implementation choices, agent's call):

- **Hard cap on enumerated items per section** → **N=5.** Research-backed: Cowan's working memory ~4 chunks; Miller's 7±2; N=3 too aggressive when many items exist; N=7 risks list-fatigue.
- **When MANY items exist** → **Top-5 by load-bearing, aggregate rest with count** ("+ 9 others, see test-definitions.md"). Forces the agent to triage what the user actually needs to act on.
- **Where the verify skill template lives** → confirmed via grep: three identical surfaces in SAFEWORD_SCHEMA.ownedFiles (templates/skills/verify/SKILL.md, templates/commands/verify.md, .cursor/commands/verify.md) plus runtime copies. Edit canonical templates; 144's parity validates.
- **Empty-section handling** → **hide empty sections entirely.** When all checks pass and there are no decisions or agent-next-actions, the report collapses to a single-line "Ready to mark done" verdict. Cleaner; no ceremony when there's nothing to communicate.

## Constraints discovered during investigation

The existing /verify report has **evidence patterns** the done-gate hook validates:

- `✓ X/X tests pass`
- `All N scenarios marked complete`
- `Audit passed`

These cannot be moved or renamed without breaking `stop-quality.ts`'s done-phase gate. The new sectioning must preserve them in the Status section.
