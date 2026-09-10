# Test Definitions: Resolve disputed plan findings without review loops

Feature source: `features/resolve-disputed-plan-findings.feature`

test-definitions.md is the R/G/R ledger.

## Rule: plan-implementability.TBU5.26FK42.R1 — The originating reviewer cannot be the sole adjudicator of its disputed finding

### Scenario: A disputed finding requires a resolver other than its originating reviewer alone

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: plan-implementability.TBU5.26FK42.R2 — Scope and optional-strengthening disputes route to the user, currency disputes resolve from bound provenance, and correctness or relevance disputes route to a fresh adjudicator applying the accepted contract and scope

### Scenario: Dispute classification selects one explicit resolver

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Provenance resolves review currency without a preference vote

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: plan-implementability.TBU5.26FK42.R3 — When a reviewer disputes whether a finding is optional strengthening, the fresh adjudicator applies the nonblocking classification owned by 5F5ZZA; the dispute itself cannot make the finding blocking, and only user acceptance can change the accepted scope

### Scenario: Optional advice changes state only through user scope authority

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: An adjudicator cannot turn scope expansion into required work

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: plan-implementability.TBU5.26FK42.R4 — Headless and cloud work preserves current nonblocking human-approval behavior, records unresolved dispositions for later review, and never turns an unresolved correctness dispute into approval

### Scenario: Unavailable human authority produces a durable pending result

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Available interactive authority resolves instead of remaining pending

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: An unresolved correctness dispute cannot become approval

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: plan-implementability.TBU5.26FK42.R5 — Every dispute reaches an honest typed result without a fixed correctness-pass cap, reviewer-owned scope, or silent retry loop

### Scenario: Supported dispute outcomes terminate explicitly

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Closed disputes distinguish later corrections from silent retries

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Correctness adjudication follows available routes rather than a fixed pass count

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR
