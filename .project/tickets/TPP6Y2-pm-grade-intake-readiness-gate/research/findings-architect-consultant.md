# Raw findings: architect & consultant intake analogy

Raw web-search evidence. Synthesized into `intake-readiness-architect-consultant-analogy.md`.

## Architect: requirements elicitation & non-functionals

- Requirements elicitation is "one of the most challenging parts of requirements engineering." Architects significantly involved in elicitation >60% of the time. An essential architect task: make quality goals **concrete and measurable**. https://www.infoq.com/articles/non-functional-requirements-in-architectural-decision-making/
- Architects work with **incomplete/ill-specified NFRs**: "Often no one can explain what they mean by performance efficiency, scalability, usability, coupling, maintainability." https://www.workingsoftware.dev/the-ultimate-guide-to-write-non-functional-requirements/
- Techniques/tools: Q42 model + quality scenarios; Architecture Characteristics Worksheet; Architecture Inception/Communication Canvas. "Prototypes help elicit NFRs but never replace written **fit criteria**."
- Making vague measurable: ambiguous terms ("user-friendly", "efficient") cause rework/cost overruns; "every requirement should support validation — if testers cannot measure success, the requirement is incomplete." Goals → quantifiable, time-bound objectives. https://visuresolutions.com/alm-guide/how-to-measure-requirements-quality/ ; https://insightsoftware.com/blog/tips-for-translating-business-needs-and-technical-requirements-into-a-product-plan-that-meets-specifications/

## Consultant: scoping & discovery

- "The value of a consultant is the ability to continue to search for the **problem behind the problem**" / "remain curious." https://strategyu.co/scoping-in-consulting/
- "More consulting engagements fail because of **stakeholder dynamics** than bad advice" — surface the political landscape before walking in blind; talk to people **closest to the problem** (root causes), not just the point of contact. https://www.consultingsuccess.com/consulting-client-questions
- Killer probe: **"What would need to be true for this to be a definitive yes for you?"** — reveals hidden decision criteria and unconsidered stakeholders. https://9lenses.com/15-consulting-questions-for-successful-client-discovery/
- Scope explicitly to prevent scope creep (consulting intake questionnaires exist precisely for this).

## Technical vs non-technical requester (the specific ask)

- Technical requirements "bridge business stakeholders who define goals and developers who implement." Translation is the core job.
- **Non-technical → under-specified:** outcomes in domain language, omits NFRs they don't know to state. Expert translates up, fills unstated constraints, avoids ambiguous terms, confirms ("every requirement must support validation").
- **Technical → over-specified as a solution:** hands a solution (X) not the problem (Y); expert reverse-engineers intent and pressure-tests the approach; risk is anchoring on the stated solution.
- Both shapes collapse to the same intent + constraints + fit-criteria core. Tools: user journey + user stories to "avoid grey areas."

## The constraint-decay sharpening (cross-ref findings-agent-clarification.md)

Constraint decay (arXiv 2605.06445) settles the design: constraints are where coding agents fail → surface the load-bearing one at intake; but agents degrade as constraints accumulate → surface ONLY "what must not break / who depends / reversible?", never an NFR quality-attributes survey (self-defeating). Cost-of-late-defect curve corroborates early capture but is "sparse and very old" — not load-bearing.
