# Verbose Procedural Gates Degrade Performance (Generalizes Beyond TDD)

**Finding:** The TDAD paper (arxiv 2603.17973v2) found that verbose 9-phase TDD instructions increased regressions from 6.08% to 9.94%. This was already captured in agent-behavior-research.md. New finding: this generalizes beyond TDD.

**Evidence for generalization:**

- AgentSpec (arxiv 2503.18666) shows hard gates work for _safety_ (90%+ interception of physically invalid actions) but no evidence they improve _quality_ outcomes for procedural checklists.
- TDAD's core insight — "agents don't need to be told HOW to do TDD; they need to be told WHICH tests to check" — applies to any multi-step process: tell the agent WHAT to produce, not HOW to produce it step-by-step.
- The key variable is conciseness, not format (see claude4-prose-over-lists.md correction). Lists are fine; verbose multi-step procedures hurt. MLI Threshold (Taylor, 2026) shows structured formats outperform prose for high-constraint tasks.

**Implication:** When designing skill files, distinguish between:

- **Safety gates** (physically invalid actions): these work. Hard-block. Example: can't create test-definitions.md without dimensions.md.
- **Quality gates** (procedural checklists): these hurt. Use examples and output validation instead. Example: don't add a "verify you derived dimensions" checklist step — show an example of good dimension derivation.

**Relation to existing learnings:** Extends agent-behavior-research.md line 38-43 (TDD Prompting Paradox). The paradox is not TDD-specific — it's a general principle about procedural instruction overhead.

**Applied in:** Ticket #121 — chose example-driven compliance (concrete turn example in SCENARIOS.md) + structural artifact gates over adding procedural checklist steps to the skill file.

**Source:** TDAD (arxiv 2603.17973v2, tested on Qwen3-Coder 30B); AgentSpec (arxiv 2503.18666); Anthropic Claude 4 prompting best practices.
