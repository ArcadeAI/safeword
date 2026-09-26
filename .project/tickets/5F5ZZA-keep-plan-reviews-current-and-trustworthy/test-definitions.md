# Test Definitions: Keep plan reviews current and trustworthy

Feature source: `features/keep-plan-reviews-current-and-trustworthy.feature`

test-definitions.md is the R/G/R ledger.

## Rule: plan-implementability.TBU4.5F5ZZA.R1 — Shared clauses are authored once and generated into both contracts

### Scenario: Editing the canonical shared clause changes both generated phase contracts

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

Supporting Product reviewer-generation proof: the real planning-family generator
must emit the Product reviewer copy and propagate every canonical shared clause,
including both shared-block markers, after a canonical edit. The primary target is
`packages/cli/tests/integration/planning-contract-generation.test.ts`; invoke
`scripts/dev bun run --cwd packages/cli test tests/integration/planning-contract-generation.test.ts`.
This supporting loop initially lacked Product reviewer emission. Independent
review `dda87835-1abd-4eb3-9205-6ca36a6aa04b` approved the tightened RED before
implementation; the generator then passed 21 focused tests and 172 broader
cases. All four shared clauses and both block markers propagate into the Product
reviewer output. This generation proof does not claim complete installed Product
dispatch or admission. Keep the full scenario unchecked until every approved
boundary is proved.

### Scenario: Phase-only clauses remain in their owning contract

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A missing generated shared clause blocks reconciliation

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: plan-implementability.TBU4.5F5ZZA.R2 — Each review receives its complete phase context

### Scenario: A review packet cannot omit required phase context

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Installed dispatch cannot bypass packet completeness

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: plan-implementability.TBU4.5F5ZZA.R3 — Required context resolves or fails closed

### Scenario: Context resolution distinguishes defaults from broken overrides

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Local dispatch enforces required context resolution

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: plan-implementability.TBU4.5F5ZZA.R4 — Review provenance changes only for semantic dependencies

### Scenario: Context identity ignores cosmetic and unrelated edits

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: plan-implementability.TBU4.5F5ZZA.R5 — Contract identity binds exact canonical bytes

### Scenario: Installed contract identity controls authoring and approval

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Local dispatch enforces canonical contract identity

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Cosmetic canonical changes preserve review currency but require copy reconciliation

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: plan-implementability.TBU4.5F5ZZA.R6 — Review fallback is bounded and honestly labeled

### Scenario: The review gate follows the typed route result

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Fallback cannot bypass an available independent route

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Independent approval requires a genuinely independent reviewer

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Route selection derives independence from configured model capability

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Exhausted routes advance through the fallback ladder in order

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Local phase gates enforce the real review result

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: OpenCode CLI and TUI gates enforce the real review result

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Cloud phase gates enforce the real review result

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: plan-implementability.TBU4.5F5ZZA.R7 — Research and review context remain untrusted evidence

### Scenario: Retrieved instructions cannot change accepted scope

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Retrieved executable code remains untrusted evidence

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Private-context requests do not prevent public evidence use

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Reusable evidence records declared reuse limits

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Evidence records do not invent absent limits

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Reviewed artifacts and context remain evidence rather than instructions

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Installed review dispatch preserves the retrieved-evidence trust boundary

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: plan-implementability.TBU4.5F5ZZA.R8 — Ungated surfaces receive advisory guidance only

### Scenario: Generated Codex Cloud instructions cannot claim a gated approval

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: OpenCode Desktop guidance cannot claim a gated approval

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Generated guidance identifies gated surfaces as enforced

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: plan-implementability.TBU4.5F5ZZA.R9 — Review invalidation follows the dependency direction specified by the Execution Planning contract; this child implements the shared provenance and invalidation mechanics rather than defining a second dependency matrix

### Scenario: A changed artifact invalidates exactly its dependent reviews

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Invalidation follows the canonical Execution Planning dependency direction

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

Supporting typed-contract generation proof: invoke the real planning-family
generators against a copied source distribution. All three emitted phase records
must expose the eight bounded-decision fields; changing the owning Execution
contract's purpose must change its emitted value. Execution must expose the
owner-decided `upstreamImplementationInvalidation: both_plan_reviews`, while the
other phases must not acquire that field. The primary target is
`packages/cli/tests/integration/planning-contract-generation.test.ts`; invoke
`scripts/dev bun run --cwd packages/cli test tests/integration/planning-contract-generation.test.ts -t "emits typed phase contracts"`.
The missing generated record is the expected RED. This supporting proof does not
claim runtime dependency invalidation or rejection of malformed contracts; those
boundaries remain required before the scenario can be checked.

### Scenario: An undecidable Execution invalidation contract blocks reconciliation

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

Invalidation-contract rejection proof: install a fresh Cursor project
through the real source CLI, then mutate only its distribution's canonical
Execution invalidation declaration. A real upgrade must reject missing, unknown,
unknown-suffix, duplicate (including an empty duplicate), and contradictory directions with
`invalid_invalidation_contract`, the Execution phase and canonical contract path,
and unchanged installed contract bytes. The primary target is
`packages/cli/tests/integration/planning-contract-generation.test.ts`; invoke
`scripts/dev bun run --cwd packages/cli test tests/integration/planning-contract-generation.test.ts`.
Only external dependency/skills downloads are disabled. The expected RED is
`real CLI reconciliation must reject an invalid Execution invalidation contract`.
This proves reconciliation rejection, not runtime review dependency invalidation.

