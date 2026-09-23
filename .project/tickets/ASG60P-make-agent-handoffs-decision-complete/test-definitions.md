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
- [x] GREEN a7f03cab0
- [x] REFACTOR skip: focused linear parser has no duplication or nesting to remove yet

### Scenario: A complete Need decision can be acted on without earlier prose

- [x] RED skip: symmetric decision parser was already driven red by the observed Next omission
- [x] GREEN b7edcc9d4
- [x] REFACTOR skip: Next and Need already share one decision-role parser

### Scenario: The observed Need paragraph cannot borrow its recommendation from earlier prose

- [x] RED skip: shared terminal-only parser was driven red by the observed Next omission
- [x] GREEN 386846062
- [x] REFACTOR skip: Need and Next share the same terminal-only parser

### Scenario: An unexplained necessary term makes a decision incomplete

- [x] RED skip: marked-term branch was added within the reviewed semantic parser slice
- [x] GREEN 386846062
- [x] REFACTOR skip: term validation is one bounded clause check

### Scenario: An explained necessary term remains usable in a decision

- [x] RED skip: paired marked-term rejection supplied the discriminating failure
- [x] GREEN 386846062
- [x] REFACTOR skip: accepted and rejected terms share one parser branch

### Scenario: Each required decision role is independently enforced for Next and Need

- [x] RED skip: observed omission drove all five missing roles red together
- [x] GREEN 386846062
- [x] REFACTOR skip: roles are table-driven through one requirement map

### Scenario: Present decision roles cannot use content-free back-references

- [x] RED skip: content-floor validation is part of the reviewed semantic parser slice
- [x] GREEN 386846062
- [x] REFACTOR skip: all roles share one normalized content predicate

### Scenario: A decision paragraph cannot present two unrelated choices

- [x] RED skip: duplicate role cardinality is part of the reviewed semantic parser slice
- [x] GREEN 386846062
- [x] REFACTOR skip: cardinality uses the same parsed clause collection

## Rule: Routine handoffs stay concise

### Scenario: A no-decision handoff stays to one action and an essential reason

- [x] RED skip: positive action form existed structurally; rejection rows provide discrimination
- [x] GREEN 4f557cdb0
- [x] REFACTOR skip: fixture uses the shared action shape

### Scenario: A concrete no-decision action needs no reason when none is essential

- [x] RED skip: optional reason is the absence case of the same action parser
- [x] GREEN 4f557cdb0
- [x] REFACTOR skip: no separate no-reason branch is needed

### Scenario: An essential action reason may repeat earlier context

- [x] RED skip: positive reason fixture is paired with multi-reason and stray-prose rejection rows
- [x] GREEN 4f557cdb0
- [x] REFACTOR skip: reason syntax is shared across accepted fixtures

### Scenario: A no-decision handoff cannot carry two reason clauses

- [x] RED 4f557cdb0
- [x] GREEN 2e0240f3e
- [x] REFACTOR skip: action clauses share one parsed cardinality check

### Scenario: A vague no-decision action is rejected

- [x] RED skip: concrete-action predicate was driven by the reviewed action-cardinality slice
- [x] GREEN 2e0240f3e
- [x] REFACTOR skip: imperative and object checks are one predicate

### Scenario: A no-decision handoff cannot present several next actions

- [x] RED skip: shared action cardinality failure covers duplicate Action clauses
- [x] GREEN 2e0240f3e
- [x] REFACTOR skip: duplicate actions and missing actions share one count check

### Scenario: A no-decision handoff carrying a decision template is rejected as ceremonial

- [x] RED skip: route/form mismatch was part of the reviewed concise-action slice
- [x] GREEN 2e0240f3e
- [x] REFACTOR skip: ceremonial roles reuse the parsed clause set

### Scenario: A human-owned decision cannot be disguised as a no-decision action

- [x] RED skip: decision-route parsing was driven red by the observed legacy Open omission
- [x] GREEN 2e0240f3e
- [x] REFACTOR skip: declared human routes reuse the decision parser

