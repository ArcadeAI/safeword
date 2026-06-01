---
id: 3N3Q7B
slug: principles-rubric
title: 'Update PRINCIPLES.md — extend existing 5 by at most 1-2 net-new principles meeting research/measurement bar'
type: feature
phase: intake
status: in_progress
created: 2026-05-24T22:06:51.289Z
last_modified: 2026-05-25T03:45:00.000Z
---

# Update PRINCIPLES.md — extend existing 5, demote patterns to the catalog (62PDX1)

**Goal:** Update safeword's existing [PRINCIPLES.md](/Users/alex/Projects/safeword/PRINCIPLES.md) (5 principles, research-backed, capped explicitly at "few — 5, not 15" per principle 5) by adding AT MOST 1-2 net-new principles that meet the same bar (Anthropic citation, dogfooding measurement, or equivalent primary evidence). Move all the inferred "principles" from earlier work (originally up to 22 candidates from engineering + product + product-systems clusters) that don't meet the bar into the patterns catalog (62PDX1).

**Why this scope change:** Earlier draft of this ticket scoped "~12-15 unified principles." That directly violates safeword's own principle 5: "Principles should be few (5, not 15)." A figure-it-out session (2026-05-25, web research + working-memory literature) confirmed the canonical bar: principles are FEW, abstract, research/measurement-backed; patterns are MANY, named, instance-specific. SOLID = 5, Cowan's working-memory limit = 4±1, React = ~7, Rails Doctrine = ~9. Going above ~7 destroys retention. Most of what I called "principles" earlier are tactical patterns (AODI, R/G/R checkboxes, skip annotations, dimensions/partitions, propose-and-converge interview shape, two-format separation, etc.) — they belong in 62PDX1's catalog, NOT in PRINCIPLES.md.

**Authority:** This reframe is grounded in (a) safeword's existing principle 5; (b) [SOLID](https://www.tutorialsteacher.com/articles/difference-between-design-principle-and-design-pattern); (c) [Cowan working-memory research](https://pmc.ncbi.nlm.nih.gov/articles/PMC2864034/); (d) [Rust API Guidelines](https://rust-lang.github.io/api-guidelines/about.html) two-part principle/pattern model; (e) [Rails Doctrine](https://rubyonrails.org/doctrine) and [React Design Principles](https://legacy.reactjs.org/docs/design-principles.html) as exemplars of the few-principles narrative-prose form.

## Scope

### Existing 5 principles (preserve as-is unless explicit rework)

1. **Structure enforces; instructions suggest**
2. **Fire at boundaries, not every turn**
3. **Add, never replace**
4. **Contribute, then converge**
5. **Clarity before correctness**

These have research/measurement backing already. Do not modify their substance in this ticket — only consider rewording or example refresh if the additions force it.

### Net-new candidates to evaluate (1-2 max graduate to principles)

These are the candidates that MIGHT meet the bar; the rest of the historical 22 candidates explicitly do NOT and become patterns in 62PDX1.

