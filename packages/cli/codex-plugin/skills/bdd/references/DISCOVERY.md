# Intake: Product Plan

**Entry:** feature-level work or a ticket resumed at `phase: intake`.

Create enough durable product context to decide and define the work. Do not
repeat parent prose in child features and do not create research artifacts by
default.

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
is falsifiable; use an observable outcome when no honest metric exists.

Use `$safeword:demand-research` only when Why now contains an unresolved,
decision-critical demand claim or the user explicitly requests demand research.
Skip it for child features, mandated work, parity work, or when a cheaper
experiment answers the assumption more directly. Fold the compact verdict and
strongest evidence into Product Bet; do not create a research appendix by
default.

### Jobs To Be Done and Rules

```markdown
### <slug>.<persona-code><n> — <job title>

**Persona:** <canonical persona>

> When I <situation>, I want <motivation>, so I can <outcome>.

#### <jtbd-id>.R1 — <one testable business invariant>
```

Jobs are persona outcomes, not proposed mechanisms. Never drop or narrow a job
because it looks difficult to implement. Split a Rule when either half could
ship as an independently valuable invariant.

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
shortest credible demonstration of the bet—not another scope list.

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
Present and confirm the smallest useful units in order: Product Bet and jobs,
Rules, Shape and Killer Demo, then engineering scope. For a child, present
Contribution and Rules, then local scope. Under YOLO mode, record the
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
