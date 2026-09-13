# Implementation Plan: Complete contributions with a default Delivery Checklist

**Status:** planned
**Planned on:** 2026-09-12

## Approach

### Architecture at a glance

The Execution Plan becomes the single source of truth for delivery obligations
and their proof:

1. Execution Planning writes a versioned Delivery Checklist and Proof
   Specifications into `execution-plan.md`.
2. `plan-execution` review authenticates the stable definition: obligations,
   owners, proof boundaries, reviewed applicability, PR slicing, and the live
   `designApprovalGate` setting.
3. During implementation, Safeword runs only the retained proof invocation or
   resolves the retained review target. It writes successful receipts to the
   existing review ledger and updates only the checklist's progress fields.
4. Readiness is derived from the reviewed definition and ledger-validated
   receipts. Checklist text cannot grant approval or merge authority.
5. A private prerequisite helper lets 7CAMAD stop a feature's first execution
   edit when accepted scenarios, an accepted approach, or an admitted checklist
   is missing. YCFFNC later connects that helper to installed hosts.

This child owns the checklist, proof, and prerequisite-helper contracts.
The accepted PR-slicing contract from 6XW8H7 must be present in the merge
branch before A639WN merges; A639WN extends that contract rather than defining
a competing slicing format.
7CAMAD owns phase provenance and live first-edit composition; 5F5ZZA owns
authenticated host-user provenance and broader plan invalidation; YCFFNC owns
installed-host delivery; 3EG00H owns proportional task and patch behavior; and
K3EBHB owns final cross-host recovery language.

### Riskiest assumption

The riskiest assumption is that a passing receipt proves the reviewed boundary,
not merely that an arbitrary exit-zero command ran. The first retained slice
therefore proves that Safeword executes only reviewed `cwd` and `argv` values,
with no shell, TTY, stdin, or caller substitution. Evidence derivation must then
complete an item only for the required real-boundary Proof ID and must leave a
narrower or stale result incomplete.

This proves invocation integrity and evidence classification. It cannot prove
that a contributor preserved the meaning of mutable test code; plan review and
revision currency address that separate risk.

### Proof strategy

| Behavior | Primary proof and real boundary | Confidence limit |
| --- | --- | --- |
| Checklist shape | Integration tests parse a generated Execution Plan, remove each required category, and mutate every stable field. | Structure cannot prove semantic relevance. |
| Scenario and approach coverage | Plan-execution conformance accepts obligations derived from the accepted ticket and rejects a generic checklist. | Model sampling is not deterministic across future reviewer versions. |
| Retained proof invocation | A real child process runs retained project-contained arguments and rejects caller substitutions and escaping paths. | Safeword supplies the reviewed values unchanged, but PATH can resolve a bare executable differently; a receipt does not prove mutable test code remains honest. |
| Review identity | Integration tests prove ordinary progress preserves plan approval while any stable-definition change requires re-review. | 5F5ZZA owns invalidation outside this checklist definition. |
| Evidence currency | Git-backed integration tests cover current, earlier, partial, mismatched, dirty, and compatible-earlier evidence. | Ignored files remain outside the contribution snapshot. |
| Compatibility judgment | Semantic conformance approves an unrelated documentation delta and rejects changes to the retained proof boundary. | A semantic reviewer can still make a judgment error. |
| Atomic progress | Integration tests race checklist edits and ledger appends; both fail closed or preserve every accepted event. | Normal source-control conflicts remain possible. |
| Failure recovery | A type-level exhaustive map and integration test require one concrete action for every repairable refusal code. | The map cannot prove that a future action is the best operational advice. |
| PR slicing | Deterministic admission validates the retained one-versus-many record; semantic review judges its rationale. | Structure cannot decide whether a slice is coherent. |
| Readiness and authority | Real CLI tests exercise all readiness states and prove contributor text cannot create approval or merge authority. | Generic human dependencies remain pending without an authoritative recorder. |
| First-execution prerequisite | A real helper process denies missing approvals or checklist admission in fixed order and never turns a phase denial into an allow. | This does not satisfy R1's CLI-surface scenarios; 7CAMAD and YCFFNC own live composition and installed dispatch. |
| Feature-only placement | Feature fixtures use `execution-plan.md`; task and patch fixtures receive no feature artifact. | 3EG00H owns the later small-work contract. |
| Documentation parity | Schema, parity, catalogue, machine-contract, and generated-rubric tests keep canonical and host-facing contracts aligned. | YCFFNC owns installed-host activation. |

