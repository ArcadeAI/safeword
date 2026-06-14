---
id: '123'
type: task
phase: intake
status: backlog
created: 2026-04-14T18:52:00Z
last_modified: 2026-04-14T18:52:00Z
scope:
  - Add exactly 1 realistic turn example to 5 structured skill files
  - Each example shows what the agent says, what the user responds, and what happens next
  - Examples demonstrate the full desired behavior (no shortcuts)
out_of_scope:
  - brainstorm/SKILL.md — creative/exploratory skill, examples cause fixation (Few-Shot Dilemma, Nature 2025)
  - SPLITTING.md — judgment-heavy decision, examples anchor on one split pattern
  - SCENARIOS.md — covered by ticket #121
  - Format changes (list-to-prose conversion) — dropped per MLI Threshold research
  - Adding more than 1 example per file — performance peaks then degrades (Few-Shot Dilemma, Tang et al. 2025)
done_when:
  - DISCOVERY.md has 1 propose-and-converge turn example
  - DECOMPOSITION.md has 1 task breakdown example
  - DONE.md has 1 done-gate verification example
  - tdd-review/SKILL.md has 1 gate review example (covering the most common gate)
  - All examples are realistic agent turns, not templates
  - Template skill files synced to packages/cli/templates/skills/
---

# Add Concrete Examples to Structured Skill Files

**Goal:** Add one realistic turn example to each skill file that describes a structured process but currently has zero examples.

**Why:** Research shows examples are the strongest compliance signal for structured tasks (Anthropic think-tool: 54% improvement with reasoning examples). Seven skill files describe processes with zero examples. But research also shows diminishing returns (Few-Shot Dilemma, Tang et al. 2025) and creative fixation (Nature 2025) — so we add exactly 1 example only to structured/procedural skills, not creative or judgment-heavy ones.

## Files to change

| File                                  | Example to add                          | Why this file                                                         |
| ------------------------------------- | --------------------------------------- | --------------------------------------------------------------------- |
| `.claude/skills/bdd/DISCOVERY.md`     | Propose-and-converge turn during intake | Structured: restate → contribute → surface questions                  |
| `.claude/skills/bdd/DECOMPOSITION.md` | Task breakdown from scenarios           | Structured: scenarios → implementation tasks                          |
| `.claude/skills/bdd/DONE.md`          | Done-gate verification pass             | Structured: run verify → run audit → report                           |
| `.claude/skills/tdd-review/SKILL.md`  | GREEN gate review (most common)         | Structured: check implementation, verify test passes for right reason |

## Files explicitly excluded

| File                  | Reason                                                                                   |
| --------------------- | ---------------------------------------------------------------------------------------- |
| `brainstorm/SKILL.md` | Creative/exploratory — examples cause fixation, reducing divergent thinking              |
| `SPLITTING.md`        | Judgment-heavy — example anchors on one split pattern, reducing adaptive decision-making |
| `SCENARIOS.md`        | Covered by #121                                                                          |

## Example format guidance

Each example should be a realistic conversation fragment, not a template:

- Show what the agent actually says (specific to a plausible feature)
- Show the user's response (brief, realistic)
- Show what happens next (outcome, phase transition)
- Demonstrate the full desired behavior — no skipped steps, because Claude 4.x follows examples closely

## Research basis

- Anthropic think-tool (2025): 54% improvement with reasoning examples vs abstract rules
- Anthropic Claude 4 best practices: "ensure examples align with behaviors you want to encourage"
- Few-Shot Dilemma (Tang et al., arxiv 2509.13196): performance peaks at optimal example count then degrades
- Creative fixation (Nature 2025): constrained LLM interactions reduce creativity via fixation effects
- Prompt bloat (MLOps Community): beyond complexity threshold, additional content causes partial compliance

## Work Log

- 2026-04-14T18:52:00Z Created: From research-backed plan review. Originally 7 files, narrowed to 4 after Few-Shot Dilemma and creative fixation research. brainstorm and SPLITTING excluded to avoid fixation/anchoring.
