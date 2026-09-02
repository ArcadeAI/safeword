# Product Plan: Create lean product plans for features and epics

## Product Bet

- **Problem:** Safeword captures useful product intent during feature intake,
  but epics have no product spec and the current feature template spreads the
  decision across overlapping sections. Extending that shape to epics would
  multiply authoring and let copied context drift.
- **Demand evidence:** The requested workflow comes directly from a Safeword
  maintainer using the product on this repository. The external-demand strength
  is unverified. Linear's current project and milestone documentation supports
  keeping durable intent with the owning work, but is design evidence rather
  than proof of market demand.
- **Why now:** Product planning is being extended to feature epics. Defining
  ownership and inheritance first avoids shipping a second document model that
  later has to be reconciled with `spec.md`.
- **Expected outcome:** Product intent is captured once at the highest useful
  level, while each child feature adds only the behavior it contributes.
- **Success threshold:** A cold reader can recover the product bet, milestone
  boundaries, and credible demo from the epic or standalone feature, while a
  child feature contains no copied parent prose and no inapplicable placeholder
  sections.
- **Project non-goals:** A second plan artifact, copied parent intent, mandatory
  research, nested epics, or tracker synchronization.

### Demand-research trigger

Safeword first checks evidence already available to the project, in this order:

1. Product telemetry and usage behavior.
2. Inbound RFPs, support tickets, lost-deal reasons, and customer requests.
3. Direct customer or design-partner conversations.
4. Money, procurement, headcount, and public practitioner artifacts.
5. Public practitioner speech.

Invoke Safeword's packaged `demand-research` skill only when an epic or
standalone feature represents a meaningful product bet whose demand claim
remains decision-critical and unverified after that check, or when the user
explicitly asks for demand validation. Do not rerun it for child features,
mandated work, parity work, or a reversible experiment cheaper than the
research.

When invoked, summarize only the decision-bearing result here: demand strength,
evidence rungs, the skeptic case, load-bearing gaps, and the cheapest validation.
Link the full research output rather than copying it into this plan.

The bundled skill keeps only the demand decision: verdict, strongest evidence,
load-bearing gaps, skeptic case, and cheapest validation. It excludes general
vendor, competitor, market-history, and technology-history research.

## Jobs To Be Done

### lean-product-plans.NTB1 — Preserve product intent without planning ceremony

**Persona:** Non-Technical Builder (NTB)

> When I ask an agent to plan a feature or feature epic, I want it to capture
> the product bet once and carry that intent into the work, so I can make a
> sound product decision without maintaining repetitive planning documents.

#### lean-product-plans.NTB1.R1 — Every feature epic and standalone feature has one decision-ready Product Plan

#### lean-product-plans.NTB1.R2 — A child feature references its parent milestone and job while authoring only its contribution and Rules

#### lean-product-plans.NTB1.R3 — Safeword bundles a focused demand-research skill that runs only when an unresolved demand claim could change the decision to build

#### lean-product-plans.NTB1.R4 — A Product Plan identifies the shortest credible demo of its product payoff

#### lean-product-plans.NTB1.R5 — Inapplicable planning sections create no placeholder or `skip:` work

#### lean-product-plans.NTB1.R6 — A child cannot advance after its referenced parent contract changes until it reconciles the new values

## Shape

Product Plans have four sections only:

1. **Product Bet** — problem, demand evidence, why now, expected outcome, and
   falsifiable success threshold.
2. **Jobs To Be Done** — highest-level persona jobs on an epic; the standalone
   feature's persona jobs and numbered Rules when no epic owns the plan.
3. **Shape** — stable milestone IDs, milestone outcomes and non-goals, plus
   project-wide non-goals.
4. **Killer Demo** — the shortest credible walkthrough proving the payoff.

### M1 — Author the product decision once

- **Outcome:** `ticket new --type=epic` and standalone feature creation produce
  the same compact Product Plan shape, scaled to the work.
- **Non-goals:** Implementation design, scenarios, and delivery progress.

### M2 — Carry intent into child features without copying it

- **Outcome:** Child features reference a declared milestone and parent job,
  then author only their contribution and feature Rules.
- **Non-goals:** Nested epics, arbitrary child overrides, and duplicated parent
  summaries.

### M3 — Reconcile only decision-bearing parent changes

- **Outcome:** Safeword warns an in-progress child only when a structured parent
  value it references changes.
- **Non-goals:** Invalidating children for editorial changes, references,
  research prose, or demo wording.

### Project non-goals

- A second `product-plan.md` artifact.
- A full Product Plan on every child feature.
- Required external demand research for every feature.
- General vendor, competitor, market-history, or technology-history research.
- Invented metrics where no meaningful measure exists.
- Child deviations from inherited product intent; change the parent plan or
  move the feature out of the epic instead.
- Nested epic inheritance in the first version.

### Ownership and identity

- An epic owns the Product Plan when one exists; otherwise the standalone
  feature owns it.
- Milestones are declared once in the owning plan with stable IDs such as `M1`.
- Child frontmatter references `parent: <epic-id>` and `milestone: M1`.
- An unknown parent or milestone is invalid rather than free-form metadata.
- A child feature has a delta-only spec: parent, milestone, parent job,
  contribution, and feature Rules. It has no inherited headings and requires
  no `skip:` placeholders.

### Parent change reconciliation

At child intake exit, Safeword records a digest of the structured values the
child references: parent job, selected milestone outcome and non-goals, project
non-goals, and success threshold. A changed digest warns at the next phase
transition. Editorial prose, research references, and Killer Demo wording do
not invalidate children.

## Killer Demo

- **Audience:** A builder asking an agent to plan a multi-feature product bet.
- **Starting state:** The request is broad enough to require an epic with two
  child features.
- **Action:** Safeword drafts one four-section epic Product Plan, then creates a
  child feature assigned to `M1`.
- **Payoff:** Opening the child shows only its contribution and Rules while the
  agent can still resolve the complete product context from the parent.
- **Proof:** Rename the parent milestone and show that an invalid child reference
  is caught; edit non-contract prose and show that the child is not invalidated.
- **Boundary:** The demo uses repository-local tickets; tracker synchronization
  and nested epics are outside the first version.