### Build order

1. **Define trustworthy contracts.** Add the typed Proof Specification and
   Delivery Checklist model, strict parser, stable-definition projection,
   evidence derivation, and retained no-shell proof worker. The checklist
   modules remain unreachable from production; executable-RED uses the
   extracted seam through a behavior-preserving compatibility wrapper.
2. **Make the checklist usable.** Extend plan-execution review, the shared
   ledger, the canonical template and guidance, and two public CLI operations:
   read readiness and record one proof. Add compatible-earlier review and
   regenerate host mirrors. Ship the full-diff egress disclosure with the proof
   command.
3. **Expose the prerequisite helper.** Add the private evaluator and fixed
   recovery results that 7CAMAD can compose with the first-execution boundary.

The authoritative task order, test files, commands, and three independently
reviewable PR boundaries live in [execution-plan.md](./execution-plan.md).

## Decisions

### Recorded Decisions

**Decision:** Keep one human-readable checklist source of truth.

**Choice:** Store one versioned, typed Delivery Checklist in
`execution-plan.md`; reject missing or malformed structure without rewriting it.

**Alternative considered:** Prose-only review, or a JSON/YAML sidecar mirrored
into Markdown.

**Rejected because:** Prose cannot enforce state invariants. A sidecar creates
competing authority and a synchronization boundary.

