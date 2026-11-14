# D1BKYA regression proof

## Scenario: Approved warnings advance on authenticated phase authority

Given a current coordinator approval with a warning and only its phase stamp
When the installed CLI approves the Implementation Plan
Then it enters Execution Planning without another artifact stamp

- [x] RED d17892b68
- [x] GREEN 14878b34a
- [x] REFACTOR skip: removed the duplicate check and its unused imports; authentication stays in its existing owner

## Scenario: Refusals report actual evidence failures and rejection findings

Given rejected, missing, or stale planning evidence
When the installed CLI approves the Implementation Plan
Then only a current rejection reports reviewer findings and other refusals name the evidence failure

- [x] RED d17892b68
- [x] GREEN 5622a89
- [x] REFACTOR skip: the existing authenticated status query owns freshness; rendering filters only actual rejection findings

## Feature-level cross-scenario refactor

- [x] cross-scenario skip: both loops share the existing phase-admission service; no new authority or abstraction is needed