After the plan repair, current authenticated scenario review
`d715e7cd-82e1-4251-8a72-1bea2d154d83`, Implementation review
`3bd93757-8ffc-4a9f-93f5-fde00fb2c656`, and Execution review
`5f12374c-b953-4020-9671-14e4ac798b22` approved with no error findings;
the actual read-only CLI reported coding authorized with cross-agent evidence.
The complete unfiltered primary proof then returned seven intended failures
and 15 passes (22 tests), retained in
`/tmp/4200-complete-invalidation-reconciliation-red.log`.
Missing includes both an absent declaration and an absent entire Invalidation
field. The real generator also preserves either supported owner-decided mode.
All seven failures are the real upgrade succeeding instead of rejecting its
malformed canonical source; existing generation, shape, and shared-clause proofs
still pass. Review `0a63b905-ce92-45b8-84da-fdccaf41df7b` remains a rejected
wrong-scenario binding, not GREEN authority. A fresh independent executable
review must attest this exact reconciliation scenario before production changes.

Review `d774deea-0513-47bc-a9d2-ad99a8b74530` approved the correctly bound,
unfiltered executable RED before any production change. Its atomicity warning
identified a material proof gap: snapshotting only the Execution file could
miss earlier writes to other phase contracts. Strengthen the same accepted
scenario by generating a canonical shared-clause change before introducing the
invalid direction, confirming all three canonical phase contracts differ from
the installed snapshots, then requiring all installed bytes to remain unchanged
on rejection. This discriminates a write-before-validation implementation.
The primary proof changed, so a fresh attestation is required before GREEN;
the approved prior review is historical evidence, not current authority.
The supported-mode siblings also exercise real installation and assert the
installed owner declaration, preventing a reconciler that rejects every
canonical mode or silently hardcodes one of the two supported values from
passing this proof. The strengthened unfiltered local run retains seven
intended failures and 15 passes; its log is
`/tmp/4200-atomic-invalidation-reconciliation-red.log`.

### Scenario: An approving receipt is valid only for its own ticket and review kind

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Installed phase gates enforce invalidated review receipts

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: plan-implementability.TBU4.5F5ZZA.R10 — Product, Implementation, and Execution Planning contracts share one explicit contract shape while each approval remains limited to its own behavioral, design, or delivery claim

### Scenario: Each planning contract declares its bounded decision

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

Supporting Product dispatch proof: invoke the real `review run quality-review`
command against a v1 feature or epic Product Plan under the resolved namespace.
The reviewer process must receive the canonical Product phase, matched author and
reviewer identity, and bounded behavior-review instructions. A configured namespace
is honored; an unrelated same-named file, task spec, or Product Plan supplied only
as context must retain ordinary quality review. The primary target is
`packages/cli/tests/cli-protocol/review-wiring.test.ts`; invoke
`scripts/dev bun run --cwd packages/cli test tests/cli-protocol/review-wiring.test.ts -t "Product planning contract"`.
Only the external reviewer process is simulated. Admission and the other phases'
eight-field completeness remain unproved here, so keep the scenario unchecked.

Supporting contract-shape proof: invoke the real planning-family/rubric generators
for all three phases and require exactly one nonempty declaration of Purpose,
Entry criteria, Required content, Prohibited content, Review question, Approval
meaning, Invalidation, and Return path. The primary target is
`packages/cli/tests/integration/planning-contract-generation.test.ts`; invoke
`scripts/dev bun run --cwd packages/cli test tests/integration/planning-contract-generation.test.ts`.
Product already declares these fields; Implementation and Execution are the
missing behavior. This proves generated shape, not semantic judgment or phase
admission. Keep the full scenario unchecked until its remaining boundaries pass.

### Scenario: An incomplete planning contract cannot pass completeness checking

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A planning approval cannot claim its downstream state

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A planning approval may claim its own bounded state

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: plan-implementability.TBU4.5F5ZZA.R11 — Blocking findings cite accepted requirements and expose defects or unresolved choices without letting reviewer-authored product or architecture decisions, optional strengthening, or corrected-but-unreviewed bytes pass as approved

### Scenario: Finding authority controls whether a review may block

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: The installed Implementation Plan gate enforces finding authority

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Corrected plan bytes cannot inherit the prior verdict

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A fresh verdict can clear the corrected-plan block

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: plan-implementability.TBU4.5F5ZZA.R12 — Accepted scope combines ticket, project, milestone, and inherited parent boundaries

### Scenario: No binding scope source can be omitted from review

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: The installed Implementation Plan gate enforces binding scope context

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: plan-implementability.TBU4.5F5ZZA.R13 — Completeness checks both omissions and overreach against that accepted boundary

### Scenario: Plan completeness is bidirectional

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: The installed Implementation Plan gate enforces bidirectional scope completeness

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: plan-implementability.TBU4.5F5ZZA.R14 — Reviewer corrections cannot silently expand accepted scope, and declined optional strengthening remains declined and reviewable

### Scenario: Optional strengthening changes only through user authority

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: An undecided optional suggestion cannot alter or block the plan

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: plan-implementability.TBU4.5F5ZZA.R15 — Architecture, data, testing, domain, research, and reviewer guidance supplies candidate decisions rather than authority to expand accepted scope

### Scenario: Guidance respects the accepted boundary

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: plan-implementability.TBU4.5F5ZZA.R16 — The Product Plan contract inventories or explicitly excludes every accepted persona's consequential success, refusal, failure, approval, trust, and recovery outcomes and keeps known facts, assumptions, and unresolved product decisions visibly distinct; scenario review separately proves coverage of every applicable outcome

### Scenario: Product Plan approval requires every accepted persona outcome

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Product Plan approval requires honest epistemic status

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Scenario review proves every applicable persona outcome

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: The installed Product Plan gate enforces persona-outcome completeness

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR
