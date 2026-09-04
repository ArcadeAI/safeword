# Intake: Product Plan

**Entry:** feature-level work or a ticket resumed at `phase: intake`.

Create enough durable product context to decide and define the work. Do not
repeat parent prose in child features and do not create research artifacts by
default.

## Sub-phase gates

Confirm once per artifact, not once per item inside it. The four checkpoints are
Product Bet and jobs, Rules, Shape and Killer Demo, and engineering scope —
present each as a complete set, ask one closing question, and wait. Never walk a
user through milestones or Rules one at a time collecting a yes for each; that
turns a design conversation into rubber-stamping and buys no clarity the whole
set would not have shown. On resume, re-present the current checkpoint.

The confirmations you keep should be the ones worth having. Spend the user's
attention on the substance — interrogating intent into jobs, testing proposed
capability against what the platform can actually do — not on approving a list
they can read in one pass. If you find yourself asking for a fifth confirmation
in one phase, you have split the artifact too finely: present the rest together.

Under YOLO mode, auto-confirm and record the decision in the work log.

## Load project personas

Read `paths.personas` (default `<namespace-root>/personas.md`). If empty, ask
whether to add personas now or proceed. A JTBD names one persona and preserves
its canonical code.

## Load project glossary

Read `paths.glossary` (default `<namespace-root>/glossary.md`). If empty, ask
whether to add terms now or proceed. Keep one-ticket vocabulary local.

## Load project surfaces

Read `paths.surfaces` (default `<namespace-root>/surfaces.md`). If empty, ask
whether to add surfaces now or proceed. Examples include OpenAI Codex. Tag an
affected context `@surface.<slug>`. Promote a local surface only when it is
recurring across tickets, ambiguous enough to drift, or omission leaves it
untested.

## Load project context

Read the configured principles, personas, glossary, and surfaces files. Missing
or empty files are soft prompts, not blockers. Never invent a persona or domain
term to fill a template. Apply principles only when they change a bet, boundary,
Rule, design choice, or proof.

## Choose the plan shape

- **Epic or standalone feature:** author the full Product Plan in `spec.md`.
- **Feature with `parent`, `parent_job`, and `milestone`:** author only the
  child Contribution and feature-owned Rules. The parent owns the bet, jobs,
  milestone outcome, success threshold, and Killer Demo.
- **Legacy ticket without `product_plan_contract: v1`:** preserve its existing
  shape; do not migrate it during unrelated work.

## Full Product Plan

Keep the four template sections and no others.

### Product Bet

Capture Problem / Why now, Expected outcome, Success threshold, and Project
non-goals. Why now carries only decision-bearing evidence. The success threshold
is falsifiable; use an observable outcome when no honest metric exists. A
restated template prompt is not a threshold: rewrite it until the claimed
outcome could be disproven.

Use `$safeword:demand-research` only when Why now contains an unresolved,
decision-critical demand claim or the user explicitly requests demand research.
Skip it for child features, mandated work, parity work, or when a cheaper
experiment answers the assumption more directly. Fold the compact verdict and
strongest evidence into Product Bet; do not create a research appendix by
default.

## Author Jobs To Be Done

```markdown
### oauth-flow.PLO1 — <job title>

**Persona:** <canonical persona> (`<persona-code>`)

> When I <situation>, I want <motivation>, so I can <outcome>.

#### oauth-flow.PLO1.R1 — <one testable business invariant>
```

Jobs are persona outcomes, not proposed mechanisms. Never drop or narrow a job
because it looks difficult to implement. Split a Rule when either half could
ship as an independently valuable invariant. Use one persona per JTBD, then
pause once and confirm the jobs as a set before authoring Rules.

Write the fewest Rules that make the job decidable, not every invariant you can
name. A Rule earns its place when it could fail on its own and a user would
notice — when its violation would produce a complaint someone could describe.
Merge Rules that always pass or fail together; drop one whose failure only shows
up as another Rule already failing. A shorter set the user can hold in their
head serves the job better than an exhaustive one they skim, and exhaustiveness
belongs in lower-level tests rather than product invariants. If a Rule exists
only because the template has a slot for it, cut it.

### Shape

Use the smallest value-bearing milestones. Each has a stable ID, one outcome,
and its own non-goals:

```markdown
### M1 — <name>

- **Outcome:** <value delivered>
- **Non-goals:** <excluded from this milestone>
```

### Killer Demo

Define Audience, Starting state, Action, Payoff, Proof, and Boundary. This is the
shortest credible demonstration of the bet—not another scope list. Template
prompts or generic restatements do not qualify; the Payoff must name the
persona-facing before/after change and the Proof must make it observable.

## Child contribution

Keep only `Parent References`, `Contribution`, and `Rules` in the child
`spec.md`. Contribution states what this feature adds to the selected parent job
and milestone. Feature Rules use collision-safe lineage:

```markdown
#### <parent-job>.<child-ticket-id>.R<n> — <business invariant>
```

Do not copy Product Bet, JTBD, Shape, Killer Demo, or parent non-goals into the
child. References plus the accepted parent-contract digest are the inheritance
mechanism.

## Scope and gates

Derive `scope`, `out_of_scope`, and `done_when` from accepted product decisions.
Present and confirm the four checkpoints in order: Product Bet and jobs, Rules,
Shape and Killer Demo, then engineering scope. Each is one confirmation covering
the whole set — every job together, every Rule together, every milestone
together — not one per item. For a child, present Contribution and Rules, then
local scope: two confirmations, not one per Rule. Under YOLO mode, record the
auto-decision in the work log instead of pausing.

Immediately before changing a child from `intake` to `define-behavior`, run:

```bash
safeword ticket reconcile-parent <ticket-id>
```

A second run is idempotent. If the parent changes after intake, review the
changed contract and rerun with `--accept`; never accept drift invisibly.

Advance only when you can name the behavior that changes, the behavior that
stays the same, and an observable done state. Then create scenarios using the
Rule IDs as lineage.

Update frontmatter: set `phase: define-behavior` after the intake artifacts are
accepted (and after child reconciliation, when applicable).

## Intake exit

Implementation design happens in the `plan-implementation` phase. Offer the
cold-start check only when the recorded Reversibility says one-way, including a
data model, public API, or migration. Do not re-judge it at exit. A missing or
`skip:` Reversibility means no offer. Under YOLO, auto-run it, log the decision
in the work log, and record returned gaps as `defer:`.

## Understanding

Converge on the smallest scope that serves the accepted jobs and Product Bet.
