# Test Definitions — Ticket 146

> **Retrospective ledger — not a per-step record.** These RED/GREEN/REFACTOR
> boxes were filled in after the fact: the file entered git history already
> ticked, with no per-step commit SHAs. Do not cite this ledger as precedent
> for R/G/R bookkeeping (issue #644 G8; per-step enforcement is G3 + G5).

> 5 rules, 13 scenarios. AODI validated. Covers happy path + failure modes + boundaries.
>
> **Test surface:** Most scenarios test the content of the verify skill markdown (canonical at `packages/cli/templates/skills/verify/SKILL.md` and `packages/cli/templates/commands/verify.md`). Substring/regex assertions on the skill instructions, similar to how 143 tested `getQualityMessage` output content.
>
> **Manual verification:** the skill is _instructions for the agent_, not a pure function. Final acceptance includes a manual smoke run of `/verify` on a synthetic ticket with mixed unchecked scenarios + decisions to visually confirm the new format reads cleanly. This is documented in done_when, not in unit tests.

## Rule: Status section preserves existing checklist + done-gate evidence patterns

> Rationale: The done-gate hook in `stop-quality.ts` validates specific evidence patterns. Moving or renaming them would break the gate. The new structure must preserve them in the Status section.

- [x] Skill instructions specify the Status section uses the existing Verify Checklist format unchanged
- [x] Skill instructions list the three preserved evidence patterns (`✓ X/X tests pass`, `All N scenarios marked complete`, `Audit passed`)

## Rule: Decisions section contains only spec/scope/value questions

> Rationale: This is the core 143-derived contract applied to the /verify surface. Implementation-path questions never go in Decisions; they go in Agent's next actions. Eliminates the failure mode from Nate's trace (asking the user to decide between implementation options).

- [x] Skill instructions name the Decisions section "Decisions needed (spec / scope / value)"
- [x] Skill instructions explicitly state implementation-path questions belong in Actions, not Decisions
- [x] Skill instructions specify the Decisions section is hidden when empty (no "None" placeholder)
- [x] Skill instructions include at least one concrete example distinguishing spec/scope/value from implementation-path (anchors the classification for borderline cases)

## Rule: Actions section commits to concrete forward motion

> Rationale: Mirrors the propulsive-Next pattern from 143. Actions are the agent's planned execution; they must be concrete and falsifiable, not vague "explore X."

- [x] Skill instructions name the Actions section "Agent's next actions"
- [x] Skill instructions specify each action must be concrete and falsifiable (not vague exploration)
- [x] Skill instructions specify the Actions section is hidden when empty

## Rule: Hard cap N=5 per section; aggregate rest

> Rationale: Cowan's working memory ~4 chunks; Miller's 7±2. Forces triage. Customer trace showed 14 unchecked scenarios listed verbatim — too much.

- [x] Skill instructions specify a hard cap of N=5 items per section
- [x] Skill instructions specify the aggregation format when items exceed cap: "+ N others, see test-definitions.md"

## Rule: All-green collapse to single-line verdict

> Rationale: When everything passes and there's nothing for the user to act on, ceremony is noise. Single-line verdict matches the propulsive ethos of 143.

- [x] Skill instructions specify: when all green AND zero decisions AND zero actions, the report is a single-line "Ready to mark done" verdict
- [x] Skill instructions explicitly state empty sections are hidden entirely (not surfaced with placeholder text)
