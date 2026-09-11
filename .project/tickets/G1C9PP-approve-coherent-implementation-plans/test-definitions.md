# Test Definitions: Approve coherent Implementation Plans

Feature source: `features/approve-coherent-implementation-plans.feature`

test-definitions.md is the R/G/R ledger.

Proof boundary: every untagged semantic scenario must derive its verdict from
the exact packaged Implementation Plan contract bytes through the deterministic
contract-conformance reviewer boundary. A per-scenario scripted verdict cannot
satisfy RED or GREEN. Scenarios tagged `@surface.safeword-cli` additionally
prove real installed CLI wiring.

## Rule: plan-implementability.TBU1.G1C9PP.R1 — Implementation Planning is a distinct approach-decision phase

### Scenario: Safeword CLI enforces and releases the decision boundary

- [x] RED b1727e245
- [x] GREEN 828d8af75
- [x] REFACTOR skip: the existing gate is already a single unconditional decision check; this loop only restored packaged boundary proof

## Rule: plan-implementability.TBU1.G1C9PP.R2 — Authors and reviewers use one decision-quality contract

### Scenario: Contract agreement controls review eligibility

- [x] RED 5c33fe706
- [x] GREEN 5f6201106
- [x] REFACTOR skip: contract extraction and reconciliation already have one production path; the new fixture only exposes that boundary to Cucumber

### Scenario: A missing packaged contract blocks installed review

- [x] RED 917fca1a0
- [x] GREEN e8a440de4
- [x] REFACTOR skip: the package-relative lookup is one focused boundary and mirrors the existing packaged-runtime root rule; extracting two call sites would add indirection without changing behavior

## Rule: plan-implementability.TBU1.G1C9PP.R3 — The plan opens with an architecture-at-a-glance mental model and keeps decision-bearing detail in the main review path without becoming an execution or evidence manual

### Scenario: Decision presentation controls focused reviewability

- [x] RED c4674408b
- [x] GREEN 2e01fc849
- [x] REFACTOR skip: the conformance fixture is already separated into contract, structure, and decision judgments; further extraction would not improve this scenario's behavior or proof

### Scenario: A load-bearing decision cannot disappear from the review path

- [x] RED 9ad2d2518
- [x] GREEN 2e01fc849
- [x] REFACTOR skip: the missing-decision rule is one clause in the shared focused-review obligation and reuses the same decision judgment as the outline

## Rule: plan-implementability.TBU1.G1C9PP.R4 — The Implementation Plan is a project-local reviewed artifact

### Scenario: Safeword CLI accepts only the project-local Implementation Plan

- [x] RED b59d6f7b9
- [x] GREEN 2722ee208
- [x] REFACTOR skip: the authority check is one public-command boundary with no duplicated production path

### Scenario: A divergent host-private copy never becomes authoritative

- [x] RED 4f168b359
- [x] GREEN 2722ee208
- [x] REFACTOR skip: the scenario reuses the same single authority boundary and packet capture path

## Rule: plan-implementability.TBU1.G1C9PP.R5 — Architecture applicability is explicit

### Scenario: Architecture applicability accepts consequences or a justified skip

- [x] RED 61636f429
- [x] GREEN 5b00d9413
- [x] REFACTOR skip: one rubric clause and one authoring prompt express the applicability rule without a new parser or abstraction

## Rule: plan-implementability.TBU1.G1C9PP.R6 — Applicable data decisions cover purpose, store and model, schema and relationships, source of truth, ownership and access, identity and integrity, cross-system flow, lifecycle and retention, migration and backfill, compliance, and rollback at decision depth

Acceptance-matrix boundary: every row represents a distinct decision family named
by this Rule and must produce the family-specific missing-decision result shown in
the feature. Lower-level contract tests own permutations within each family.

### Scenario: Data guidance follows data-contract applicability