### Scenario: A no-decision handoff cannot repeat non-essential context

- [x] RED skip: stray-prose rejection was covered in the reviewed concise-action slice
- [x] GREEN 2e0240f3e
- [x] REFACTOR skip: extra context is one bounded sentence-boundary check

### Scenario: A short conversational answer is outside the terminal-handoff contract

- [x] RED c7b2da4fb
- [x] GREEN 56525889f
- [x] REFACTOR skip: applicability is a closed evidence check before structure validation

### Scenario: A verdict alone makes a reply subject to the terminal contract

- [x] RED skip: paired ordinary-conversation RED supplied the applicability discriminator
- [x] GREEN 56525889f
- [x] REFACTOR skip: top-level verdict is detected by the existing bounded scan

### Scenario: A brief substantive reply still requires a terminal paragraph

- [x] RED skip: current-turn work uses the same reviewed applicability branch
- [x] GREEN 56525889f
- [x] REFACTOR skip: host evidence is a closed input value

### Scenario: A substantive reply with an empty terminal paragraph is rejected

- [x] RED skip: missing and empty terminal paragraphs share one requirement
- [x] GREEN 56525889f
- [x] REFACTOR skip: empty terminal detection reuses structural labels

## Rule: One versioned contract defines every handoff kind

### Scenario: The canonical contract validates symmetric decision and action forms

- [x] RED 2fd7cde09
- [x] GREEN 8b487b2e6
- [x] REFACTOR 6c495df09

### Scenario: An unversioned contract is invalid

- [x] RED skip: uncommittable historical proof — pre-contract Vitest failed because the validator export did not exist
- [x] GREEN 8b487b2e6
- [x] REFACTOR skip: validator requirements already use a dedicated contract-validation result type

### Scenario: An asymmetric decision contract is invalid

- [x] RED 5453fed07
- [x] GREEN 8b487b2e6
- [x] REFACTOR skip: contract validation stays in one bounded requirement collector

### Scenario: A contract without a no-decision action form is invalid

- [x] RED 5453fed07
- [x] GREEN 8b487b2e6
- [x] REFACTOR skip: action-form validation shares the contract requirement collector

## Rule: Long-form corpus binds semantic classifications

### Scenario: The shared evaluator reproduces the full corpus oracle

- [x] RED 6c495df09
- [x] GREEN 56525889f
- [x] REFACTOR skip: one table-driven oracle already exercises the shared evaluator without scenario-specific branches

### Scenario: The long decision corpus rejects the observed omission

- [x] RED 6c495df09
- [x] GREEN a7f03cab0
- [x] REFACTOR skip: the long corpus reuses the same terminal-only decision-role parser as the focused omission proof

### Scenario: The long decision corpus accepts the self-contained rewrite

- [x] RED skip: the pre-feature evaluator already accepted the compatible self-contained rewrite; the paired omission scenario supplies the discriminating failure
- [x] GREEN a7f03cab0
- [x] REFACTOR skip: the positive corpus row shares the same terminal-only decision parser and needs no separate branch

### Scenario: The long blocked corpus cannot hide decision roles before Need

- [x] RED 6c495df09
- [x] GREEN 386846062
- [x] REFACTOR skip: blocked and confident routes already share the same terminal-only decision-role parser

### Scenario: The long blocked corpus accepts the self-contained Need rewrite

- [x] RED skip: the pre-feature evaluator already accepted the compatible self-contained Need rewrite; the paired hidden-role scenario supplies the discriminating failure
- [x] GREEN 386846062
- [x] REFACTOR skip: the positive Need corpus row shares the same symmetric terminal-only parser

### Scenario: The long no-decision corpus retains one concise action

- [x] RED 6c495df09
- [x] GREEN 2e0240f3e
- [x] REFACTOR skip: concise action classification reuses the shared route parser and action predicate

### Scenario: The long no-decision corpus rejects a vague action

