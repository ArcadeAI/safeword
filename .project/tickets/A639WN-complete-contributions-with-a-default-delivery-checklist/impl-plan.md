# Implementation Plan: Complete contributions with a default Delivery Checklist

**Status:** planned

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
5. The public `ticket execution-prerequisite` command returns a deny-only
   verdict from the same evaluator that 7CAMAD later composes into coding
   authorization. YCFFNC later connects that composed gate to agent hosts.

This child owns the checklist, proof, and public prerequisite contracts and
consumes 6XW8H7's accepted PR-slicing contract without defining a competing
format.
7CAMAD owns coding authorization and phase provenance; 5F5ZZA owns
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
| executable-RED compatibility | Existing real-process regressions re-prove literal failure matching, timeout and descendant termination, and internal-review environment scrubbing through the compatibility wrapper. | These tests protect the shipped RED contract, not the new checklist semantics. |
| Review identity | Integration tests prove ordinary progress preserves plan approval while any stable-definition change requires re-review. | 5F5ZZA owns invalidation outside this checklist definition. |
| Evidence currency | Git-backed integration tests cover current, earlier, partial, mismatched, dirty, and compatible-earlier evidence. | Ignored files remain outside the contribution snapshot. |
| Compatibility judgment | Semantic conformance approves an unrelated documentation delta and rejects changes to the retained proof boundary. | A semantic reviewer can still make a judgment error. |
| Atomic progress | Deterministic crash and injected-conflict tests prove retry uses the saved plan digest, never reruns accepted proof, and preserves every ledger event; racing is supplementary. | Normal source-control conflicts remain possible. |
| Failure recovery | A type-level exhaustive map and integration test require one concrete action for every repairable refusal code. | The map cannot prove that a future action is the best operational advice. |
| PR slicing | Semantic conformance judges the one-versus-many rationale; an installed-CLI review denial proves missing slicing leaves checklist progress unchanged and returns one decision-specific repair action. | The deterministic CLI test uses a trusted reviewer fixture; the separately admitted live conformance matrix proves the semantic judgment. |
| Readiness and authority | Real CLI tests exercise all readiness states and prove contributor text cannot create approval or merge authority. | Generic human dependencies remain pending without an authoritative recorder. |
| Execution prerequisite | Real installed-CLI tests deny missing accepted scenarios, accepted approach, or checklist admission in fixed order and return only a prerequisite verdict. | 7CAMAD owns coding authorization; YCFFNC owns agent-host dispatch. |
| Feature-only placement | Feature fixtures use `execution-plan.md`; task and patch fixtures receive no feature artifact. | 3EG00H owns the later small-work contract. |
| Documentation parity | Schema, parity, catalogue, machine-contract, and generated-rubric tests keep canonical and host-facing contracts aligned. | YCFFNC owns installed-host activation. |

### Execution boundary

[execution-plan.md](./execution-plan.md) owns task order, test files, commands,
current proof, and independently reviewable pull-request slices. This plan owns
the design those tasks must preserve.

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

**Retrieval date:** 2026-09-13

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

**Retrieval date:** 2026-09-13

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

**Retrieval date:** 2026-09-13

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