- [x] RED a1ab09835
- [x] GREEN 6e58244f28
- [x] REFACTOR skip: one shared field matrix drives both the eight-row acceptance proof and per-field contract mutations; no production structure changed in this requalification loop

### Scenario: Data decisions cannot be replaced by migration commands

- [x] RED c642b9967
- [x] GREEN 80e39608d
- [x] REFACTOR 790f3be0e

### Scenario: Conflicting data ownership blocks approval

- [x] RED 9845cadf0
- [x] GREEN 7a7473024
- [x] REFACTOR skip: one explicit reviewer obligation is the smallest production change; the shared semantic fixture stays reusable for the agreeing-owner control

### Scenario: Coherent data ownership permits approval

- [x] RED cec8e4aab
- [x] GREEN 7a7473024
- [x] REFACTOR skip: the paired control reuses the same reviewer and replaces duplicate ownership lines through one shared fixture builder; no production structure needs cleanup

## Rule: plan-implementability.TBU1.G1C9PP.R7 — Significant decisions also enter the durable architecture record

### Scenario: Durable recording routes only significant decisions to the architecture record

- [x] RED ca18e79a6
- [x] GREEN d2084c8c0
- [x] REFACTOR 0379b57e3

### Scenario: An unrecorded significant decision blocks approval

- [x] RED 37d445eb2
- [x] GREEN 8504f326d
- [x] REFACTOR b58e82d6f

### Scenario: Planning access permits only configured durable architecture records

- [x] RED 446fe35b9
- [x] GREEN be327806e
- [x] REFACTOR skip: two small path helpers keep physical containment separate from the direct dated-ADR policy; no further extraction has another consumer

## Rule: plan-implementability.TBU1.G1C9PP.R8 — Architectural significance uses semantic triggers

### Scenario: A one-file shared contract is significant while a many-file mechanical edit is not

- [x] RED 9410f11e6
- [x] GREEN 6c7040887
- [x] REFACTOR f76c9d7e4

## Rule: plan-implementability.TBU1.G1C9PP.R9 — One feature has one design plan of record

### Scenario: One design plan remains the feature plan of record

- [x] RED 7bdd33ed0
- [x] GREEN e3b149f29
- [x] REFACTOR skip: the shared fixture is already extracted and the contract change is one minimal rule

## Rule: plan-implementability.TBU1.G1C9PP.R10 — Implementation planning chooses proof scope and confidence without absorbing execution mechanics or the verification ledger

### Scenario: Proof scope excludes execution mechanics

- [x] RED 6b72a8724
- [x] GREEN ec3a723a5
- [x] REFACTOR 58aebd530

## Rule: plan-implementability.TBU1.G1C9PP.R11 — Behavior-shaping decisions cannot leak into execution planning

### Scenario: Decision resolution controls its Implementation Plan obligation

- [x] RED 78c997859
- [x] GREEN b3c2f898d
- [x] REFACTOR skip: the decision family loop and one contract clause are already the smallest coherent structure

### Scenario: Installed review reports every simultaneous decision blocker

- [x] RED ee611ade9
- [x] GREEN 07b38e5410
- [x] REFACTOR skip: the installed-boundary proof and shared reviewer projection are already the smallest coherent structure

## Rule: plan-implementability.TBU1.G1C9PP.R12 — Load-bearing choices carry alternatives and evidence

### Scenario: Decision evidence controls semantic review

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: plan-implementability.TBU1.G1C9PP.R13 — Decision evidence is structurally present and semantically judged

### Scenario: Evidence fields accept honest applicability without allowing empty decision coverage

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Evidence presentation does not replace evidence completeness

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: plan-implementability.TBU1.G1C9PP.R14 — Decision discovery is scope-bounded and covers the consequential trust, operation, approval, and recovery needs of every accepted persona

### Scenario: Discovery respects and updates scope only with user authority

