---
id: 112c
slug: testing-guide-dedupe
status: done
type: task
created: 2026-04-11
parent: '112'
---

# Deduplicate testing-guide.md and testing SKILL.md

**Goal:** Eliminate ~80% content overlap across 690 combined lines (409 guide + 280 skill). Separate concerns: skill = enforceable rules during workflow, guide = reference patterns and strategies.

## Problem

The testing skill auto-triggers when writing tests. The agent reads both files, getting the same content twice — context pollution.

| Content                  | testing-guide.md | SKILL.md | Overlap             |
| ------------------------ | :--------------: | :------: | ------------------- |
| Test philosophy          |       yes        |   yes    | ~identical          |
| Test type hierarchy      |       yes        |   yes    | ~identical          |
| Behavior-biased examples |       yes        |   yes    | ~identical per type |
| AAA pattern              |       yes        |   yes    | same                |
| Async testing            |       yes        |   yes    | same warning        |
| Test data builders       |       yes        |   yes    | same                |
| Naming conventions       |       yes        |   yes    | same                |

## Research findings (2026)

### Confirmed — keep

- **"Test behavior, not implementation"** — strong consensus, no pushback found
- **E2E persistent dev server + port isolation** — aligns with Playwright best practices
- **Bug detection matrix** — unique to guide, genuinely useful
- **Anti-patterns table** — aligns with latest AI agent testing research (over-mocking is #1 documented problem)
- **"What not to test"** — correct and concise

### Needs revision

**Test type hierarchy is too rigid.** Guide presents E2E > Integration > Unit as fixed preference. Latest research:

- Frontend/web → Trophy (integration-heavy, Kent C. Dodds)
- Backend/libraries → Pyramid (unit-heavy, Google's 80/15/5 ratio)
- Should say "prefer highest scope that covers behavior with acceptable feedback speed" — context-dependent, not fixed

**Coverage goals section is misleading.** Guide says "80%+ unit coverage" — but Google's 80/15/5 is test _count distribution_, not coverage percentage. Latest research: high coverage with mocks = false confidence ("Lie of Unit Test Code Coverage" pattern). Emphasize behavioral coverage over numerical targets.

**LLM eval section is thin.** Missing the tiered evaluation pattern:

1. Deterministic checks first (format, structure, required fields) — cheap, reliable
2. LLM-as-judge for subjective quality — expensive, use sparingly
3. Cost tracking as first-class concern

**TDD quick reference may be counterproductive.** TDAD paper (arxiv 2603.17973): verbose TDD procedural instructions increased regressions from 6.08% to 9.94% with AI agents. What works: targeted test identification (which tests validate which code), not RED/GREEN/REFACTOR ceremony. However, safeword's TDD is a process enforcement mechanism (#109), not just a testing pattern — the guide's TDD section should point to TDD.md rather than restate it.

### Sources

- TDAD: arxiv 2603.17973 (TDD instructions hurt AI agents)
- Over-mocking study: arxiv 2602.00409 (AI agents generate isolation-heavy tests)
- Testing Trophy: Kent C. Dodds "Write tests. Not too many. Mostly integration."
- Google Test Pyramid 2.0: frontiersin.org/articles/10.3389/frai.2025.1695965
- Playwright vs Cypress 2026: qaskills.sh/blog/cypress-vs-playwright-2026
- LLM evaluation: futureagi.substack.com/p/llm-evaluation-frameworks-metrics

## Proposed separation

### SKILL.md → enforceable rules (~100 lines, down from 280)

Keep:

- 5 iron laws (unique value — enforceable checklist)
- Anti-patterns table (practical, actionable)
- One decision tree: "which test type?" with context-dependent guidance

Cut:

- Philosophy section (duplicates guide)
- Behavioral examples per type (duplicates guide)
- AAA pattern, async testing, test data builders, naming (all in guide)
- Writing approach section (generic)

Add:

- Pointer: "For patterns and examples, see testing-guide.md"

### testing-guide.md → reference patterns (~250 lines, down from 409)

Keep:

- Bug detection matrix (unique)
- E2E persistent dev server patterns (unique)
- Test type examples (consolidated from both files)
- CI/CD integration
- "What not to test"

Revise:

- Test type hierarchy: context-dependent, not fixed E2E > Integration > Unit
- Coverage goals: behavioral coverage over numerical targets
- LLM eval: add tiered evaluation pattern (deterministic → LLM-as-judge)
- TDD section: replace quick reference with pointer to TDD.md

Cut:

- Philosophy preamble (covered by skill's iron laws)
- Duplicate async/builder/naming sections

## Coordination

- **#109**: Proposes "prefer highest scope with acceptable feedback speed" for TDD.md and DECOMPOSITION.md — same principle should apply here for consistency
- **#112 (parent)**: Testing guide is item #5 in execution order

## Work Log

- 2026-04-11T23:27 Created ticket from testing guide audit in parent #112.