**Evidence reference:** [Execution Plan template](https://github.com/ArcadeAI/safeword/blob/8a87b38f5df4a66a0c33c526d351ae326c730025/packages/cli/templates/doc-templates/execution-plan-template.md) and [readiness parser pattern](https://github.com/ArcadeAI/safeword/blob/8a87b38f5df4a66a0c33c526d351ae326c730025/packages/cli/src/pr-review/readiness.ts)

**Retrieval date:** 2026-09-12

**Applicable version:** Safeword 0.83.1 plus this unreleased branch; no new
dependency, license, redistribution, or external-service boundary.

**Decision:** Separate reviewed obligations from delivery progress.

**Choice:** Review identity includes item identity, category, obligation,
owner, required proof, Proof Specification, reviewed applicability, PR slicing,
and `designApprovalGate`. Ordinary completion evidence is mutable.

**Alternative considered:** Hash every checklist byte, or exclude the whole
checklist from review identity.

**Rejected because:** The first forces re-review after every proof. The second
lets a contributor remove or weaken an approved obligation.

**Evidence reference:** [Conformance-Gated Execution Plan Review](../../../ARCHITECTURE.md#conformance-gated-execution-plan-review)

**Retrieval date:** 2026-09-12

**Applicable version:** The accepted #4200 planning architecture; no external
data or dependency boundary.

**Decision:** Derive readiness without granting authority.

**Choice:** Authenticated receipts satisfy contributor obligations. Reviewed
human dependencies remain pending. Only the existing digest-bound design
approval can satisfy its matching dependency, and no checklist state authorizes
a merge.

**Alternative considered:** One ready checkbox, contributor-authored evidence,
or treating a human handoff as completion.

**Rejected because:** Each alternative can report completion without proof or
silently convert contributor work into human risk.

**Evidence reference:** [approval ledger](https://github.com/ArcadeAI/safeword/blob/8a87b38f5df4a66a0c33c526d351ae326c730025/packages/cli/src/review/approval-ledger.ts) and [interactive approval boundary](https://github.com/ArcadeAI/safeword/blob/8a87b38f5df4a66a0c33c526d351ae326c730025/packages/cli/src/commands/plan-approval.ts)

**Retrieval date:** 2026-09-12

**Applicable version:** Safeword 0.83.1 plus the accepted #4200 authority
boundaries.

**Decision:** Bind command proof to a clean contribution snapshot.

**Choice:** A command receipt retains the producing Git revision. It remains
current only while that revision is an ancestor, `git diff` reports no later
committed change, and `git status --porcelain=v1 --untracked-files=all` reports
no tracked or untracked non-ignored working-tree change outside the
delivery-progress normalization. That normalization excludes only this ticket's
Execution Plan, the shared review ledger, and machine-owned phase/work-log fields
in its `ticket.md`. Changing ticket scope, acceptance, or other authored content
still stales proof. A missing repository or unusable Git command refuses proof
recording.

**Alternative considered:** Exact-HEAD identity, currency across every later
commit, or a second working-tree manifest.

**Rejected because:** Exact HEAD makes the receipt-writing commit stale.
Blanket currency upgrades changed code. A second manifest duplicates Git and
creates another normalization contract.

**Evidence reference:** [git diff](https://git-scm.com/docs/git-diff) and [Git data model](https://git-scm.com/docs/gitdatamodel)

**Retrieval date:** 2026-09-12

**Applicable version:** Current Git revision semantics and this unreleased
checklist model.

**Decision:** Expose separate readiness and proof-recording operations.

**Choice:** One read-only CLI leaf projects state; one mutating leaf runs or
resolves a retained proof and records the result. Both use the existing typed
catalogue and response envelope.

**Alternative considered:** Hide both inside hooks, combine them into one
modeful command, reuse executable-RED unchanged, or create another proof store.

**Rejected because:** Hooks are not a user-reachable boundary; a modeful leaf
cannot declare honest effects; executable-RED carries an unrelated semantic
contract; another store creates competing authority.

**Evidence reference:** [typed CLI catalogue](https://github.com/ArcadeAI/safeword/blob/8a87b38f5df4a66a0c33c526d351ae326c730025/packages/cli/src/cli-protocol/catalog.ts), [no-shell worker](https://github.com/ArcadeAI/safeword/blob/8a87b38f5df4a66a0c33c526d351ae326c730025/packages/cli/src/review/red-execution.ts), and [shared ledger](https://github.com/ArcadeAI/safeword/blob/8a87b38f5df4a66a0c33c526d351ae326c730025/packages/cli/src/review/approval-ledger.ts)

**Retrieval date:** 2026-09-12

**Applicable version:** Safeword 0.83.1 plus this unreleased command surface.

**Decision:** Require independent judgment before reusing earlier proof.

**Choice:** A dedicated `delivery-compatibility` review compares one earlier
receipt and contributor reason with the complete bounded diff to the current
revision. Only a cross-agent approval over the exact request can create a
`delivery-compatibility:v1` ledger event.

**Alternative considered:** Trust contributor prose, re-review the whole
Execution Plan, use generic quality review, or accept a caller-supplied review
ID.

**Rejected because:** None asks and authenticates the exact question: whether
the earlier receipt still proves this retained boundary now.

**Evidence reference:** [review coordinator](https://github.com/ArcadeAI/safeword/blob/8a87b38f5df4a66a0c33c526d351ae326c730025/packages/cli/src/review/coordinator.ts) and [review evidence principle](../../../PRINCIPLES.md#1-structure-enforces-instructions-suggest)

**Retrieval date:** 2026-09-12

**Applicable version:** Safeword 0.83.1 plus this unreleased review kind.

**Decision:** Keep plan approval current across evidence progress.

**Choice:** The plan-execution packet hashes the whole plan after normalizing
only ordinary contributor progress. Reviewed `not_applicable` reasons, human
dependencies, proof definitions, PR slicing, configuration, and `Status` remain
stable content.

`Status` changes only during explicit Execution Plan reconciliation and
requires a new plan-execution review; ordinary phase progress does not mutate it.

**Alternative considered:** Complete every review-backed item atomically, or
move reviewed identity into a third artifact.

**Rejected because:** Atomic completion couples independent obligations. A
third artifact violates the single-plan source of truth.

**Evidence reference:** [Conformance-Gated Execution Plan Review](../../../ARCHITECTURE.md#conformance-gated-execution-plan-review)

**Retrieval date:** 2026-09-12

**Applicable version:** The accepted #4200 plan-execution contract.

### State and validation contract

#### Public operations

| Operation | Effect | Successful result |
| --- | --- | --- |
| `ticket delivery-checklist` | Read and validate the admitted checklist; execute nothing. | One readiness state and at most one next action. |
| `ticket record-delivery-proof` | Run or resolve one retained Proof ID, append a passing receipt, then atomically update one row. | The recorded proof and next open obligation. |

`record-delivery-proof` accepts an item ID and retained Proof ID. Earlier proof
reuse also requires both `--receipt` and `--compatible-reason`; supplying only
one is invalid. The command executes retained arguments directly, closes stdin,
inherits no TTY, and is unavailable under `--offline` because the child command
may use the network. Neither operation prompts for confirmation.

Both operations use the typed v1 CLI envelope. The response contract is:

| Status and exit | Outcomes |
| --- | --- |
| `changed`, 0 | A retained proof passed and was recorded, or an accepted compatibility review reused an earlier receipt. |
| `action_required`, 2 | Every readiness state; missing or invalid plans and approvals; dirty proof subjects; failed or offline proof commands; missing categories or slicing; invalid owner, proof, or evidence claims; stable-definition or write conflicts; and stale compatibility review. |
| `failed`, 1 | Invalid arguments, unreadable ledgers, and unsafe writes. |

Every repairable failure has one stable code and one concrete recovery action;
the [Execution Plan](./execution-plan.md#tasks-and-tests) owns the exhaustive
code-to-recovery test. Readiness never exits 0 because merge authorization
remains separate; `healthy` is deliberately unreachable for this projection.

Compatibility review maps each terminal condition explicitly:

| Condition | Code | Recovery action |
| --- | --- | --- |
| Review still running | `compatibility_review_pending` | Retry the same proof-recording command after the named review finishes. |
| Reviewer rejects compatibility | `compatibility_review_denied` | Run the retained proof again at the current revision. |
| Reviewer authentication is missing | `compatibility_review_authentication_required` | Run the coordinator's exact authentication recovery command, then retry. |
| Every configured route is exhausted | `compatibility_review_unavailable` | Run the retained proof again at the current revision. |
| Cross-agent review is disabled | `compatibility_review_disabled` | Run the retained proof again at the current revision. |
| Accepted review no longer matches the request or revision | `compatibility_review_stale` | Repeat compatibility review for the current request or rerun the retained proof. |
| Diff is incomplete, binary, or oversized | `compatibility_diff_unavailable` | Run the retained proof again at the current revision. |
| Existing egress scanning detects a secret | `compatibility_sensitive_content` | Run the retained proof again at the current revision. |

One exported closed `DeliveryChecklistRepairCode` union owns every repairable
code. A total `Record<DeliveryChecklistRepairCode, RecoveryAction>` owns the
message and action, and every repairable finding emitter accepts only that
union. Adding a code without recovery therefore fails typecheck; the recovery
test iterates that record instead of maintaining a second case list.

#### Reviewed model

Each Proof Specification defines a unique Proof ID, method (`command` or
`review_receipt`), proof scope, exercised boundary, qualifying class, currency
policy, and typed invocation. Command working directories and review targets
must remain inside the project. At least one contributor-owned testing item must
use a command reviewed as real-boundary proof.

Qualifying class is the closed set `real_boundary` and
`partial_or_structural`. Deterministic admission validates the closed value and
references; plan-execution review judges whether the named method can actually
exercise the claimed boundary.

Each checklist item has stable planning fields—ID, category, obligation, owner,
and required Proof ID—and mutable progress fields—disposition, evidence class,
revision, and evidence locator. Reviewed `not_applicable` reasons and human
`pending_human` dependencies are stable applicability decisions, not ordinary
progress. The parser rejects unknown values, malformed rows, missing categories,
duplicate IDs, invalid owners, and unresolved or non-real-boundary required
proofs without filling defaults or rewriting the file.

Evidence class is the closed set `current_revision_real_boundary`,
`reusable_earlier_revision`, `partial_or_structural`, and `missing`. Row text is
only a projection: the evaluator derives any stronger class from authenticated
ledger evidence.

The eleven required categories are: outcome and scope; resolved decisions;
dependency and pull-request decomposition; testing; data and compatibility;
monitoring and failure signals; security and privacy; rollout and rollback;
documentation; ownership and human dependencies; and completion evidence.

#### Dispositions and readiness

| Disposition | Owner and evidence rule |
| --- | --- |
| `open` | Contributor-owned; may retain supporting evidence but remains incomplete. |
| `complete` | Contributor-owned; requires current real-boundary evidence for the exact Proof ID, or accepted reusable-earlier evidence when that proof's policy permits it. Row text without a ledger-validated receipt is incomplete. |
| `not_applicable` | Contributor or human; requires a concrete reason already admitted by plan-execution review and makes no evidence claim. |
| `pending_human` | Human-owned; requires a named dependency already admitted by plan-execution review, has an empty Required proof, and makes no contributor-proof claim. |

The projection first checks whether any contributor obligation remains open,
then chooses among these states from the reviewed human dependencies and their
authenticated satisfaction:

1. `contributor_work_incomplete` when any contributor obligation remains open.
2. `ready_for_human_review` when contributor work is proven and a human
   dependency remains.
3. `human_approval_satisfied_merge_pending` when the recognized design approval
   was required, is satisfied, and no other human dependency remains.
4. `contributor_work_complete` when the reviewed definition required no human
   dependency. A reviewed human item marked `not_applicable` is not a required
   dependency and therefore follows this state.

Every state says merge authorization is still pending. Only a
`design-approval:<ticket>:<impl-plan-digest>` dependency can be satisfied by the
existing approval ledger. Changing this Implementation Plan invalidates that
dependency until Execution Planning and human approval record the new digest.
When `designApprovalGate` is disabled, review retains a `not_applicable` design
approval item with that reason; changing the setting invalidates the stable
definition in either direction.

#### Evidence currency and compatibility

A `delivery-proof:v1` receipt binds the ticket, item, Proof ID, reviewed method,
scope and boundary, producing revision, invocation, outcome, and output hashes
or source review. The evaluator derives evidence class and revision from the
receipt; editable row text cannot strengthen either value. A foreign,
mismatched, partial, or missing receipt leaves the item open. A failed proof
attempt writes no receipt and also leaves the item open.

Current command evidence requires the clean contribution snapshot described in
the recorded decision. Plan-execution review receipts instead follow the
normalized logical plan identity. A receipt for another Proof ID may remain
visible as supporting evidence but cannot complete the item.
An earlier receipt for a `current_required` proof is
`partial_or_structural`, not reusable. Only an accepted compatibility review
for a `compatible_earlier_allowed` proof yields
`reusable_earlier_revision`.
For an earlier partial receipt, readiness reports both the evidence class and
its producing revision so the two gaps remain visible.
Proof Specifications classified `partial_or_structural` are supporting
evidence only and cannot be a checklist item's Required proof.

The strongest evidence class binds reviewed source and invocation, not
gitignored installed bytes. A changed lockfile stales evidence because it is in
Git; a changed `node_modules` tree does not. The receipt must expose the runtime
identity it observed so a reviewer can see that limit. Editing
`impl-plan.md` also stales every command receipt because that file is outside
the delivery-progress normalization.

For `compatible_earlier_allowed`, Safeword creates a deterministic ignored
review request containing the exact receipt identity, retained definition,
reason, revision pair, and complete bounded Git diff. An incomplete, binary,
oversized, or revision-mismatched diff refuses review and tells the contributor
to rerun the proof. The reviewer must reject when any changed hunk affects code,
tests, fixtures, command inputs, configuration, or dependencies used by the
proof, or when the reason does not cover the whole diff. The acceptance remains
current only while its reviewed revision stays an ancestor and no later change
exists outside the same delivery-progress normalization.

Before dispatch, the generated request passes through Safeword's existing
secret-detection boundary. A detected secret refuses egress. The structural
check does not identify every form of customer-sensitive content, so the
authoring prohibition remains in force for anything the detector cannot know.

#### Atomicity, retries, and trust

The ledger reuses its existing lease, fencing token, inside-lock reread,
unknown-event preservation, and atomic same-directory replacement. A proof
receipt is appended only after a passing invocation and a second clean-subject
check. The checklist row then updates only if the complete file still matches
its pre-proof snapshot. A conflicting edit leaves the receipt available for an
idempotent retry and never runs the same command twice for the same ticket,
item, Proof ID, revision, and reviewed definition.

This is a same-user project-file trust boundary, not an OS sandbox. The
project-containment rule applies to the working directory and review targets;
retained argv is opaque reviewed input, and a bare executable may resolve
through PATH. No-shell execution limits interpretation but cannot make an
untrusted checkout safe: a checkout can supply both the retained command and
apparently valid local records. The user's explicit decision to run the proof
command is the only M1 execution authority. Direct fabrication of a well-formed
ledger event by an actor inside this same-user trust boundary is out of scope
for M1.
5F5ZZA owns authenticated host-user provenance before wider activation.
Credentials, customer data, and secret-bearing evidence are prohibited from
checklist and review-request content.

#### First-execution prerequisite

The private helper runs after the existing phase-access check and may only add a
denial. For a feature whose phase provenance carries
`executionPlanContractVersion: 1`, it checks in order:

1. current accepted scenario-gate approval;
2. current accepted Implementation Plan approval; and
3. current checklist admission and stable definition.

One response reports both missing planning approvals in scenarios-before-
approach order. Each denial names the stopped boundary and one recovery action.
Tickets without that persisted marker are legacy-exempt. 7CAMAD writes the
marker before a ticket advances from plan-execution and supplies the live
composition; this child supplies and directly proves only the helper.

The three R1 `@surface.safeword-cli` ledger rows must not use helper-only proof.
They remain unchecked until 7CAMAD composes the helper and YCFFNC supplies the
installed CLI dispatch proof. A639WN may finish its other scenarios but cannot
enter `done` until those real-boundary proofs land.

### Data applicability

Data applicability: the feature changes the persistent Execution Plan and
review-ledger contracts, not application or customer data.

| Concern | Decision |
| --- | --- |
| Purpose | Retain delivery obligations, ownership, disposition, proof identity, and evidence currency. |
| Store and model | `execution-plan.md` owns checklist state; the existing review ledger owns authenticated proof and compatibility events; ignored request files are transient reviewer input. |
| Relationships | Stable checklist items reference retained Proof IDs; receipts bind one ticket, item, proof, and revision. |
| Source of truth | The Execution Plan owns obligations and progress. Review records authenticate stable identity; ledger events authenticate evidence and approvals. |
| Ownership and access | Contributors update contributor progress. Only existing human authority paths can satisfy human dependencies. Checklist state cannot approve or merge. |
| Identity and integrity | Version markers, closed enums, stable digests, Git ancestry, exact event bindings, atomic writes, and reviewer provenance fail closed. |
| Cross-system flow | None in M1. YCFFNC later installs the same contract across hosts. |
| Lifecycle and retention | Create before plan approval, update during execution, and retain checklist state plus compatibility requests with the ticket until ticket cleanup. |
| Migration and backfill | On the next plan-execution entry, add the current sections to an existing unreviewed plan while preserving decisions and slices. Existing implement/verify tickets remain exempt until they re-enter the phase. Malformed sections are never repaired automatically. |
| Compliance | Store no credentials, customer data, or secret-bearing evidence. This introduces no new data classification. |
| Rollback | Stop generating and requiring the versioned section before release; existing Markdown and unknown ledger events remain inert and grant no authority. |

### Measurement applicability

Measurement applicability: skip: the accepted Product Plan makes no
quantitative promise for this child. Evidence revision and class are integrity
attributes, not product metrics.

## Persona consequences

| Persona | Consequence | Confidence limit |
| --- | --- | --- |
| Technical Builder | Sees every obligation, evidence class, revision, and next action in one execution artifact. | Earlier evidence still needs explicit semantic judgment. |
| Non-Technical Builder | Gets plain readiness language separating contributor work, human dependency, approval, and merge authority. | K3EBHB owns final wording across installed hosts. |
| Safeword Maintainer | Maintains one closed parser and one generated phase contract instead of a mirrored sidecar. | Strict Markdown is a versioned compatibility surface. |

## Design alignment

| Principle | Consequence | Proof | Conflict |
| --- | --- | --- | --- |
| Structure enforces; instructions suggest | Closed state and authenticated receipts enforce final readiness; recording cadence remains instructional. | Proof strategy — Readiness and authority | explicit-conflict |
| Add, never replace | The checklist extends the existing Execution Plan and ledger; it replaces only the unreleased provisional checklist shape. | Proof strategy — Atomic progress | explicit-conflict |
| Discover decisions before prescribing work | Accepted decisions and PR slicing become reviewed obligations before tasks begin. | Proof strategy — Scenario and approach coverage; PR slicing |  |
| Fire at boundaries, not every turn | Validation runs at plan review, proof recording, readiness, and first execution. | Proof strategy — First-execution prerequisite; Atomic progress |  |
| Optimize for the NTB without constraining the TBU | Plain readiness leads; detailed proof identity remains available. Applicability changes require re-review. | Proof strategy — Readiness and authority | explicit-conflict |
| Contribute, then converge | Every refusal names the observed state and one recovery action. | Proof strategy — Failure recovery |  |
| Correct and safe; then clear; then simple | One typed Markdown source reuses existing Git, review, ledger, and CLI boundaries. | Proof strategy — Evidence currency; Feature-only placement |  |

Architecture applicability: this shared workflow-contract extension honors
[Separate Implementation and Execution Planning Gates](../../../ARCHITECTURE.md#separate-implementation-and-execution-planning-gates)
and [Typed CLI Execution and Discovery](../../../ARCHITECTURE.md#typed-cli-execution-and-discovery).
It extends [Conformance-Gated Execution Plan Review](../../../ARCHITECTURE.md#conformance-gated-execution-plan-review)
with another retained plan section and
[Digest-Bound Planning Decisions in the Shared Review Ledger](../../../ARCHITECTURE.md#digest-bound-planning-decisions-in-the-shared-review-ledger)
with new event kinds that use the same digest-binding and unknown-event rules.
Neither changes or contradicts the accepted decisions, so their current records
remain authoritative and no superseding record is required. The existing
`A639WN extension` paragraphs in those records are this ticket's
decision-bearing architecture record.

## Known deviations

- **Structure enforces; instructions suggest:** Final readiness is structural,
  but recording proof at each clean task boundary remains instruction-backed
  because Safeword has no host-neutral task-transition event. Later source edits
  retain those receipts as visible earlier-revision evidence but make every
  `current_required` item incomplete until its proof runs again at the final
  revision. Final receipts do not prove when earlier recording occurred. Add a
  one-shot task-boundary signal only if contributors routinely defer all
  recording to the end. Final reruns are expected under the current currency
  rule; intermediate receipts provide progress visibility, not saved execution.
- **Add, never replace:** This replaces the unreleased seven-line provisional
  checklist because it cannot express ownership, evidence currency, or partial
  progress. Preserving both would create two contracts.
- **Optimize for the NTB without constraining the TBU:** Changing an obligation
  to `not_applicable` requires plan-execution re-review. The extra friction keeps
  contributor self-report from dismissing accepted work.
- **Sibling activation boundary:** This child proves the shared prerequisite
  helper, not installed first-edit behavior. R1 remains incomplete at epic level
  until 7CAMAD composes the helper and YCFFNC ships host dispatch. The matching
  R1 ledger rows stay unchecked, so A639WN cannot close early.
- **Generic human dependencies:** Only the existing digest-bound design approval
  has an authoritative satisfaction source. Every other human dependency stays
  pending.
- **Secret handling:** Compatibility requests reuse Safeword's existing
  structural secret detector before egress. Prohibiting undetectable customer
  data and other sensitive context remains an authoring and trust-boundary rule.
- **Compatibility-review egress:** The generated request can contain the full
  bounded contribution diff, not only files named by the Proof Specification.
  Supplying both earlier-reuse options is the explicit request to use the
  configured external reviewer; command help and public documentation state the
  full-diff boundary. Never include credentials, customer data, or
  secret-bearing files in the contribution range.
- **Compatible-earlier scope:** M1 keeps compatibility review because a later
  unrelated documentation-only change should not force an expensive proof to
  rerun. Deferring promotion would leave the required
  `reusable_earlier_revision` class permanently non-completing; dedicated
  conformance and coordinator-wiring tests exercise the path without pretending
  a boundary-changing later slice is compatible.
- **Untrusted checkout activation:** PR 2 exposes the same explicit, no-shell,
  same-user execution boundary already used by executable-RED. Automatic
  invocation remains disabled until 5F5ZZA supplies authenticated host-user
  provenance.

## Doc impact

- Update the public CLI reference with readiness states, evidence classes, and
  the authority boundary. State that explicit earlier-proof reuse sends the
  complete bounded contribution diff—not only Proof Specification paths—to the
  configured external reviewer.
- Update canonical Execution Planning guidance and the template; regenerate
  Claude, Cursor, Codex, and OpenCode mirrors.
- Extend the current architecture records only with non-decision-bearing
  description of the retained checklist and ledger event kinds.
- README: skip: the README does not enumerate planning artifact fields.

## Assessment triggers

- The proof recorder reaches an untrusted checkout before authenticated
  host-user provenance exists: stop rollout or add that authority check.
- Evidence-only progress invalidates plan approval: fix stable/mutable
  normalization before activation.
- Contributors repeatedly defer all proof recording: consider one task-boundary
  signal.
- Applicability changes routinely force re-review: add a separately reviewed
  applicability lane without making contributor prose authoritative.
- Routine unrelated commits repeatedly stale proof: narrow revision currency
  only with evidence that the affected boundary can be identified safely.
- A proof target changes while retained invocation stays fixed: require renewed
  semantic review of that proof definition.
- Malformed but plausible Markdown becomes common: replace the parser only if a
  more robust human-readable format avoids a second source of truth.
- A new default category or human authority source becomes necessary: extend the
  phase contract instead of accepting project-local drift.
- Source control is no longer enough for concurrent checklist edits: reassess
  the single-artifact model before adding another store.
