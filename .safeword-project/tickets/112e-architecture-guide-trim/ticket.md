---
id: 112e
slug: architecture-guide-trim
status: done
type: task
created: 2026-04-11
parent: '112'
---

# Trim architecture-guide.md from 392 to ~300 lines

**Goal:** Cut restatements, add agent-visibility note, keep the layers & boundaries section (crown jewel) and decision tree intact.

## What to keep

| Section                                     | Lines   | Why it earns its place                                                                                                 |
| ------------------------------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------- |
| Decision tree                               | 7-26    | Core routing logic, MECE, stop-at-first-match                                                                          |
| Architecture doc characteristics + location | 43-60   | Defines what the doc is                                                                                                |
| Required sections                           | 62-71   | Template for the doc                                                                                                   |
| Best practices 1-5                          | 74-165  | Living doc, What/Why/Trade-off, code refs, versioning — all unique value                                               |
| "When to Update" table                      | 179-197 | Actionable triggers                                                                                                    |
| Common mistakes                             | 200-215 | Anti-patterns table                                                                                                    |
| Layers & Boundaries (full)                  | 258-354 | Crown jewel — dependency matrix, eslint-plugin-boundaries setup. Claude Code has zero dependency enforcement guidance. |
| Data architecture escalation                | 357-371 | Clean handoff criteria                                                                                                 |

## What to cut (~90 lines)

| Section                             | Lines              | Why it's bloat                                                                                                    |
| ----------------------------------- | ------------------ | ----------------------------------------------------------------------------------------------------------------- |
| Quick Decision Matrix               | 29-40 (12 lines)   | Restates decision tree (lines 7-26) in table form. Same content, second format.                                   |
| TDD Workflow Integration ordering   | 168-177 (10 lines) | BDD orchestrator (DECOMPOSITION.md) already manages this. Keep "When to Update" table, cut the workflow ordering. |
| Re-evaluation Path + Worked Example | 218-240 (23 lines) | Decision tree at top already covers this. Worked example is verbose.                                              |
| File Organization                   | 243-254 (12 lines) | Same directory structure from ticket system skill.                                                                |
| Quality Checklist                   | 374-383 (10 lines) | Restates required sections as checkboxes.                                                                         |
| Key Takeaways                       | 386-392 (7 lines)  | Fourth restatement of core points.                                                                                |

## What to add

### Agent-visibility note (~5 lines)

After the Layers & Boundaries section, add:

```markdown
## Making Architecture Visible to Agents

Put layer rules and key constraints in your project's CLAUDE.md so agents see them every session.
Architecture docs are reference material — CLAUDE.md is the active instruction set.
```

Research basis: Claude Code with architectural context saw 80% quality improvement (arxiv 2604.04990). Agents infer architecture from code alone poorly — explicit constraints prevent boundary violations.

### Code reference staleness note

Line 145 uses `src/stores/gameStore.ts:12-45` — specific project files. Add note: "Use file paths without line numbers for long-lived docs (line numbers go stale)." Already partially covered at line 153 but the example contradicts the guidance.

## Context

- Claude Code says "include architectural decisions in CLAUDE.md" but provides no templates, decision trees, or enforcement patterns
- eslint-plugin-boundaries is the right tool — not mentioned anywhere in Claude Code docs
- Living doc over ADR sprawl is current practice and better for AI agents (one file vs 50 ADR files)
- Layers & Boundaries section is genuinely unique — no equivalent in Claude Code ecosystem

## Work Log

- 2026-04-11T23:34 Created ticket from architecture-guide audit in parent #112.