Proof limit: the accepting scope-expansion row exercises the consumer contract
with fixture-minted authority. Sibling `5F5ZZA` owns authentic host-user-event
provenance and the end-to-end positive proof; this scenario cannot satisfy that
release prerequisite by itself.

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Persona consequence coverage controls approach approval

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Omitting one accepted persona blocks approach approval

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: plan-implementability.TBU1.G1C9PP.R15 — Review receipts expose decision reviewability and concrete recovery

### Scenario: The receipt records the focused-review judgment

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A blocked receipt gives a Non-Technical Builder a concrete recovery

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A blocked receipt preserves evidence for a Technical Builder

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: plan-implementability.TBU1.G1C9PP.R16 — When planning and implementation states coexist, the plan distinguishes proposed decisions, implemented facts, available proof, known defects, and pending human authority without treating one as another

### Scenario: Plan-state claims remain truthful

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: plan-implementability.TBU1.G1C9PP.R17 — Significant concurrency, security, durability, lifecycle, migration, and compatibility choices include the applicable state, authority, atomicity, retry, and evidence model at decision depth

Acceptance-matrix boundary: every positive/negative pair represents a distinct
significant concern family named by this Rule and must identify that family's
missing decision model. Lower-level contract tests own permutations within a
family.

### Scenario: Significant workflow decisions are complete at decision depth

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: plan-implementability.TBU1.G1C9PP.R18 — Accepted quantitative promises carry a design-level measurement contract without moving Product-owned outcomes or Execution-owned instrumentation into the Implementation Plan

### Scenario: Measurement ownership stays with the phase that owns it

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Measurement applicability is explicit

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: plan-implementability.TBU1.G1C9PP.R19 — The existing optional human design approval binds the exact semantically reviewed Implementation Plan before Execution Planning; unchanged approach bytes reuse that approval, changed approach bytes require a new decision, approval is not duplicated after the Execution Plan, headless work records pending authority without deadlocking or claiming approval, and the shared decision record preserves authority across concurrent writes, interruption, retry, contention, and compatible extensions

Proof boundary: the interactive approver-available row, the accepted and declined
design scenarios, and the review-blocked no-prompt scenario must drive the
installed CLI through a real terminal/PTY human-input boundary; an injected
in-process prompter cannot satisfy RED or GREEN. The other non-interactive rows
prove their outcomes from CLI exit state, ticket phase, and the project-local
receipt.

Contention proof boundary: the fixture holding the first writer releases only
after the second invocation's configured bounded contention timeout has elapsed.

Headless reviewable-output delivery — skip: sibling `YCFFNC` owns installed host
delivery of the reviewed approach; this ticket proves pending authority and
nonblocking behavior at the canonical CLI boundary.

### Scenario: Installed CLI human design authority follows configuration

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A declined design returns to Implementation Planning

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: An accepted design enters Execution Planning

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A review-blocked design is never presented for human approval

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Human design authority follows approach currency

Proof limit: this scenario proves only whether human design approval still
binds the exact current approach bytes. Sibling `5F5ZZA` owns semantic review
record invalidation, provenance changes, and context-digest recomputation.

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Concurrent design decisions do not overwrite each other

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: An interrupted approval resumes according to durable authority

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Retrying the same design approval does not duplicate authority

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Approval-ledger contention fails closed without changing authority

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A design decision preserves compatible approval-ledger extensions

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A completed Execution Plan does not trigger a second design approval

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A completed Execution Plan cannot preserve stale design approval

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: plan-implementability.TBU1.G1C9PP.R20 — An incomplete or incorrect plan returns to decision discovery with the full current set of blocking defects and is corrected and re-reviewed on its new exact bytes until complete and correct or honestly waiting on an external decision

### Scenario: Review repairs every known plan defect before execution planning

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: External authority pauses repair without disguising the plan as complete

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Every corrected plan is re-reviewed until its current bytes are clean

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Feature-level cross-scenario refactor

- [ ] cross-scenario
