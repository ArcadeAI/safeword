---
id: 4RD1NS
slug: principles-product-systems-cluster
title: 'Evaluate product-systems candidates against principle bar; at most 1-2 graduate, rest go to patterns catalog'
type: feature
phase: intake
status: in_progress
epic: product-systems-loop-closing
blocked_on: 3N3Q7B
created: 2026-05-25T01:25:31.680Z
last_modified: 2026-05-25T03:45:00.000Z
---

# Evaluate product-systems candidates against principle bar

**Goal:** Evaluate the 8 originally-proposed product-systems "principles" against the research/measurement bar codified in 3N3Q7B. At most 1-2 graduate to principles in PRINCIPLES.md (likely overlapping with what 3N3Q7B already nominates). The rest become patterns in the 62PDX1 catalog with stable IDs and cited lineage.

**Why this scope change:** Earlier draft of this ticket scoped "8 product-systems principles to add to the unified rubric." That assumed the rubric would have ~12-15 principles total. The bar correction in 3N3Q7B (driven by safeword's own principle 5 + research on principle vs pattern distinction + working-memory limits) means 8 net-new product-systems principles is wrong. Most of the 8 are TACTICAL PATTERNS that instantiate principles, not principles themselves.

**Authority:** This reframe inherits from 3N3Q7B. Same primary evidence base: SOLID, Cowan working memory, Rust API Guidelines, Rails Doctrine, React Design Principles.

**Parent epic:** GNSJ6P
**Depends on:** 3N3Q7B (bar must be set there first), 62PDX1 (catalog must exist to receive demotions)

## Scope

### Evaluate the 8 original candidates

For each, decide: graduate to principle, or demote to pattern. Document the decision with rationale.

1. **"Feedback loops close inside the agent flow, not as TODOs"** → **likely PATTERN**. Concrete tactical move (loop-closing skills surface decisions in-session). Instantiates the candidate "Outcomes cascade" principle (which 3N3Q7B will likely graduate).

2. **"Hypothesis with explicit kill criteria"** → **likely PATTERN**. Specific to /experiment skill (PP7116). Instantiates "Outcomes cascade" and existing principle 1 ("Structure enforces" — kill criteria is a natural gate).

3. **"Sunset is discipline, not failure"** → **likely PATTERN**. Specific to /sunset skill (6F432S). Cultural framing; closer to a vocabulary item than a principle.

4. **"Cross-feature composition matters more than per-feature optimization"** → **AMBIGUOUS**. Could graduate as a principle if measurement-backed (e.g., research on feature-creep and UI complexity). Could be a pattern instantiating "Clarity before correctness" (principle 5). Driver leans **PATTERN** unless primary research surfaces.

5. **"Outcomes cascade"** → **LIKELY GRADUATES** (this is the same candidate 3N3Q7B nominates). Cagan POM core, widely adopted industry-thought-leadership.

6. **"Flow over predictability"** → **PATTERN**. Team Topologies framing. Could be reworded as a principle if research-grounded, but flow-based delivery is more of a meta-pattern than a foundational principle.

7. **"Platform-as-a-product mindset"** → **PATTERN**. Team Topologies; specific framing of how internal platforms are treated. Instantiates existing principles when applied to safeword's own design.

8. **"Existing tools are data sources, not workflow"** → **PATTERN**. Specific to the product-systems loop-closing skills (GNSJ6P epic) and the alert-routing layer (JS5K5G). Concrete architectural constraint, not a foundational principle.

### Decision summary (driver's read, pending confirmation)

- **Graduate to principle (1):** "Outcomes cascade" — same candidate already nominated in 3N3Q7B; this ticket and 3N3Q7B converge on it. NOT a separate principle from 3N3Q7B's nominee.
- **Demote to patterns (7):** the other 7 become patterns in 62PDX1 with stable IDs (e.g., `P-LOOP-CLOSE-IN-FLOW`, `P-KILL-CRITERIA`, `P-SUNSET-DISCIPLINE`, `P-CROSS-FEATURE-COMP`, `P-FLOW-OVER-PRED`, `P-PLATFORM-AS-PRODUCT`, `P-TOOLS-AS-DATA`).

### Net effect on this ticket

This ticket's deliverable is the EVALUATION + DEMOTIONS, not new principles. The actual principles work happens in 3N3Q7B; the catalog work happens in 62PDX1.

## Out of scope

- Writing the patterns themselves into 62PDX1 — this ticket recommends; 62PDX1 receives.
- Defining how loop-closing skills (AQ14K2, 6F432S, PP7116, 92TBNN) work.
- Cagan / Torres / Team Topologies primer or training material.

## Done when

- Each of the 8 original candidates has a documented decision: graduate (with rationale) or demote (with target pattern ID in 62PDX1).
- If "Outcomes cascade" graduates, this ticket and 3N3Q7B are coordinated to nominate the same principle once (not separately).
- The 7 demoted candidates have stub entries in 62PDX1's catalog draft (full pattern writeup happens in 62PDX1; this ticket just lands the names + lineage).
- 4RD1NS closes as `done` with the evaluation result documented; the demoted patterns continue under 62PDX1's lifecycle.

## Open questions

- **"Outcomes cascade" attribution** — graduated by 3N3Q7B or by this ticket? Since both nominate it, exactly one should own the work. Driver leans 3N3Q7B owns the graduation (this is the unified-principles ticket); this ticket recommends and steps aside on this specific principle.
- **Cross-feature composition graduation** — if research surfaces measurement evidence (e.g., feature-creep studies), should it graduate after all? Open.
- **Catalog ID convention** — `P-<DOMAIN>-<NAME>` or `P-<NAME>`? Inherits from 62PDX1's decision.

## Related

- **3N3Q7B** (principles ticket) — primary dependency; defines the bar.
- **62PDX1** (patterns catalog ticket) — receives the demotions.
- **GNSJ6P** (product-systems epic) — parent epic; loop-closing skills reference these patterns.

## Work Log

- 2026-05-25T01:25:31.680Z Started: Created ticket 4RD1NS
- 2026-05-25T01:26:00.000Z Drafted: 8 product-systems principles distilled from research
- 2026-05-25T03:45:00.000Z Refactored: Per 3N3Q7B bar correction, evaluated 8 candidates against principle vs pattern bar; recommends 1 graduates (overlaps with 3N3Q7B's "Outcomes cascade"), 7 demote to patterns in 62PDX1; reframed ticket deliverable from "8 principles added" to "evaluation + demotions"
