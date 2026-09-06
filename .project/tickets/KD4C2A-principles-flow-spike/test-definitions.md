# Test Definitions: Project knowledge throughout feature delivery

Feature source: `features/principles-flow-spike.feature`

test-definitions.md is the R/G/R ledger. Scenario Outline rows below represent
the matching executable outlines in the feature source while using the ledger's
required `Scenario:` heading grammar.

## Rule: project-knowledge.NTB1.R1 — Applicable project knowledge changes delivery without becoming a checklist

### Scenario: Principle applicability produces a proportional plan entry

- [x] RED skip: pre-BDD spike; characterization was frozen before the full ledger
- [x] GREEN 8b71a272d
- [x] REFACTOR ebb69f922

### Scenario: An unexplained conflict cannot pass independent plan review

- [x] RED skip: source-grounded review was characterized from the exploratory spike
- [x] GREEN 373554969
- [x] REFACTOR ebb69f922

### Scenario: A recorded principle conflict can pass independent plan review

- [x] RED skip: paired conflict characterization shares the independent-review fixture
- [x] GREEN 373554969
- [x] REFACTOR ebb69f922

## Rule: project-knowledge.NTB1.R2 — Independent review receives the source knowledge used to create the work

### Scenario: Each installed host review stage receives relevant configured knowledge

- [x] RED b7f79fd93
- [x] GREEN 9a35ff22d
- [x] REFACTOR 588ff1b50

### Scenario: Labels alone cannot satisfy a source-grounded review

- [x] RED 21b963430
- [x] GREEN 373554969
- [x] REFACTOR skip: generated host assets reuse the canonical review-stage contract

### Scenario: A later review resolves current knowledge instead of stale intake content

- [x] RED 190af63c8
- [x] GREEN 66c0998c1
- [x] REFACTOR skip: the JSON wrapper is already a thin boundary over the pure resolver

## Rule: project-knowledge.NTB1.R3 — Completion evidence distinguishes experience, surface execution, and trace integrity

### Scenario: Evidence is judged against the kind of claim it supports

- [x] RED skip: pre-BDD review guidance was characterized from the exploratory spike
- [x] GREEN 8b71a272d
- [x] REFACTOR 373554969

### Scenario: Audit reports each broken principle trace as E010

- [x] RED c249a167c
- [x] GREEN e8a440a8e
- [x] REFACTOR 96dc70f43

### Scenario: Semantic disagreement is not an audit failure

- [x] RED skip: paired with the objective-defect mutation fixture
- [x] GREEN e8a440a8e
- [x] REFACTOR skip: semantic judgment is explicitly owned by quality review

### Scenario: A heading number is not part of a principle's identity

- [x] RED skip: the authoritative audit reproduced the false missing-principle finding against configured `PRINCIPLES.md`
- [x] GREEN 4c93d3a86
- [x] REFACTOR skip: one normalization function is shared by source headings and plan traces

## Rule: project-knowledge.SWM1.R1 — Principles, personas, and surfaces share a safe configured-path lifecycle

### Scenario: Setup scaffolds absent knowledge and preserves authored knowledge

- [x] RED skip: pre-BDD reconciliation behavior was characterized from the exploratory spike
- [x] GREEN 8b71a272d
- [x] REFACTOR skip: schema remains the single ownership source

### Scenario: A configured knowledge path suppresses its default scaffold

- [x] RED skip: pre-BDD configured-path behavior was characterized from the exploratory spike
- [x] GREEN 8b71a272d
- [x] REFACTOR skip: no principles-specific reconcile branch was introduced

### Scenario: A valid override passes health without an orphan advisory

- [x] RED e55480970
- [x] GREEN 35925a6c3
- [x] REFACTOR skip: persona semantic parsing remains layered over shared path facts

### Scenario: A missing configured knowledge file fails health checks loudly

- [x] RED e55480970
- [x] GREEN 35925a6c3
- [x] REFACTOR skip: one typed helper owns all three missing-file diagnostics

### Scenario: An overridden default is reported without deleting it

- [x] RED e55480970
- [x] GREEN 35925a6c3
- [x] REFACTOR skip: the shared advisory helper is already read-only and minimal

### Scenario: An orphaned default remains untouched during reconciliation

- [x] RED skip: preservation mutation evidence predates the frozen BDD ledger
- [x] GREEN 8b71a272d
- [x] REFACTOR cecbc8838

## Rule: project-knowledge.SWM1.R2 — Design alignment is canonical without breaking legacy plans

### Scenario: A single supported alignment heading passes the plan gate

- [x] RED fbe5cf0ff
- [x] GREEN 737f0858e
- [x] REFACTOR skip: templates and consumer messages now share the canonical parser name

### Scenario: An ambiguous alignment contract is rejected with remediation

- [x] RED fbe5cf0ff
- [x] GREEN 737f0858e
- [x] REFACTOR skip: raw cardinality validation stays inside the deployed pure parser

## Rule: project-knowledge.SWM1.R3 — Every supported host preserves the same knowledge contract

### Scenario: Synchronized host artifacts pass parity

- [x] RED skip: the existing parity harness predates this feature
- [x] GREEN 373554969
- [x] REFACTOR ebb69f922

### Scenario: Host drift fails parity at the changed surface

- [x] RED skip: existing parity mutation coverage already names changed host surfaces
- [x] GREEN 373554969
- [x] REFACTOR ebb69f922

## Rule: project-knowledge.SWM1.R4 — Builders can discover the complete public knowledge contract

### Scenario: Public documentation distinguishes a complete contract from an incomplete one

- [x] RED 5b1ff4339
- [x] GREEN cecbc8838
- [x] REFACTOR skip: README and website intentionally use the same lifecycle vocabulary

## Feature-level cross-scenario refactor

- [x] cross-scenario 684a11c75
