# Test Definitions: Make agent handoffs decision-complete in real replies

Feature source: `features/make-agent-handoffs-decision-complete.feature`

test-definitions.md is the R/G/R ledger.

## Rule: A decision paragraph stands alone

### Scenario: A complete Next decision can be acted on without earlier prose

- [x] RED 5ba92f469
- [x] GREEN 2f8930686
- [x] REFACTOR 17d1aa998

### Scenario: The observed Next decision omission is rejected

- [x] RED fc0fedbf0
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A complete Need decision can be acted on without earlier prose

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: The observed Need paragraph cannot borrow its recommendation from earlier prose

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: An unexplained necessary term makes a decision incomplete

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: An explained necessary term remains usable in a decision

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Each required decision role is independently enforced for Next and Need

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Present decision roles cannot use content-free back-references

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A decision paragraph cannot present two unrelated choices

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: Routine handoffs stay concise

### Scenario: A no-decision handoff stays to one action and an essential reason

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A concrete no-decision action needs no reason when none is essential

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: An essential action reason may repeat earlier context

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A no-decision handoff cannot carry two reason clauses

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A vague no-decision action is rejected

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A no-decision handoff cannot present several next actions

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A no-decision handoff carrying a decision template is rejected as ceremonial

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A human-owned decision cannot be disguised as a no-decision action

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A no-decision handoff cannot repeat non-essential context

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A short conversational answer is outside the terminal-handoff contract

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A verdict alone makes a reply subject to the terminal contract

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A brief substantive reply still requires a terminal paragraph

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A substantive reply with an empty terminal paragraph is rejected

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: One versioned contract defines every handoff kind

### Scenario: The canonical contract validates symmetric decision and action forms

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: An unversioned contract is invalid

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: An asymmetric decision contract is invalid

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A contract without a no-decision action form is invalid

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: Long-form corpus binds semantic classifications

### Scenario: The shared evaluator reproduces the full corpus oracle

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: The long decision corpus rejects the observed omission

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: The long decision corpus accepts the self-contained rewrite

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: The long blocked corpus cannot hide decision roles before Need

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: The long blocked corpus accepts the self-contained Need rewrite

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: The long no-decision corpus retains one concise action

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: The long no-decision corpus rejects a vague action

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Held-out decision-route paraphrases follow the declared route

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Held-out marked-term paraphrases require an inline meaning

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Held-out reason paraphrases stay inside one declared clause

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Held-out action paraphrases require an imperative and object

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: Native terminal boundaries correct once

### Scenario: Each installed native terminal boundary corrects every incomplete long-form corpus case once

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Each installed native terminal boundary corrects a vague no-decision action once

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Each installed native terminal boundary leaves every compliant long-form corpus case alone

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Each installed native terminal boundary suppresses a repeated correction

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A prior session's correction never suppresses a fresh session

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: An intervening compliant stop re-arms correction in the same session

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Each installed native terminal boundary fails open on an unreadable payload

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Each installed native terminal boundary fails open when evaluation cannot complete

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Each installed native terminal boundary leaves short conversation alone

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: Every delivered copy stays aligned

### Scenario: Canonical generated installed and dogfood copies share the contract version and role set

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Every delivered copy produces the canonical corpus behavior

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Version drift fails parity for every delivered copy

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A missing delivered contract copy fails parity

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Decision-role drift fails parity at the canonical version

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR
