---
id: 112b
slug: planning-guide-trim
status: done
type: task
created: 2026-04-11
parent: '112'
---

# Trim planning-guide.md from 417 to ~230 lines

**Goal:** Cut Part 2 (Test Definitions, lines 226-417) which duplicates the test-definitions-feature template, testing-guide, and testing SKILL.md. Replace with a pointer. Keep Part 1 (User Stories) intact with minor example trimming.

## Problem

Part 2 is ~190 lines teaching test definition mechanics — status indicators, naming, steps, expected outcomes, coverage summaries, full examples. All of this already lives in:

- `test-definitions-feature.md` template (which the agent reads when creating test defs)
- `testing-guide.md` (test writing patterns, naming, assertions)
- `testing SKILL.md` (test philosophy, anti-patterns)

If #109 lands its simplified test-definitions template (Given/When/Then + RED/GREEN/REFACTOR checkboxes), Part 2 teaches an obsolete format with status emojis, numbered steps, and coverage percentage tables.

The planning guide should plan. Test definition mechanics belong in the template or testing guide.

## What to keep (Part 1, lines 1-224, ~224 lines)

| Section                       | Lines               | Status                               |
| ----------------------------- | ------------------- | ------------------------------------ |
| Artifact levels + triage      | 1-28                | Keep as-is                           |
| Templates table               | 30-41               | Keep as-is                           |
| Story formats + decision rule | 44-98               | Keep as-is                           |
| INVEST validation             | 100-112             | Keep as-is                           |
| Acceptance criteria good/bad  | 114-130             | Keep as-is                           |
| Size guidelines               | 132-142             | Keep as-is                           |
| Technical constraints         | 144-167             | Keep as-is                           |
| User story examples           | 169-224 (~55 lines) | Minor trim — 4 examples could be 2-3 |

## What to cut (Part 2, lines 226-417, ~190 lines)

| Section                            | Lines   | Why it's duplicative                                   |
| ---------------------------------- | ------- | ------------------------------------------------------ |
| "How to Fill Out Test Definitions" | 226-239 | = read the template (which has instructions)           |
| Test status indicators             | 241-251 | Defined in the template                                |
| Test definition naming             | 253-267 | Covered in testing-guide                               |
| Writing test steps                 | 269-289 | Covered in testing-guide                               |
| Writing expected outcomes          | 291-309 | Covered in testing-guide                               |
| Organizing test suites             | 311-322 | Covered in testing-guide                               |
| Coverage summary                   | 324-343 | Covered in template; obsolete if #109 simplifies       |
| Testing technical constraints      | 345-358 | Only section with unique value — move to testing-guide |
| Test definition example            | 360-383 | Full example already in template                       |
| Ticket folder naming               | 385-398 | Already in artifact levels section (line 17)           |
| Quick reference                    | 400-417 | Restates INVEST + test naming from above               |

## Replacement for Part 2

Replace all 190 lines with:

```markdown
## Test Definitions

Use the test-definitions template: `.safeword/templates/test-definitions-feature.md`

For test writing patterns (naming, assertions, structure), see the testing guide: `.safeword/guides/testing-guide.md`
```

## Coordination

- **#109**: If test-definitions template simplifies to Given/When/Then + checkboxes, Part 2 becomes actively wrong, not just duplicative
- **#112 testing-guide dedupe**: Move "Testing Technical Constraints" table (lines 345-358) to testing-guide if it doesn't already cover constraint-to-test-type mapping

## Work Log

- 2026-04-11T23:23 Created ticket from audit of planning-guide.md in parent #112.
