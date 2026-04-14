# Claude 4: Examples Are the Strongest Compliance Signal

**Finding:** Claude 4.x models pay close attention to examples and follow them closely. Anthropic's Claude 4 best practices docs recommend ensuring examples "align with behaviors you want to encourage and minimize behaviors you want to avoid." The think-tool engineering post showed a 54% improvement in policy compliance when examples of reasoning approaches were provided vs abstract rules alone.

**Implication:** In skill files, the concrete turn example is the strongest compliance lever — stronger than the instructions around it. If you want the agent to produce a dimension table before writing scenarios, show an example of an agent producing a dimension table. Don't just say "derive dimensions first."

**Corollary:** If an example accidentally demonstrates a shortcut (e.g., skipping a step), Claude 4.x is likely to follow the shortcut. Examples must be carefully crafted to demonstrate the full desired behavior.

**Applied in:** Ticket #121 — added concrete turn example to SCENARIOS.md design showing dimension derivation, partitioning, and rule-organized scenarios in a single agent turn.

**Source:** Anthropic Claude 4 best practices (docs.anthropic.com, verified April 2026); Anthropic think-tool engineering post (54% improvement with reasoning examples vs abstract rules).