**Evidence reference:** [git diff](https://git-scm.com/docs/git-diff) and
[Git glossary](https://git-scm.com/docs/gitglossary)

**Retrieval date:** 2026-09-13

**Applicable version:** Current Git revision semantics and this unreleased
checklist model.

**Decision:** Separate execution prerequisite, readiness, and proof recording.

**Choice:** One read-only CLI leaf reports the execution prerequisite, another
projects delivery readiness, and one mutating leaf records retained proof. All
three use the existing typed catalogue and response envelope.

**Alternative considered:** Hide them inside hooks, combine them into one
modeful command, reuse executable-RED unchanged, or create another proof store.

**Rejected because:** Hooks are not a user-reachable boundary; a modeful leaf
cannot declare honest effects; executable-RED carries an unrelated semantic
contract; another store creates competing authority.

**Evidence reference:** [typed CLI catalogue](https://github.com/ArcadeAI/safeword/blob/8a87b38f5df4a66a0c33c526d351ae326c730025/packages/cli/src/cli-protocol/catalog.ts), [no-shell worker](https://github.com/ArcadeAI/safeword/blob/8a87b38f5df4a66a0c33c526d351ae326c730025/packages/cli/src/review/red-execution.ts), and [shared ledger](https://github.com/ArcadeAI/safeword/blob/8a87b38f5df4a66a0c33c526d351ae326c730025/packages/cli/src/review/approval-ledger.ts)

**Retrieval date:** 2026-09-13

**Applicable version:** Safeword 0.83.1 plus this unreleased command surface.

**Decision:** Require independent judgment before reusing earlier proof.

**Choice:** A dedicated `delivery-compatibility` review compares one earlier
receipt and contributor reason with the complete bounded diff to the current
revision. Only a cross-agent approval over the exact request can create a
`delivery-compatibility:v1` ledger event.

**Alternative considered:** Trust contributor prose, re-review the whole
Execution Plan, use generic quality review, accept a caller-supplied review ID,
or send only files named by the Proof Specification.

**Rejected because:** The first four do not ask and authenticate whether the
earlier receipt still proves this retained boundary now. A named-file-only diff
can omit a changed dependency, configuration value, fixture, or caller that
invalidates the proof, allowing a false compatibility approval.

**Evidence reference:** [review coordinator](https://github.com/ArcadeAI/safeword/blob/8a87b38f5df4a66a0c33c526d351ae326c730025/packages/cli/src/review/coordinator.ts) and [review evidence principle](../../../PRINCIPLES.md#1-structure-enforces-instructions-suggest)

**Retrieval date:** 2026-09-13

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

**Retrieval date:** 2026-09-13

**Applicable version:** The accepted #4200 plan-execution contract.

#### Reversibility and boundaries

| Decision | Reversal | Dependency, license, and security boundary |
| --- | --- | --- |
| Checklist source | Stop generating and requiring the section; retained Markdown stays inert. | Project-local Markdown; no new dependency or license. |
| Stable definition | Remove admission before release; retained review data stays inert. | Existing local reviewer and ledger only. |
| Readiness authority | Remove the projections without changing human authority. | Existing approval paths remain authoritative. |
| Git snapshot | Stop accepting command receipts; retain their audit history. | Existing Git CLI; ignored files remain outside proof. |
| Public operations | Remove their catalogue entries and handlers. | Same-user local execution; no OS sandbox is claimed. |
| Compatibility review | Disable earlier-proof reuse; retained events grant nothing. | Explicit full-diff egress to the configured reviewer after secret scanning. |
| Plan currency | Revert to full-plan invalidation before release. | Existing project-local review ledger. |

### State and validation contract

#### Public operations

| Operation | Effect | Successful result |
| --- | --- | --- |
| `ticket delivery-checklist` | Read and validate the admitted checklist; execute nothing. | One readiness state, every open obligation, and at most one next action. |
| `ticket record-delivery-proof` | Run or resolve one retained Proof ID, append a passing receipt, then atomically update one row. | The recorded proof, every remaining open obligation, and at most one next action. |
| `ticket execution-prerequisite` | Check accepted scenarios, the accepted approach, and checklist admission; execute nothing and grant no authority. | One satisfied prerequisite verdict. |

`record-delivery-proof` accepts an item ID and retained Proof ID. Earlier proof
reuse also requires both `--receipt` and `--compatible-reason`; supplying only
one is invalid. The command executes retained arguments directly, closes stdin,
inherits no TTY, and is unavailable under `--offline` because the child command
may use the network. Ordinary local proof recording does not prompt. Before an
earlier-proof compatibility request leaves the machine, the command displays a
plain-language full-diff disclosure and requires explicit confirmation.

Both operations use the typed v1 CLI envelope. The response contract is:

`ticket execution-prerequisite` returns `data.prerequisite_status` as the closed
set `satisfied` or `not_applicable`; refusal uses `action_required` with the
ordered missing prerequisites. Exit 0 alone never means admission.

| Status and exit | Outcomes |
| --- | --- |
| `healthy`, 0 | The execution prerequisite is satisfied or not applicable; no authority is granted. |
| `changed`, 0 | A retained proof passed and was recorded, or an accepted compatibility review reused an earlier receipt. |
| `action_required`, 2 | Every readiness state; missing or invalid plans and approvals; dirty proof subjects; failed or offline proof commands; missing categories or slicing; invalid owner, proof, or evidence claims; stable-definition or write conflicts; and stale compatibility review. |
| `failed`, 1 | Invalid arguments, unreadable ledgers, and unsafe writes. |

Every repairable failure has one stable code and one concrete recovery action;
the [Execution Plan](./execution-plan.md#tasks-and-tests) owns the exhaustive
code-to-recovery test. Delivery readiness never exits 0 because merge
authorization remains separate.

Compatibility outcomes are closed. A pending review says when to retry;
missing authentication gives the coordinator's recovery command; stale review
repeats review for the current request; every denial, exhausted or disabled
route, unusable diff, or sensitive-content refusal reruns the retained proof at
the current revision. The Execution Plan owns the exhaustive code mapping.

One exported closed `DeliveryChecklistRepairCode` union owns every repairable
code. A total `Record<DeliveryChecklistRepairCode, RecoveryAction>` owns the
message and action, and every repairable finding emitter accepts only that
union. Adding a code without recovery therefore fails typecheck; the recovery
test iterates that record instead of maintaining a second case list.

#### Reviewed model

Each Proof Specification defines a unique Proof ID, method (`command` or
`review_receipt`), proof scope, exercised boundary, qualifying class, currency
policy, and typed invocation. Command working directories and review targets
must remain inside the project. Command timeout, descendant termination, and
internal-review environment scrubbing are fixed worker policy, not authorable
Proof Specification fields. Admission requires at least one contributor-owned
testing item to use a command reviewed as real-boundary proof, even when another
testing item is reviewed as not applicable.

In M1, `review_receipt` admits only the ticket's current `plan-execution`
review. Compatibility review authorizes reuse of an earlier command receipt; it
is not itself a checklist Proof Specification.

Qualifying class is the closed set `real_boundary` and
`partial_or_structural`. Deterministic admission validates the closed value and
references; plan-execution review judges whether the named method can actually
exercise the claimed boundary.

Each checklist item has stable planning fields—ID, category, obligation, owner
(`contributor` or `human`), and required Proof ID—and mutable progress fields—disposition, evidence class,
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
| `not_applicable` | Contributor or human; requires a concrete reason already admitted by plan-execution review, has an empty Required proof, and makes no evidence claim. |
| `pending_human` | Human-owned; requires a named dependency already admitted by plan-execution review, has an empty Required proof, and makes no contributor-proof claim. |

`open` and `complete` require owner `contributor`; `pending_human` requires
owner `human`; `not_applicable` accepts either owner because review, not the
owner value, admits irrelevance.

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
scope and boundary, producing revision, invocation, outcome, the pre-proof
Execution Plan snapshot digest, and output hashes or source review. The
evaluator derives evidence class and revision from the receipt; editable row
text cannot strengthen either value. A foreign,
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

A crash before receipt append records no progress. A crash after receipt append
but before checklist update leaves that receipt reusable: retry compares the
current Execution Plan with the receipt's pre-proof snapshot digest and updates
the row only on an exact match. Otherwise it returns the conflict recovery
without rerunning the proof.

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

#### Execution prerequisite

`ticket execution-prerequisite` exposes a deny-only verdict through the typed
CLI envelope. It checks a contracted feature in this order:

1. the current scenario-gate review;
2. the current plan-implementation review and any configured design approval;
   and
3. the current plan-execution review that admits the checklist definition.

One response reports every missing prerequisite in that order. Each denial
names the stopped boundary and one recovery action. A satisfied response carries
no coding, approval, or merge grant. Tickets outside the contracted feature flow
return a typed not-applicable result.

An existing feature already in `implement` or `verify` also returns not
applicable until it re-enters Execution Planning. 7CAMAD must preserve that
migration exemption when it composes this evaluator into coding authorization.

A639WN proves these outcomes through the installed CLI. 7CAMAD consumes the
same evaluator after its phase-access check and remains the sole owner of coding
authorization. YCFFNC owns agent-host dispatch.

The existing `ticket approve-plan` transition into `plan-execution` scaffolds
the current Proof Specifications and Delivery Checklist sections from the
canonical template. For an existing unreviewed Execution Plan it inserts only
missing sections while preserving decisions and slices; it refuses a malformed
or partially present section instead of rewriting it.

### Data applicability

Data applicability: the feature changes the persistent Execution Plan and
review-ledger contracts, not application or customer data.

| Concern | Decision |
| --- | --- |
| Purpose | Retain delivery obligations, ownership, disposition, proof identity, and evidence currency. |
| Store and model | `execution-plan.md` owns obligations and contributor-entered progress; the existing review ledger owns authenticated proof, derived Evidence class and Revision, and compatibility events; ignored request files are transient reviewer input. |
| Relationships | Stable checklist items reference retained Proof IDs; receipts bind one ticket, item, proof, and revision. |
| Source of truth | The Execution Plan owns obligations and dispositions. Review records authenticate stable identity; ledger events are authoritative for Evidence class, Revision, proof, and approvals. Their checklist columns are non-authoritative projections. |
| Ownership and access | Contributors update dispositions and evidence references, not evidence strength or authority. Only existing human authority paths can satisfy human dependencies. Checklist state cannot approve or merge. |
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
| Technical Builder | Operates from every obligation and proof state, gets one repair action, and sees that contributor completion grants no approval or merge authority. | Earlier evidence still needs independent semantic judgment. |
| Non-Technical Builder | Gets plain readiness, all open obligations, one next action, an explicit human handoff, and a point-of-use full-diff disclosure with confirmation before external review. | The user can authorize egress but cannot audit code content; structural secret scanning remains imperfect, and K3EBHB owns final wording across installed hosts. |
| Safeword Maintainer | Maintains one closed parser, one generated phase contract, total failure recovery, and a removable rollout boundary. | Strict Markdown is a versioned compatibility surface. |

## Design alignment

| Principle | Consequence | Proof | Conflict |
| --- | --- | --- | --- |
| Structure enforces; instructions suggest | Closed state and authenticated receipts enforce final readiness; recording cadence remains instructional. | [Proof strategy](#proof-strategy) | explicit-conflict |
| Add, never replace | The checklist extends the existing Execution Plan and ledger; it replaces only the unreleased provisional checklist shape. | [Proof strategy](#proof-strategy) | explicit-conflict |
| Discover decisions before prescribing work | Accepted decisions and PR slicing become reviewed obligations before tasks begin. | [Proof strategy](#proof-strategy) |  |
| Fire at boundaries, not every turn | Validation runs at plan review, proof recording, readiness, and the execution prerequisite. | [Proof strategy](#proof-strategy) |  |
| Optimize for the NTB without constraining the TBU | Plain readiness leads; external full-diff review requires point-of-use disclosure and confirmation; detailed proof identity remains available. Applicability changes require re-review. | [Proof strategy](#proof-strategy) | explicit-conflict |
| Contribute, then converge | Every refusal names the observed state and one recovery action. | [Proof strategy](#proof-strategy) |  |
| Correct and safe; then clear; then simple | One typed Markdown source reuses existing Git, review, ledger, and CLI boundaries. | [Proof strategy](#proof-strategy) |  |

Architecture applicability: this shared workflow-contract extension honors
[Separate Implementation and Execution Planning Gates](../../../ARCHITECTURE.md#separate-implementation-and-execution-planning-gates)
and [Typed CLI Execution and Discovery](../../../ARCHITECTURE.md#typed-cli-execution-and-discovery).
It extends [Conformance-Gated Execution Plan Review](../../../ARCHITECTURE.md#conformance-gated-execution-plan-review)
with another retained plan section and
[Digest-Bound Planning Decisions in the Shared Review Ledger](../../../ARCHITECTURE.md#digest-bound-planning-decisions-in-the-shared-review-ledger)
with new event kinds that use the same digest-binding and unknown-event rules.
These extend rather than supersede the accepted decisions, so the current
records remain authoritative after amendment. The Conformance-
Gated record owns the 6XW8H7 review-coordinator contract; this ticket remains
authoritative for checklist contents and runtime use. The Digest-Bound record's
`A639WN extension` owns the new compatibility event and review-kind boundary.

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
- **Sibling activation boundary:** This child proves the installed CLI
  prerequisite, not coding authorization or agent-host dispatch. 7CAMAD and
  YCFFNC retain those downstream boundaries.
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

- Update the public CLI reference with prerequisite and readiness states,
  evidence classes, and the authority boundary. State that explicit earlier-proof reuse sends the
  complete bounded contribution diff—not only Proof Specification paths—to the
  configured external reviewer.
- Update canonical Execution Planning guidance and the template; regenerate
  Claude, Cursor, Codex, and OpenCode mirrors.
- Extend the existing Digest-Bound record with the pre-proof plan-snapshot
  binding, complete delivery-progress normalization, and explicit full-diff
  reviewer egress. Describe the retained checklist in the Conformance-Gated
  record; do not create another architecture record.
- README: skip: the README does not enumerate planning artifact fields.

## Assessment triggers

- The proof recorder reaches an untrusted checkout before authenticated
  host-user provenance exists: stop rollout or add that authority check.
- Evidence-only progress invalidates plan approval: fix stable/mutable
  normalization before activation.
- Applicability changes routinely force re-review: add a separately reviewed
  applicability lane without making contributor prose authoritative.
- A proof target changes while retained invocation stays fixed: require renewed
  semantic review of that proof definition.
- A new default category or human authority source becomes necessary: extend the
  phase contract instead of accepting project-local drift.
- Source control is no longer enough for concurrent checklist edits: reassess
  the single-artifact model before adding another store.

— OpenAI Codex
