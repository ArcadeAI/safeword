# Intake & Readiness: The Architect / Consultant Analogy

Covers: intake readiness gate, requirements elicitation, non-functional requirements, constraints, problem-behind-the-problem, technical vs non-technical requester, fit criteria, TPP6Y2.

What a world-class engineer/architect and a top-tier consultant ask at intake when a request lands — from a technical OR non-technical requester — mapped to the safeword agent. Third sibling to `intake-readiness-leadership-analogy.md` (operating model) and `intake-readiness-pm-analogy.md` (bounded question set). This piece adds two axes the prior two under-weighted: **constraints/non-functionals** and **request-shape normalization**.

## Architect's signature move: make the fuzzy measurable + surface constraints

Architects are pulled into elicitation early (>60% involvement) and their distinctive contribution is turning vague quality words into **measurable fit criteria / quality scenarios**. "No one can explain what they mean by performance, scalability, usability, maintainability" — the architect's job is to make the "-ilities" concrete and measurable. Rule of thumb: *if a tester cannot measure success, the requirement is incomplete.*

Two intake axes this adds:

1. **Non-functional / constraint questions.** Scale, performance, security, compatibility, *what must not break*, *who maintains this*, *what can't change*. These drive architecture and are expensive to retrofit — i.e. exactly the irreversible / high-blast category the readiness gate already cares about.
2. **Fit criteria over vibes.** "How will I know it's done" must be a measurable criterion, not a feeling. Sharpens `done_when`.

Tools named: Architecture Characteristics Worksheet, quality scenarios, fit criteria. "Prototypes help elicit NFRs but never replace written fit criteria."

### Fresh-evidence sharpening: constraint decay (the load-bearing finding for a coding agent)

A 2026 study ("Constraint Decay: The Fragility of LLM Agents in Backend Code Generation", arXiv 2605.06445) shows LLM coding-agent performance *declines as structural / non-functional constraints accumulate*, and that NFRs (architectural patterns, DBs, ORMs) are exactly what agents fail on. This cuts two ways and settles the design:

- Constraints are **where coding agents fail** → surface the load-bearing ones at intake (don't defer to build).
- But piling on constraints **degrades** the agent → surface only the *load-bearing* one ("what must not break / who depends / reversible?"), never an exhaustive NFR sweep. An NFR quality-attributes survey is self-defeating — it triggers the decay it's meant to prevent.

The classic cost-of-late-defect curve (requirements defects ~20–400× cheaper to fix early; one defect propagates across design+code+tests) directionally supports early constraint capture — but note the honest caveat that this evidence is "sparse and very old," so it is corroborating, not load-bearing. The 2026 agentic-coding consensus is to balance upfront spec clarity with iterative refinement, not front-load everything.

## Consultant's signature move: the problem behind the problem + the stakeholder landscape

- **"Search for the problem behind the problem" and remain curious.** Consultants assume the stated problem is a symptom — the sharpest form of the XY-problem guard.
- **Stakeholder dynamics over advice.** "More engagements fail because of stakeholder dynamics than bad advice." Surface *who* the stakeholders are and their conflicting views before starting; talk to the people closest to the problem, not just the point of contact.
- **The killer probe:** *"What would need to be true for this to be a definitive yes for you?"* — reveals hidden decision criteria and unnamed stakeholders in one question. High information gain; worth stealing for gate copy.
- **Scope explicitly** to prevent scope creep.

## The specific ask: technical vs non-technical requester

The expert's real job is to **normalize the request shape** to the same intent + constraints + fit-criteria core, regardless of who sent it:

- **Non-technical requester → under-specified.** Gives outcomes in domain language; omits the non-functionals they don't know to state (security, scale, failure modes). Expert *translates* to technical requirements, fills the unstated NFRs, restates in the requester's language, and confirms. "Avoid ambiguous terms; every requirement must support validation."
- **Technical requester → over-specified as a solution.** Often hands a solution (X) rather than the problem (Y). Expert reverse-engineers the intent and pressure-tests the proposed approach — the risk is anchoring on their stated solution.

Both failure shapes — under-specified and solution-in-disguise — collapse to the same core. A coding agent receives both kinds constantly, so the intake must detect *which shape* it got and correct for it.

## The four-domain convergence

| Domain | Adds to the readiness core |
| --- | --- |
| Mission command | Intent + end-state; prudent risk within intent |
| PM (Cagan) | Objective, success-signal, problem-not-solution, who; riskiest assumption |
| Architect | **Constraints / non-functionals; make done-state measurable** |
| Consultant | **Problem-behind-the-problem; stakeholder landscape; "definitive yes" probe; request-shape normalization** |

Four independent fields converge on a small, bounded, problem/outcome-focused intake — and the two new axes (constraints + request-shape) are precisely what a *coding* agent needs that generic intent-clarification misses.

## What this adds to TPP6Y2's self-test

Beyond the leadership/PM additions ("riskiest assumption", intent-first), this round contributes:

- **Constraints / blast-radius probe** as a first-class self-test item: what must not break, what can't change, who depends on this — the architect's expensive-to-retrofit axis, which doubles as the gate's reversibility read.
- **Measurable done-state** — `done_when` as a fit criterion, not a vibe.
- **Request-shape check** — is this a problem to solve or a solution-in-disguise? Recover the intent before acting (the XY guard, now evidence-backed from both architect and consultant practice).

## Caution

Same as the PM piece: do not import jargon (NFR, fit criteria, quality scenario) into gate copy. Use plain-English thinking prompts ("what must not break?", "is this the problem or someone's guess at the fix?"), never a checklist of terms.

## Sources

- InfoQ, "Non-functional Requirements in Architectural Decision Making" — https://www.infoq.com/articles/non-functional-requirements-in-architectural-decision-making/
- Working Software, "Ultimate Guide to Write Non-Functional Requirements" — https://www.workingsoftware.dev/the-ultimate-guide-to-write-non-functional-requirements/
- Consulting Success, "Mastering Consulting Client Questions" — https://www.consultingsuccess.com/consulting-client-questions
- StrategyU, "The Ultimate Guide to Scoping" — https://strategyu.co/scoping-in-consulting/
- 9Lenses, "15 Consulting Questions for Successful Client Discovery" — https://9lenses.com/15-consulting-questions-for-successful-client-discovery/
- Visure Solutions, "How to Measure and Identify the Quality of Requirements" — https://visuresolutions.com/alm-guide/how-to-measure-requirements-quality/
- insightsoftware, "Translating Business Needs and Technical Requirements" — https://insightsoftware.com/blog/tips-for-translating-business-needs-and-technical-requirements-into-a-product-plan-that-meets-specifications/
