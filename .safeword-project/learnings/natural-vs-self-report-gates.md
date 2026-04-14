# Natural Gates vs Self-Report Gates

**Finding:** There are two structurally different kinds of enforcement gates for AI agents, but the distinction has no name in the research literature (verified gap, April 2026).

**Natural gates:** The next step's input physically doesn't exist if the prior step was skipped. The agent cannot bypass because there's nothing to work with. Examples:

- Artifact prerequisite: can't create test-definitions.md without ticket.md having scope fields
- Dimension artifact gate: can't create test-definitions.md without dimensions.md existing
- LOC threshold: can't keep editing without committing (reset requires real git commit)
- Done gate: tests must actually pass (subprocess execution, not prose)

**Self-report gates:** The agent sets a flag or edits a field saying it completed a step. The hook reads the flag. Examples:

- Phase advancement: agent manually edits `phase:` in ticket frontmatter
- Work log entries: agent writes completion timestamps
- `dimensions_documented: true` in frontmatter (rejected approach)

**Key difference:** Natural gates are un-bypassable — they enforce by physics, not policy. Self-report gates rely on agent honesty, which SWE-bench research shows is unreliable (~40% false success claims).

**Implication:** When designing enforcement, prefer natural gates (artifact must exist) over self-report gates (agent says it did the thing). If a natural gate isn't possible, self-report gates are still better than nothing — but they're a different tier of reliability.

**Applied in:** Ticket #121 — chose dimensions.md as a true natural gate over `dimensions_documented: true` frontmatter field (self-report). Also added phase gate (self-report, lightweight) as belt-and-suspenders.

**Source:** Safeword dogfooding sessions; SWE-bench evaluations (Princeton 2024); AgentSpec (arxiv 2503.18666). The natural/self-report distinction is original to this project — no published framework names it.