- [x] RED 6c495df09
- [x] GREEN 2e0240f3e
- [x] REFACTOR skip: vague and concrete action cases share one imperative-and-object predicate

### Scenario: Held-out decision-route paraphrases follow the declared route

- [x] RED 6c495df09
- [x] GREEN a7f03cab0
- [x] REFACTOR 17d1aa998

### Scenario: Held-out marked-term paraphrases require an inline meaning

- [x] RED 6c495df09
- [x] GREEN a7f03cab0
- [x] REFACTOR skip: marked terms use one bounded requirement check shared by accepted and rejected paraphrases

### Scenario: Held-out reason paraphrases stay inside one declared clause

- [x] RED 6c495df09
- [x] GREEN 2e0240f3e
- [x] REFACTOR skip: accepted and rejected reason paraphrases share one clause-count and extra-context check

### Scenario: Held-out action paraphrases require an imperative and object

- [x] RED 6c495df09
- [x] GREEN 2e0240f3e
- [x] REFACTOR skip: all action paraphrases share one imperative-and-specific-object predicate

## Rule: Native terminal boundaries correct once

### Scenario: Each installed native terminal boundary corrects every incomplete long-form corpus case once

- [x] RED b7e6c40c1
- [x] GREEN 3b015e5bc
- [x] REFACTOR e3ca4f543

### Scenario: Each installed native terminal boundary corrects a vague no-decision action once

- [x] RED 48f257797
- [x] GREEN a4f35353c
- [x] REFACTOR skip: the fix already centralizes both Stop paths through one correction helper

### Scenario: Each installed native terminal boundary leaves every compliant long-form corpus case alone

- [x] RED skip: pre-feature native hooks already left compliant replies unchanged; the paired incomplete-reply scenarios supply the discriminating failure
- [x] GREEN a4f35353c
- [x] REFACTOR skip: compliant cases share the same native subprocess harness and no scenario-specific branch

### Scenario: Each installed native terminal boundary suppresses a repeated correction

- [x] RED b7e6c40c1
- [x] GREEN c84a9b5f2
- [x] REFACTOR skip: the one-shot guard remains the single native loop-suppression predicate

### Scenario: A prior session's correction never suppresses a fresh session

- [x] RED skip: positive characterization is historically green; a global-session suppression mutant supplies the discriminating RED
- [x] GREEN 3b015e5bc
- [x] REFACTOR skip: suppression relies only on host-native per-invocation fields and creates no project-global state

### Scenario: An intervening compliant stop re-arms correction in the same session

- [x] RED skip: positive characterization is historically green; a sticky suppression mutant supplies the discriminating RED
- [x] GREEN 3b015e5bc
- [x] REFACTOR skip: native loop control already owns re-arming without persistent project state

### Scenario: Each installed native terminal boundary fails open on an unreadable payload

- [x] RED skip: positive characterization is historically green; a fail-closed native-hook mutant supplies the discriminating RED
- [x] GREEN 3b015e5bc
- [x] REFACTOR 959ecc66c

### Scenario: Each installed native terminal boundary fails open when evaluation cannot complete

- [x] RED skip: positive characterization is historically green; a fail-closed native-hook mutant supplies the discriminating RED
- [x] GREEN 3b015e5bc
- [x] REFACTOR 959ecc66c

### Scenario: Each installed native terminal boundary leaves short conversation alone

- [x] RED skip: positive characterization is historically green; a fail-closed native-hook mutant supplies the discriminating RED
- [x] GREEN 3b015e5bc
- [x] REFACTOR 959ecc66c

## Rule: Every delivered copy stays aligned

### Scenario: Canonical generated installed and dogfood copies share the contract version and role set

- [x] RED fe93232e9
- [x] GREEN 6c495df09
- [x] REFACTOR 959ecc66c

### Scenario: Every delivered copy produces the canonical corpus behavior

- [x] RED fe93232e9
- [x] GREEN 6c495df09
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

---

## Feature-level cross-scenario refactor

- [ ] cross-scenario
