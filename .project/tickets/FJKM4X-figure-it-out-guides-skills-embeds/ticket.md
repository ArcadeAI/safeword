---
id: FJKM4X
slug: figure-it-out-guides-skills-embeds
parent: ZBVGPF-embed-figure-it-out
type: task
status: done
created: 2026-06-16T17:10:00.000Z
last_modified: 2026-06-16T17:51:00.000Z
scope:
  - Add one-sentence /figure-it-out callout to planning-guide.md Technical Constraints Dependencies row
  - Add one-sentence /figure-it-out callout to design-doc-guide.md Key Decisions fill-in instructions
  - Add one-sentence /figure-it-out callout to data-architecture-guide.md Physical sub-section
  - Add one-sentence /figure-it-out callout to debug/SKILL.md After 3+ Failed Fixes section (conditional on user confirmation)
  - Add one-sentence /figure-it-out callout to SAFEWORD.md Replan on resume section (change-scope/split verdicts only)
  - Update both template sources and installed copies for all five files
out_of_scope:
  - brainstorm/SKILL.md (dependency direction is intentionally one-way; figure-it-out already names brainstorm as its feeder)
  - testing-guide.md (SAFEWORD.md Authority covers adding a dependency + design choices; no evidence-required WHY field in the guide)
  - bdd/DISCOVERY.md, bdd/SCENARIOS.md, bdd/TDD.md (already have figure-it-out references)
  - architecture-guide.md (already has figure-it-out reference)
  - SAFEWORD.md Clarify + Authority (already have figure-it-out references)
  - refactor/SKILL.md (Tier 3 ambiguity is code diagnosis, not evidence research; tie-breaker resolves it)
  - quality-review/SKILL.md (web research built in; NEEDS DISCUSSION + Next: is the complete escalation path)
  - audit/SKILL.md (all findings have bounded prescribed actions; escalation to dedicated task handles open choices)
  - bdd/TDD.md REFACTOR step (architecture-review-gate already covers Tier 3 structural choices)
done_when:
  - All five template files contain the specified one-sentence addition at the exact location identified
  - All five installed copies (.safeword/guides/, .claude/skills/) match the updated templates
  - Changes committed on feature branch
---

# figure-it-out guides/skills embeds

Audited all 24 skills and 9 guides. Five files have a structural gap: each sets
an evidence quality bar (WHY fields, open choices, design forks) without naming
the tool to meet it. Adds one sentence per file at the exact decision point where
an agent would otherwise write from training memory.

## Precise edits

**1. `guides/planning-guide.md` — Technical Constraints table, Dependencies row**

Add after "Existing systems, restrictions | Use AuthService, no new packages":
> "When a dependency choice is open — not constrained by the project — call `/figure-it-out` before specifying it."

Rationale: Tasks bypass DISCOVERY.md (which covers figure-it-out for features). Technical Constraints is the only place in the task planning flow where an unresearched library choice can silently appear.

**2. `guides/design-doc-guide.md` — Key Decisions fill-in instructions**

Add after "Decision [N]: What we're using/doing, why (with specifics), trade-off":
> "If this choice is open — not yet researched — call `/figure-it-out` first; its output becomes the evidence in 'why' and 'trade-off'."

Rationale: The guide already requires "rationale with specifics (metrics, benchmarks, analysis)" but names no tool to produce it. Key Decisions is where design-time choices appear that weren't settled in Clarify.

**3. `guides/data-architecture-guide.md` — What to Document → Physical sub-section**

Add after "Storage technology, tables/collections, indexes, WHY this tech (trade-offs)":
> "If the storage technology is not yet chosen, call `/figure-it-out` first — its output provides the evidence for 'WHY this tech'."

Rationale: Data architecture docs fire at project init when storage IS being chosen. The best practices checklist demands "WHY + trade-offs" without naming how to get them. Database migrations are irreversible.

**4. `skills/debug/SKILL.md` — After 3+ Failed Fixes: Question Architecture**

Add after "Discuss with user before more fix attempts":
> "If user confirms the pattern is fundamentally unsound, call `/figure-it-out` to evaluate approaches (refactor / redesign / extract) before implementing anything."

Rationale: The skill correctly gates on user confirmation first (user may know a constraint that dissolves the option space). The gap is what happens AFTER confirmation — the agent is stranded with no bridge to the design phase.

**5. `SAFEWORD.md` — Replan on resume, post-verdict behavior**

Add after "proposing one of still-good / change-scope / cancel / split / merge, with rationale":
> "If the verdict is change-scope or split, run `/figure-it-out` before proposing a new approach — scope changed because the world changed, which is exactly when re-deciding from memory is most dangerous."

Rationale: Sub-agent is report-only and cannot run figure-it-out itself; the main agent needs an explicit trigger after receiving a change-scope/split verdict. still-good and cancel need no research (one is a non-change, the other terminates). This is the highest-leverage embed: revalidation fires precisely because the world changed under the plan.

## Work Log

- 2026-06-16T17:10:00Z Started: Created ticket FJKM4X. Derived from full skill+guide audit run in session; figure-it-out run on 6 candidates (planning-guide, design-doc-guide, data-architecture-guide, debug, brainstorm, testing-guide). 4 edits identified, 2 confirmed no-edit.
- 2026-06-16T17:36:00Z Expanded: SAFEWORD.md Replan embed moved from ZBVGPF (where shape was unresolved) into FJKM4X scope. Figure-it-out run this session settled the shape — one conditional sentence at the post-verdict point, same form as the other 4 edits. Scope is now 5 files. Out_of_scope updated with all remaining no-edit verdicts from the full audit (refactor, quality-review, audit, bdd/TDD.md REFACTOR).
- 2026-06-16T17:51:00Z Complete: All 5 template sources and 5 installed copies updated. Commit 2645496 on claude/dreamy-heisenberg-19shou. All done_when criteria met.
