# Test Definitions: Project knowledge throughout feature delivery

Feature source: `features/principles-flow-spike.feature`

test-definitions.md is the R/G/R ledger. Scenario Outline rows below represent
the matching executable outlines in the feature source while using the ledger's
required `Scenario:` heading grammar.

## Rule: project-knowledge.NTB1.R1 — Applicable project knowledge changes delivery without becoming a checklist

### Scenario: Principle applicability produces a proportional plan entry

- [x] RED skip: pre-BDD spike; characterization was frozen before the full ledger
- [x] GREEN 7d8bcce2d
- [x] REFACTOR 3441e0327

### Scenario: An unexplained conflict cannot pass independent plan review

- [x] RED skip: source-grounded review was characterized from the exploratory spike
- [x] GREEN 78d55f918
- [x] REFACTOR 3441e0327

### Scenario: A recorded principle conflict can pass independent plan review

- [x] RED skip: paired conflict characterization shares the independent-review fixture
- [x] GREEN 78d55f918
- [x] REFACTOR 3441e0327

## Rule: project-knowledge.NTB1.R2 — Independent review receives the source knowledge used to create the work

### Scenario: Each installed host review stage receives relevant configured knowledge

- [x] RED 7a4e3f3d9
- [x] GREEN bed27976d
- [x] REFACTOR 6480c75f3

### Scenario: Labels alone cannot satisfy a source-grounded review

- [x] RED a653f3178
- [x] GREEN 78d55f918
- [x] REFACTOR skip: generated host assets reuse the canonical review-stage contract

### Scenario: A later review resolves current knowledge instead of stale intake content

- [x] RED 6d4839444
- [x] GREEN 8a7fb2c41
- [x] REFACTOR skip: the JSON wrapper is already a thin boundary over the pure resolver

## Rule: project-knowledge.NTB1.R3 — Completion evidence distinguishes experience, surface execution, and trace integrity

### Scenario: Evidence is judged against the kind of claim it supports

- [x] RED skip: pre-BDD review guidance was characterized from the exploratory spike
- [x] GREEN 7d8bcce2d
- [x] REFACTOR 78d55f918

### Scenario: Audit reports each broken principle trace as E010

- [x] RED 2150775ab
- [x] GREEN 9aa439ce6
- [x] REFACTOR adfcc1c5b

### Scenario: Semantic disagreement is not an audit failure

- [x] RED skip: paired with the objective-defect mutation fixture
- [x] GREEN 9aa439ce6
- [x] REFACTOR skip: semantic judgment is explicitly owned by quality review

## Rule: project-knowledge.SWM1.R1 — Principles, personas, and surfaces share a safe configured-path lifecycle

### Scenario: Setup scaffolds absent knowledge and preserves authored knowledge

- [x] RED skip: pre-BDD reconciliation behavior was characterized from the exploratory spike
- [x] GREEN 7d8bcce2d
- [x] REFACTOR skip: schema remains the single ownership source

### Scenario: A configured knowledge path suppresses its default scaffold

- [x] RED skip: pre-BDD configured-path behavior was characterized from the exploratory spike
- [x] GREEN 7d8bcce2d
- [x] REFACTOR skip: no principles-specific reconcile branch was introduced

### Scenario: A valid override passes health without an orphan advisory

- [x] RED 154cd4406
- [x] GREEN 885ffef47
- [x] REFACTOR skip: persona semantic parsing remains layered over shared path facts

### Scenario: A missing configured knowledge file fails health checks loudly

- [x] RED 154cd4406
- [x] GREEN 885ffef47
- [x] REFACTOR skip: one typed helper owns all three missing-file diagnostics

### Scenario: An overridden default is reported without deleting it

- [x] RED 154cd4406
- [x] GREEN 885ffef47
- [x] REFACTOR skip: the shared advisory helper is already read-only and minimal

### Scenario: An orphaned default remains untouched during reconciliation

- [x] RED skip: preservation mutation evidence predates the frozen BDD ledger
- [x] GREEN 7d8bcce2d
- [x] REFACTOR 3c7c229e8

## Rule: project-knowledge.SWM1.R2 — Design alignment is canonical without breaking legacy plans

### Scenario: A single supported alignment heading passes the plan gate

- [x] RED 56a0f7b8b
- [x] GREEN 2bf8a5330
- [x] REFACTOR skip: templates and consumer messages now share the canonical parser name

### Scenario: An ambiguous alignment contract is rejected with remediation

- [x] RED 56a0f7b8b
- [x] GREEN 2bf8a5330
- [x] REFACTOR skip: raw cardinality validation stays inside the deployed pure parser

## Rule: project-knowledge.SWM1.R3 — Every supported host preserves the same knowledge contract

### Scenario: Synchronized host artifacts pass parity

- [x] RED skip: the existing parity harness predates this feature
- [x] GREEN 78d55f918
- [x] REFACTOR 3441e0327

### Scenario: Host drift fails parity at the changed surface

- [x] RED skip: existing parity mutation coverage already names changed host surfaces
- [x] GREEN 78d55f918
- [x] REFACTOR 3441e0327

## Rule: project-knowledge.SWM1.R4 — Builders can discover the complete public knowledge contract

### Scenario: Public documentation distinguishes a complete contract from an incomplete one

- [x] RED 3a4b97c9e
- [x] GREEN 3c7c229e8
- [x] REFACTOR skip: README and website intentionally use the same lifecycle vocabulary

## Feature-level cross-scenario refactor

- [x] cross-scenario 943902d4f
