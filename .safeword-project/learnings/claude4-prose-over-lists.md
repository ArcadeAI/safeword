# Concise Over Verbose for Skill File Instructions (Not Prose Over Lists)

**Finding:** The key variable is conciseness, not format. Fewer steps with less ceremony outperforms verbose multi-step procedures. Lists vs prose is not the differentiator — verbosity is.

**Evidence for conciseness:**

- TDAD paper (arxiv 2603.17973v2): 9-phase procedural instructions degraded performance vs 3-step instructions. "Surfacing contextual information outperforms prescribing procedural workflows." The finding is about step count, not format.
- agent-behavior-research.md line 107-112: "LLMs treat unordered lists as unordered — sequencing within a flat list is unreliable." Use ordered lists when order matters.

**Evidence AGAINST converting lists to prose:**

- The MLI Threshold (Karl J. Taylor, Feb 2026): Tasks with >7 constraints or >3-4 conditional branches should use structured formats, not prose. Prose introduces ambiguity for complex procedures.
- GeekyTech peer-reviewed study: Bullet/list formats generally outperform prose for domain-specific tasks.
- No A/B test exists comparing numbered-list vs prose for LLM instruction following.

**Correction:** Earlier versions of this learning recommended "prose over lists." The research doesn't support this. The Anthropic docs citation was about Claude's output format (how Claude writes responses), not instruction format. The TDAD finding is about verbosity (9 steps vs 3), not format (list vs prose). The MLI Threshold research actively contradicts prose for high-constraint tasks.

**What this means for skill files:**

- A 3-item exit checklist is fine as a numbered list. A 9-step procedure should be shortened to 3 steps.
- Lookup tables (phase → file mappings, criteria → red flags) stay as tables.
- For complex procedures: keep structured format, reduce step count.
- The dominant format is short numbered list + one concrete example (the refactor/debug pattern). Anthropic's redundancy guidance: "important rules appearing at multiple levels because no single instruction is 100% reliable." Dogfooding confirmed refactor and debug skills (phases + examples) had best compliance; testing skill (conceptual grouping, no phases) had lower sequential compliance.

**Source:** TDAD (arxiv 2603.17973v2, March 2026); MLI Threshold (Karl J. Taylor, Feb 2026); GeekyTech bullet-list study (2025); Wang et al. (2023).