1. **"Outcomes cascade, not output"** — Cagan POM core; absent from current 5; research-backed via [SVPG / Product Operating Model](https://www.svpg.com/the-product-operating-model/); measurable via signals-tied done gate (per 1W107W in Phase 3 epic). Replaces implicit feature-completion bar with outcome-validation bar. **Likely graduates.**

2. **"Layer don't replace"** (extension of existing principle 3) — generalizes "Add, never replace" beyond customer-config-merging to skill-and-rule layering for repo and personal extensions (per 70G298, XSDQZ0). Might just BE principle 3 broadened rather than a separate principle. **Possibly graduates as a rewording of principle 3, NOT a separate principle.**

### What does NOT graduate (becomes patterns in 62PDX1)

From the earlier 22-candidate list — these all become patterns:

- AODI mnemonic
- R/G/R checkboxes with SHA annotations
- Skip annotations with non-empty reason
- Dimensions/partitions gate (dimensions.md before test-definitions.md)
- Propose-and-converge interview shape (the conversation shape lives in principle 4; the specific pattern is a separate instantiation)
- Two-format separation (discovery vs saved)
- Library/framework version awareness before recommendation
- Evidence before claims
- Anti-gold-plating at phase exits
- Composable escape hatches (the act of delegating to `/elicit`, `/figure-it-out` is a pattern that instantiates principle 1)
- Vocabulary-driven precision (instances: glossary, persona codes, numbering)
- JTBD authoring format ("When I, I want, so I can")
- Persona-reference validation
- Cross-reference numbering scheme (slug.persona.AC.scenario)
- AC layer between JTBD and scenarios
- Pause-and-confirm gates
- Vacuous-pass test
- Negative-case coverage check
- Structured findings format (h4 per finding, Current/Proposed, 3-tier severity)
- Bulk findings template
- Cross-cutting review categories
- Impl plan 5-section structure
- ADR consultation step
- Plan-vs-actual reconciliation
- Test-harness availability check / graceful degradation
- Mandatory feature:<slug> tag
- Four implementation approach options for signals (monitor / insight / cron / synthetic)
- Two-state done gate
- Feedback loops close inside agent flow (likely pattern serving the "Outcomes cascade" principle)
- Hypothesis with explicit kill criteria (likely pattern serving "Outcomes cascade")
- Sunset as discipline (likely pattern serving "Outcomes cascade")

All ~30 of these are PATTERNS, not principles. They belong in 62PDX1's catalog with stable IDs.

### Document format

Each principle in PRINCIPLES.md keeps the existing prose-narrative shape (per the current 5):

- One-line statement
- Research/measurement citation
- Prose explanation
- Worked application example
- Anti-pattern it prevents (inline)

NO formal "rubric scoring." The principles ARE the rubric: each contributor reads PRINCIPLES.md cold and asks "does my change honor these?" Patterns (in 62PDX1) provide the named instances when needed.

### Linkage

Patterns in 62PDX1's catalog name which principle(s) they instantiate via frontmatter. Principles do NOT enumerate patterns (would bloat PRINCIPLES.md and add maintenance burden).

## Out of scope

- Building the patterns catalog itself — that's [62PDX1](../62PDX1/ticket.md).
- Modifying SAFEWORD.md (skills, hooks, rules) to reference PRINCIPLES.md — separate hygiene work; do AFTER both this ticket and 62PDX1 ship.
- Translating principles into per-language coding-style rules.
- Hook-enforcement of rubric adherence — principles are for design conversations, not gate-blocking.

## Done when

- PRINCIPLES.md has 5-7 principles total (existing 5 + at most 1-2 net-new). Driver's prediction: 6 (existing 5 + "Outcomes cascade, not output").
- Any net-new principle cites primary research (peer-reviewed paper / Anthropic publication / equivalent) or measurement data (dogfooding count / benchmark).
- Each principle conforms to the existing narrative-prose shape.
- The 30+ patterns explicitly enumerated as NOT graduating are tracked in 62PDX1's catalog.
- 4RD1NS (the product-systems-cluster ticket) is updated to reflect the new bar.

## Open questions

- **"Outcomes cascade" graduation** — does this clear the bar with SVPG/Cagan as primary source, or is industry-thought-leadership not equivalent to research/measurement evidence? Driver leans yes-graduates (Cagan POM is widely adopted; the principle is empirically-grounded in tech-company outcomes). Open.
- **"Layer don't replace" generalization** — separate principle, rewording of principle 3, or just absorbed as additional instance text under principle 3? Driver leans absorb-into-principle-3 (don't add a separate principle for a generalization). Open.
- **Anti-OKR framing** — should "Outcomes cascade" explicitly call out that OKR-style ceremony can defeat the principle if not careful? Driver leans yes — cite [Team Topologies](https://teamtopologies.com/) and Cagan critique of bureaucratic OKR.

## Work Log

- 2026-05-24T22:06:51.289Z Started: Created ticket 3N3Q7B
- 2026-05-24T22:07:00.000Z Drafted: Initial scope with 22 candidate principles (~12-15 unified target)
- 2026-05-25T03:45:00.000Z Refactored: Read existing PRINCIPLES.md, recognized scope directly violated principle 5's "few (5, not 15)" rule; reframed to "extend existing 5 by 1-2 max"; demoted ~30 candidates to patterns catalog (62PDX1); cited research bar for principle vs pattern distinction
