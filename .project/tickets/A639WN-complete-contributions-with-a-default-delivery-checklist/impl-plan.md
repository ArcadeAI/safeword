# Implementation Plan: Complete contributions with a default Delivery Checklist

**Status:** planned
**Planned on:** 2026-09-12

## Approach

### Decision summary

Extend the canonical Execution Plan with one versioned, human-readable Delivery
Checklist section. Safeword parses that section into a typed model; it does not
store a hidden JSON mirror or create another artifact. Each item separates:

- stable planning identity: item ID, default category, obligation, owner
  boundary, and required Proof ID, plus the reviewed proof specification that
  binds method, scope, boundary, currency, and invocation; from
- mutable delivery progress: completion or human-dependency disposition,
  evidence class, evidence reference, revision, or named dependency. A
  `not_applicable` disposition and reason, and a human-owned
  `pending_human` disposition and dependency, are review-bound applicability,
  not ordinary progress.

The exact category set is: outcome and scope; resolved decisions; dependency
and pull-request decomposition; testing; data and compatibility; monitoring and
failure signals; security and privacy; rollout and rollback; documentation;
ownership and human dependencies; and completion evidence. Every category has
at least one item. The plan-execution reviewer judges whether the items cover
the accepted scenarios and approach; deterministic validation checks only the
closed fields and cross-field invariants.

Checklist progress does not silently rewrite approved planning. Review currency
binds stable item identity and required proof, while evidence-only progress may
change without reopening the slicing decision. A changed obligation, owner
boundary, category, or required proof invalidates the Execution Plan review.
[5F5ZZA](../5F5ZZA-keep-plan-reviews-current-and-trustworthy/ticket.md) owns that
normalization for the full plan context; this child owns the checklist-specific
stable-definition snapshot. [7CAMAD](../7CAMAD-turn-decisions-into-startable-work/ticket.md)
owns the broader consumer that requires a current approved Execution Plan
before the first RED step; this child owns only the checklist prerequisite that
that consumer composes.

### Riskiest assumption and proof

The riskiest assumption is that an executable receipt can prove the reviewed
boundary rather than merely prove that some exit-zero command ran. The cheapest
discriminating proof reviews one required real-boundary proof spec plus one
narrower supporting spec, then shows the recording command executes only the
retained argv: the required receipt completes the item, the narrower receipt
stays partial, and a caller-supplied substitute cannot run. Round-trip and
mutation tests separately prove the Markdown representation stays readable and
fail-closed.

### Proof strategy

| Behavior | Primary proof and real boundary | Confidence limit |
| --- | --- | --- |
| Checklist exists before execution | Integration: after the ordinary phase gate allows an edit, the CLI-owned pre-tool helper runs in a real process against an `implement` feature with `plan-execution` provenance, returns the checklist-specific denial code while its admitted checklist is absent or stale, and raises no checklist-originated objection after admission; an already-`implement` legacy fixture is exempt, while a legacy ticket returned through `plan-execution` loses the exemption | Proves only the checklist conjunct at the shared execution boundary; YCFFNC owns installed-host dispatch and 7CAMAD owns additional authorization conditions |
| Missing execution prerequisites | Integration: after the ordinary phase gate allows an edit, the same first-execution helper runs against an `implement` feature with `plan-execution` provenance. Repeated invocations return `missing_accepted_scenarios`, `missing_accepted_approach`, or both in stable scenarios-before-approach order before evaluating checklist admission; exact human-output assertions require a plain-language reason, the stopped boundary, and one concrete action for each code | Proves the shared CLI helper; 7CAMAD owns the provenance input and live boundary composition |
| Default categories and typed shape | Unit mutation tests plus real plan-execution admission cases remove each category and require every omission in canonical order; a generated Execution Plan is parsed through the same validator with all eleven categories under both `designApprovalGate` settings | Structure cannot prove that an obligation is semantically applicable |
| Scenario and approach coverage | Semantic plan-execution conformance cases accept obligations derived from the ticket's accepted scenarios and approach and reject a structurally valid checklist containing unrelated generic obligations | Model sampling cannot guarantee every future reviewer version reasons identically |
| Honest dispositions and in-flight updates | Integration: edit and re-read a real Execution Plan; an unreadable-file refusal names `execution-plan.md`, the structural defect, and one repair action without generating a replacement. A contributor item marked `pending_human` returns `invalid_owner_disposition` and projects the retained item as open contributor work; a human item changed from its reviewed dependency to `open` returns `stable_definition_changed`. The genuinely-irrelevant R3 case proves refusal then acceptance after re-review. A partial-progress fixture makes the proof recorder update test evidence, report the next open item immediately, and leave readiness naming monitoring and documentation as the remaining obligations | Does not prove concurrent editors will avoid ordinary source-control conflicts |
| Contributor obligations cannot be escaped | Integration: direct-file mutations of owner, item set, proof spec, or reviewed applicability make both readiness and the first-execution consumer return `stable_definition_changed`; changing live `designApprovalGate` in either direction produces the same refusal until re-review | 5F5ZZA later owns currency for other plan context, not this definition check |
| Feature-only placement | Integration: the real ticket resolver accepts the feature-local Execution Plan and creates no checklist artifact; task and patch fixtures remain untouched | 3EG00H owns the later proportional small-work contract |
| PR-slicing structure | Deterministic integration cases reject an absent, stale, or shape-incompatible plan-execution review record and reject `one_pull_request` without a nonblank rationale; a current multi-slice record closes the decomposition item with every retained slice referenced | Structure cannot judge whether the recorded slicing decision is correct |
| PR-slicing judgment | Semantic plan-execution conformance cases consume 6XW8H7's one-versus-many record and judge whether its rationale matches the plan | Model sampling cannot guarantee every future reviewer version reasons identically |
| Contributor readiness and authority | Integration: the public `ticket delivery-checklist` CLI leaf reports open contributor work, `contributor_work_complete` with both proven and reviewed-not-applicable shapes and no applicable human dependency, `ready_for_human_review`, and `human_approval_satisfied_merge_pending` in fixed human text and the v1 machine envelope. The last state requires a ledger approval whose digest matches the live Implementation Plan; mutations prove editable text cannot produce it and editing the approved plan returns to `ready_for_human_review` | Other kinds of human dependency remain pending; this model never grants merge authority |
| Evidence currency | Integration exercises both retained methods: a command proof runs only its reviewed argv, while a review proof resolves only a target-byte-current admitted receipt and still becomes earlier-revision evidence after any HEAD change. Admission rejects a contributor item's required Proof ID unless its reviewed `Qualifies as` is `real_boundary`. A same-item receipt for a different real-boundary Proof ID remains open as supporting evidence. An earlier receipt plus a compatibility reason accepted by an independent `quality-review` route completes only the exact required `compatible_earlier_allowed` Proof ID as `reusable_earlier_revision`; the acceptance binds ticket, item, receipt, reason digest, and both revisions. Missing, denied, degraded, unrelated, or reason-stale compatibility review leaves it open. A narrower receipt remains partial; a combined earlier-revision and narrower-scope receipt reports both gaps; foreign-ticket, foreign-item, caller-substituted, failed, stale, or stronger-claim evidence cannot complete an item; concurrent appends preserve proof and approval events | Review judges whether a method is capable of exercising its named boundary; the receipt proves which invocation ran at which revision, not that mutable target code still tests that boundary honestly |

Affected host delivery is intentionally deferred: Claude Code, Claude Code
Cloud, OpenAI Codex, OpenCode, Cursor, and Cursor Cloud Agents each use
`skip: YCFFNC owns installed delivery and real-boundary parity in M2`.
OpenCode Desktop remains advisory until native hook dispatch is independently
proven. This M1 child regenerates repository-owned derivatives to keep packaged contracts
in sync. It delivers the shared CLI-owned checklist evaluator and pre-tool
guard library and proves them by direct process invocation; YCFFNC owns proving
that each installed host actually dispatches that shared guard. Safeword CLI is
also covered by the real plan-execution review boundary.

### Build order

1. Apply the two in-place `ARCHITECTURE.md` amendments named under Design
   alignment. Do not author the Execution Plan or application code until both
   records match this approved design.
2. Prove the riskiest boundary with the smallest retained command-spec value
   and a direct recorder test: the worker executes the retained argv and rejects
   a caller substitute. Keep only the reusable worker seam; add no public leaf
   or checklist persistence in this slice.
3. Add the proof-specification and checklist contracts, template sections,
   typed models, parsers, and structural validator. Prove round-trip readability
   and every invalid cross-field combination before adding a consumer.
4. Extend the canonical plan-execution review contract and retained approval
   record with the stable checklist definition. Prove omitted categories and
   unresolved PR slicing are rejected without changing existing review kinds.
5. Add evidence-currency and readiness projection over mutable checklist state.
   Enforce the State and validation contract's review-bound definition and
   evidence derivation. Reuse the no-shell executable-RED attestation worker
   for command proofs and the current admitted review ledger for review proofs;
   record only a passing delivery-proof receipt in the shared ledger.
   Prove contributor work and human dependencies remain distinct, only a
   current digest-bound design approval can satisfy the supported human
   approval, and no checklist transition grants merge authority. This step
   extends the step 2 proof across persistent command and review receipts.
6. Wire the public plan-execution path to require the checklist and retain its
   semantic judgment. Add ordered fixed recovery for missing scenarios and
   accepted approach to the shared prerequisite helper. Invoke the shipped
   guard library in a real process with a synthetic first-edit request and
   prove it composes the helper; expose the provenance input for 7CAMAD, which
   owns installed live-boundary composition. The helper may deny but never
   authorize execution on its own. Regenerate host mirrors and public CLI
   documentation.

## Decisions

### Recorded Decisions

**Decision:** Use one typed, human-readable Delivery Checklist section as the
only checklist source of truth.

**Choice:** Parse a versioned Markdown section in `execution-plan.md` into a
closed internal model and fail without rewriting when it is missing, malformed,
or unreadable.

**Alternative considered:** Prose-only semantic review; or a hidden JSON/YAML
sidecar mirrored into Markdown.

**Rejected because:** Prose alone cannot enforce category or state invariants.
A sidecar creates the third artifact and competing authority the Product Plan
forbids.

**Evidence reference:** [current Execution Plan template](https://github.com/ArcadeAI/safeword/blob/8a87b38f5df4a66a0c33c526d351ae326c730025/packages/cli/templates/doc-templates/execution-plan-template.md) and [existing human-readable readiness parser](https://github.com/ArcadeAI/safeword/blob/8a87b38f5df4a66a0c33c526d351ae326c730025/packages/cli/src/pr-review/readiness.ts)

**Retrieval date:** 2026-09-12

**Applicable version:** Safeword 0.83.1 plus this unreleased #4200 branch; no
new dependency, license, redistribution, or external-service boundary.

**Decision:** Separate stable checklist obligations from mutable progress.

**Choice:** Bind review currency to item identity, category, obligation, owner,
required proof boundary, and any approved `not_applicable` disposition and
reason or human-owned `pending_human` dependency. Store contributor completion
and evidence as mutable fields whose truth is evaluated against the current
revision.

**Alternative considered:** Hash every checklist byte; or exclude the entire
checklist from review currency.

**Rejected because:** Hashing progress would require a fresh semantic review
after every completed task. Excluding the section would let an approved
obligation be removed without invalidating approval.

**Evidence reference:** [conformance-gated Execution Plan review](https://github.com/ArcadeAI/safeword/blob/8a87b38f5df4a66a0c33c526d351ae326c730025/ARCHITECTURE.md#conformance-gated-execution-plan-review) and [revision-bound readiness evaluator](https://github.com/ArcadeAI/safeword/blob/8a87b38f5df4a66a0c33c526d351ae326c730025/packages/cli/src/pr-review/readiness.ts)

**Retrieval date:** 2026-09-12

**Applicable version:** Safeword 0.83.1 plus the accepted #4200 planning-phase
architecture; project-owned evidence has no third-party license or security
boundary.

**Decision:** Derive readiness from checklist state without granting authority.

**Choice:** Derive contributor completion from the retained proof specification
and its attested receipt under the State and validation contract. Keep human
dependencies explicit. Checklist text alone stops at `ready_for_human_review`;
only a matching digest-bound human design approval may produce
`human_approval_satisfied_merge_pending`, and nothing here grants merge
authority.

**Alternative considered:** One ready/not-ready checkbox; treating human
handoff as completion; accepting contributor-authored proof records; or
requiring an independent semantic review for every executed check.

**Rejected because:** The first three alternatives silently upgrade weak or
self-reported evidence, or let contributor work escape behind a human label.
Semantic review is unnecessary for an observable command fact; reusing the
attestation worker provides stronger, cheaper evidence.

**Evidence reference:** [executable attestation worker](https://github.com/ArcadeAI/safeword/blob/8a87b38f5df4a66a0c33c526d351ae326c730025/packages/cli/src/review/red-execution.ts), [digest-bound human approval ledger](https://github.com/ArcadeAI/safeword/blob/8a87b38f5df4a66a0c33c526d351ae326c730025/packages/cli/src/review/approval-ledger.ts), and [interactive approval boundary](https://github.com/ArcadeAI/safeword/blob/8a87b38f5df4a66a0c33c526d351ae326c730025/packages/cli/src/commands/plan-approval.ts)

**Retrieval date:** 2026-09-12

**Applicable version:** Safeword 0.83.1 plus the accepted #4200 authority
boundaries; no external data or executable source is reused.

**Decision:** Bind current proof to repository HEAD until narrower relevance can
be proven safely.

**Choice:** A head change stales `current_revision_real_boundary` evidence. An
item returns to complete only through new current proof or an explicit
compatible-proof assertion that retains the earlier revision and limitation.

**Alternative considered:** Keep all evidence current across commits; or infer
path- or obligation-level relevance automatically.

**Rejected because:** Keeping it current silently upgrades stale proof. This
child has no trustworthy dependency map from an arbitrary commit to every
delivery obligation, so automatic narrowing could report current proof while a
behavioral boundary changed. The assessment trigger controls the expected
churn risk rather than pretending that inference is reliable.

**Evidence reference:** [revision-bound readiness evaluator](https://github.com/ArcadeAI/safeword/blob/8a87b38f5df4a66a0c33c526d351ae326c730025/packages/cli/src/pr-review/readiness.ts)

**Retrieval date:** 2026-09-12

**Applicable version:** Safeword 0.83.1 plus this unreleased checklist model; no
new dependency or external evidence source.

**Decision:** Expose readiness and proof recording as separate public ticket
leaves while reusing the executable-attestation worker and review ledger.

**Choice:** One read-only leaf projects checklist readiness; one mutating leaf
executes a retained Proof ID and records its receipt. Both use the existing
catalogue and machine envelope.

**Alternative considered:** Hide both operations inside post-tool hooks; combine
observation and command execution in one modeful leaf; reuse executable-RED
unchanged; or create a separate proof store.

**Rejected because:** Hooks alone are not a user-reachable CLI boundary; one
modeful leaf cannot declare honest effects; executable-RED requires a semantic
RED review contract this observable fact does not need; another store creates
competing authority. The leaves and unknown ledger events are unreleased and
can be removed before activation without data migration.

**Evidence reference:** [typed CLI catalogue](https://github.com/ArcadeAI/safeword/blob/8a87b38f5df4a66a0c33c526d351ae326c730025/packages/cli/src/cli-protocol/catalog.ts), [executable attestation worker](https://github.com/ArcadeAI/safeword/blob/8a87b38f5df4a66a0c33c526d351ae326c730025/packages/cli/src/review/red-execution.ts), and [shared ledger protocol](https://github.com/ArcadeAI/safeword/blob/8a87b38f5df4a66a0c33c526d351ae326c730025/packages/cli/src/review/approval-ledger.ts)

**Retrieval date:** 2026-09-12

**Applicable version:** Safeword 0.83.1 plus this unreleased command surface; no
new dependency, license, redistribution, or external-service boundary.

**Decision:** Require independent quality review before earlier proof becomes
reusable completion evidence.

**Choice:** The plan-execution reviewer may mark a Proof ID
`compatible_earlier_allowed`, but an independent `quality-review` route must
accept the concrete compatibility reason against the producing and current
revisions. Its acceptance binds the ticket, item, delivery receipt, reason
digest, and revision pair. Same-agent or degraded review cannot complete the
item.

**Alternative considered:** Trust the contributor's reason; re-review the whole
Execution Plan; or create a dedicated compatibility review kind.

**Rejected because:** Contributor self-report is not authority over semantic
compatibility. Whole-plan review adds unrelated churn, while a new review kind
duplicates the existing independent work-product judgment contract.

**Evidence reference:** [independent quality-review coordinator](https://github.com/ArcadeAI/safeword/blob/8a87b38f5df4a66a0c33c526d351ae326c730025/packages/cli/src/review/coordinator.ts) and [review evidence principles](../../../PRINCIPLES.md#1-structure-enforces-instructions-suggest)

**Retrieval date:** 2026-09-12

**Applicable version:** Safeword 0.83.1 plus this unreleased evidence path; no
new dependency, license, redistribution, or external-service boundary.

### State and validation contract

`ticket delivery-checklist` is the read-only user-reachable readiness leaf.
`ticket record-delivery-proof` is the mutating leaf that runs one plan-declared
command or resolves one plan-declared review receipt, appends a passing delivery
receipt, and updates that item's mutable progress fields. It accepts the checklist item ID
and retained Proof ID. Safeword proposes `not_applicable` and `pending_human` as
Execution Plan edits that require review before they affect readiness. No third
public update command exists.
The catalogue marks the readiness leaf local-only and declares that
the proof leaf may inherit network effects from its child argv, so `--offline`
refuses proof recording; stdin is closed and no interactive TTY is inherited.
Neither uses a Safeword confirmation prompt. Both supply deterministic
invocation fixtures and the standard snake_case v1 envelope under `--json
--no-input`. Readiness output leads with one fixed verdict and at most one next
action. The CLI contract check and real-process wiring tests cover both leaves.
`contributor_work_incomplete`, a nonzero proof command, and offline recording
are `action_required`/exit 2; `missing_accepted_scenarios`,
`missing_accepted_approach`, `missing_categories`,
`required_proof_not_real_boundary`, `checklist_write_conflict`,
`compatibility_review_stale`, `missing_slicing_decision`, `invalid_owner_disposition`, and
`evidence_claim_mismatch` are also
`action_required`/exit 2 because the contributor can repair them without a new
semantic review; `stable_definition_changed` is `action_required`/exit 2 with
re-review as its recovery. Every readiness-complete state is `healthy`/exit 0;
a retained proof is `changed`/exit 0; malformed plans, invalid proof specs,
unreadable ledgers, and unsafe writes are `failed`/exit 1.

The Execution Plan contains one `## Proof specifications` table before the
checklist with exact columns
`Proof ID | Method | Scope | Boundary exercised | Qualifies as | Currency | Invocation`.
Method is `command` or `review_receipt`; Scope is `unit`, `integration`, `E2E`,
or `eval`; Qualifies as is `real_boundary` or `partial_or_structural`; Currency
is `current_required` or `compatible_earlier_allowed`.
Invocation is tagged JSON: a command supplies a project-contained `cwd` and a
nonempty `argv` string array; a review receipt supplies a review `kind` and
nonempty project-contained `targets`. Commands execute directly without a
shell. Target-byte currency determines whether a review receipt is admissible;
repository HEAD determines the resulting evidence class for both methods. A
review receipt must come from an admitted reviewer route. Proof IDs are unique. Plan-execution
semantic review judges whether each method can exercise its claimed boundary
and whether earlier proof can remain compatible. The retained typed judgment
binds the full ordered proof-spec set. Checklist `Required proof` cells
reference one of these IDs for contributor-owned items and are empty for
human-owned items. Supporting Proof IDs appear only through a `receipt:<id>`
locator whose retained event names the reviewed Proof ID; the checklist never
stores a bare supporting Proof ID.

The section begins with `## Delivery checklist` and the marker
`<!-- safeword:delivery-checklist:v1 -->`, followed by one Markdown table with
these exact columns:

`ID | Category | Obligation | Owner | Required proof | Disposition | Evidence class | Revision | Evidence, reason, or dependency`

Each physical row is one item and may not contain an unescaped table delimiter.
The first five fields are stable planning identity. The retained reviewed
definition also stores each approved `not_applicable` disposition and concrete
reason and each human-owned `pending_human` disposition and named dependency.
Other values in the final four fields are mutable delivery progress.
The parser returns either the complete ordered item set or one typed
invalid-artifact result naming the first unreadable structural fact. It never
drops a bad row, fills a default, or rewrites the file.

Each item has a unique stable ID and exactly one default category. Its owner is
`contributor` or `human`. Its disposition is `open`, `complete`,
`not_applicable`, or `pending_human`. Evidence class is
`current_revision_real_boundary`, `reusable_earlier_revision`,
`partial_or_structural`, or `missing`.

The table-level validator requires every canonical category from the Decision
summary at least once and returns `missing_categories` with every omission in
canonical order. Plan-execution admission runs this validator before semantic
review; the reviewer separately judges whether the present obligations cover
the accepted scenarios and approach. The retained typed judgment records that
coverage decision alongside the stable checklist definition.
Every contributor item's Required proof must resolve to a spec whose reviewed
`Qualifies as` value is `real_boundary`; otherwise admission returns
`required_proof_not_real_boundary` with the item and Proof ID named.

The dependency-and-PR-decomposition item must reference the current retained
plan-execution review receipt. Its `ExecutionPlanRecord` supplies
`slicing_decision`, nonblank `rationale`, `slices`, `obligation_owners`, and
`decision_statuses` under 6XW8H7's canonical contract. A missing, stale, or
shape-incompatible record returns `missing_slicing_decision` and keeps the item
open. Semantic review judges whether the rationale and the recorded
one-versus-many decision are correct.

- The final column has one disposition-specific grammar: `open` is empty or
  holds `receipt:<id>` for item-bound supporting evidence; `complete` holds
  `receipt:<id>` or `receipt:<id>; compatible:<nonblank reason>`; `not_applicable`
  holds a nonblank reason; and `pending_human` holds a nonblank dependency
  identifier. No other combination is valid.
- `complete` requires `owner: contributor`, a nonempty `Required proof`, and
  `receipt:<id>` resolving to a `delivery-proof:v1` event in
  the existing project review ledger. The public proof-recording command
  accepts a retained Proof ID—not caller-supplied invocation. For `command`, it
  reuses the no-shell executable-attestation worker and appends an event only
  for exit zero. For `review_receipt`, it resolves an existing current admitted
  review over the retained targets and appends no event when that review is
  missing or denied. The delivery event binds its ID, ticket, checklist item
  ID, Proof ID, method, reviewed scope and boundary, repository HEAD, invocation
  digest, source review ID or complete command-output hashes, outcome, and
  timestamp. Receipt resolution requires the event's ticket and item ID to
  match the live row. Only an event whose Proof ID equals the retained Required
  proof may produce `complete`; a different item-bound Proof ID remains `open`
  supporting evidence even when its own `Qualifies as` is `real_boundary`. The
  evaluator derives Revision and Evidence class from
  the event; contributor-authored prose or asserted table values cannot
  override them. A disagreement returns `evidence_claim_mismatch` and leaves
  the row unchanged for repair. After the ledger append, the recorder rereads
  `execution-plan.md` and writes the derived locator, revision, and class by
  atomic replace only when the complete file still matches its pre-proof
  snapshot. Concurrent edits return `checklist_write_conflict` without changing
  the file; the receipt remains available. The idempotency key binds the ticket,
  item, Proof ID, revision, and retained definition, so a retry reuses the
  receipt and completes the row write without executing a command twice.
  Every successful row update returns the next open obligation in the same
  response, carrying the checklist through execution without a per-TDD-step
  reminder hook.
- Reusing an earlier-revision receipt uses
  `receipt:<id>; compatible:<nonblank reason>` in the final column. The
  contributor may propose this mutable assertion only when the retained
  required Proof ID declares `compatible_earlier_allowed`; it satisfies the
  item only after an independent `quality-review` route accepts that reason
  against the producing and current revisions. A same-agent or otherwise
  degraded review cannot satisfy the item. The accepted review record binds the
  ticket, item ID, delivery receipt ID, reason digest, producing revision, and
  current revision; any mismatch or later reason edit returns
  `compatibility_review_stale` and leaves the item open. The class remains
  `reusable_earlier_revision`, the source review ID and earlier producing
  revision stay visible, and a missing or denied review leaves the item open. A
  `current_required` item remains open on any earlier receipt regardless of
  contributor text or review result.
- `not_applicable` requires a concrete reason and makes no proof claim. It is
  admissible only when that disposition and reason were present in the reviewed
  Execution Plan; changing an approved item to `not_applicable` requires a new
  Execution Plan review.
- `pending_human` requires `owner: human`, an empty `Required proof`, and a
  named dependency retained by plan-execution review. A human-owned item may
  otherwise be only reviewed `not_applicable`; `open` and `complete` are
  `invalid_owner_disposition`.
- A contributor-owned item marked `pending_human` returns
  `invalid_owner_disposition`; recovery projects the retained owner and names
  the item as open contributor work without rewriting the row.
- Partial, structural, or missing evidence cannot satisfy an item; an
  earlier-revision receipt satisfies only a retained
  `compatible_earlier_allowed` Proof ID with an explicit reason.
- A head change makes prior `current_revision_real_boundary` evidence stale; it
  may become reusable only through an explicit compatible-proof assertion and
  retains the earlier revision. The evaluator obtains the current revision from
  the CLI's existing Git boundary primitives, never from
  the editable checklist row. It obtains producing revision and exercised
  Proof ID from the ledger receipt. A receipt for the item's Required proof ID
  and current HEAD derives `current_revision_real_boundary` only when the
  retained proof spec's reviewed `Qualifies as` value is `real_boundary`;
  otherwise it remains `partial_or_structural`. A supporting proof also derives
  only its reviewed class. Resubmitting an unchanged locator
  after HEAD changes cannot restore current status. When evidence is both
  earlier-revision and partial or structural, recovery names both the
  stale-revision gap and the narrower-proof gap.

The readiness projection has four successful parse states:
`contributor_work_incomplete` names every open contributor item in plan order
and separately identifies the first next action;
`contributor_work_complete` separately counts proven and reviewed-not-applicable
contributor obligations, states that no contributor work or human dependency
remains, and keeps merge authorization pending;
`ready_for_human_review` names every human-owned dependency after contributor
work is proven; and `human_approval_satisfied_merge_pending` names a human
approval satisfied while stating that merge authorization is still pending.
That third state is supported only for a human design-approval dependency whose
stable definition names the ticket and exact Implementation Plan digest. The
projection hashes the live `impl-plan.md`; the live digest, dependency digest,
and approved ledger event written by the interactive approval boundary must all
match. A changed Implementation Plan returns the dependency to
`ready_for_human_review` even though the superseded event remains in the ledger.
No consumer in this child edits `impl-plan.md` after approval; a deliberate
plan edit requires re-review and a new human approval for the new digest.
Contributor-editable checklist or pull-request-body text cannot create that
decision. Other dependency kinds remain pending. The projection has no input
or transition that grants merge authority.

When `designApprovalGate` is off, generation records the design-approval item
as reviewed `not_applicable` with the configuration reason; it never creates an
unresolvable `pending_human` dependency. The third R6 state is exercised only
when that gate is enabled and its current human decision exists.
Changing `designApprovalGate` after approval makes the retained checklist
definition stale in either direction. Readiness fails with
`stable_definition_changed` until a new Execution Plan review records the
enabled gate as `pending_human` or the disabled gate as `not_applicable`.
The retained stable definition includes the reviewed `designApprovalGate`
value, and every consumer compares it with the live project configuration.

The parser validates a snapshot and never repairs malformed content. File edits
remain normal project-local source edits; no parallel transactional store or
automatic conflict-resolution policy is introduced.

The receipt writer reuses the shared review ledger's exclusive lease, fencing
token, inside-lock reread, unknown-event preservation, and atomic same-directory
replace protocol. Concurrent receipt and approval appends must both survive;
loss of the lock or fence fails without changing checklist state.

The first-execution prerequisite runs after the existing phase-access check for
test or application edits. It is active in `implement` for feature tickets
whose phase provenance includes the new `plan-execution` transition. It returns
`missing_accepted_scenarios` and then `missing_accepted_approach` when those
prerequisites are absent; only after both exist does it evaluate checklist
admission and return the checklist-specific missing-or-stale code. Each denial
uses fixed plain language naming why the edit stopped and one concrete recovery
action. It raises no checklist-originated
objection after admission and cannot authorize an edit the phase gate denied.
Tickets already at `implement` or `verify` when the new phase is activated lack
that provenance and are legacy-exempt. Returning such a ticket through
`plan-execution` ends the exemption. 7CAMAD owns the provenance field and live
first-edit composition; this child defines and directly proves the prerequisite
helper it consumes.

Before approval, authors edit the scaffold as ordinary plan text; the progress
update boundary returns `review_required` while no approved definition exists.
After approval, every public consumer reparses the live checklist and Proof
Specifications table and compares both complete ordered definitions with the
retained reviewed judgment before it evaluates progress. This includes the
readiness leaf, proof recorder, first-execution prerequisite, and update path.
The comparison covers every proof-spec field, all five stable item
fields, and any reviewed `not_applicable` or human-owned `pending_human`
disposition and its reason or dependency. A mismatch
returns `stable_definition_changed` instead of readiness, proof, or
authorization and requires a new Execution Plan review. Direct file writes have
no bypass: mutations that flip an owner, remove or insert an item, or change a
proof method/invocation/boundary/currency must fail through each consumer. A re-review may
retain a newly justified `not_applicable`; later progress updates then accept it
without another review. The final-column grammar is validated against the
active disposition; mutation proofs exercise each meaning rather than checking
only that the cell is nonblank.

### Data applicability

Data applicability: the feature changes the persistent Execution Plan contract
and its evidence lifecycle, but not application or customer data.

- **Purpose:** retain contributor obligations, ownership, dispositions, and
  proof currency in the feature's existing execution artifact.
- **Store and model:** one versioned Markdown section in `execution-plan.md`,
  parsed into checklist categories and items; no cache or second ledger.
- **Schema and relationships:** every default category owns one or more unique
  items; items reference a contribution revision and, when applicable, an
  existing human authority dependency.
- **Source of truth:** the Execution Plan is authoritative for checklist state;
  the plan review record authenticates the stable definition and reviewed
  applicability decisions, not mutable completion progress.
- **Ownership and access:** the contributor or Safeword may update
  contributor-controlled state through normal project-file access. Human-owned
  design-approval items remain unresolved until the existing recorder path has
  placed an exact ticket-and-plan-digest decision in the approval ledger; the
  checklist has no write authority over approval or merge. This child relies on
  the current project-file trust boundary; 5F5ZZA owns authenticated host-user
  provenance.
- **Identity and integrity:** version marker, unique item IDs, closed enums,
  cross-field validation, revision binding, and stable-field review digests
  prevent ambiguous or silently promoted state.
- **Cross-system flow:** no external flow in M1. YCFFNC later installs the same
  contract across hosts. The existing human design-approval ledger supplies a
  read-only exact-digest decision; this feature does not rewrite it.
- **Lifecycle and retention:** scaffold before Execution Plan approval, update
  throughout execution, retain with the ticket, and age evidence when the
  contribution revision changes. Ticket cleanup owns deletion.
- **Migration and backfill:** new-flow feature tickets receive the section when
  their Execution Plan is created. Tickets already at `implement` or `verify`
  when the phase activates are not retroactively blocked; returning to
  `plan-execution` subjects them to the checklist prerequisite.
- **Compliance:** checklist text may name code and proof, but must not contain
  credentials, customer data, or secret-bearing evidence. No new data
  classification is introduced. Proof commands are trusted same-user project
  processes, not an OS security sandbox; no-shell execution limits command
  interpretation but does not isolate a malicious repository.
- **Rollback:** stop requiring and generating the versioned section before
  release. Existing Markdown remains inert project text and grants no approval
  or merge authority.

### Measurement applicability

Measurement applicability: skip: the accepted Product Plan makes no
quantitative outcome promise for this child. Evidence revision and class are
integrity attributes, not a product metric.

## Persona consequences

| Persona | Design consequence | Confidence limit |
| --- | --- | --- |
| Technical Builder | Sees every contributor-controlled obligation, its current evidence strength, and the next open item in one execution artifact | Compatibility of earlier evidence still requires an explicit semantic judgment |
| Non-Technical Builder | Receives readiness language that distinguishes remaining contributor work from a named human dependency and stops before claiming approval or merge authority | K3EBHB owns final plain-language recovery across installed hosts |
| Safeword Maintainer | Maintains one closed parser/model and one generated phase contract rather than a sidecar and synchronization layer | Strict Markdown structure adds a compatibility surface that must be versioned |

## Design alignment

| Principle | Consequence | Proof | Conflict |
| --- | --- | --- | --- |
| Structure enforces; instructions suggest | Closed fields and cross-field rules enforce observable state while semantic review judges whether obligations and evidence are truthful | [Proof strategy](.project/tickets/A639WN-complete-contributions-with-a-default-delivery-checklist/impl-plan.md#proof-strategy) | |
| Add, never replace | The checklist extends `execution-plan.md` and the existing review route; it adds no artifact or authority ledger | [Proof strategy](.project/tickets/A639WN-complete-contributions-with-a-default-delivery-checklist/impl-plan.md#proof-strategy) | explicit-conflict |
| Discover decisions before prescribing work | Resolved decisions and the accepted one-versus-many PR-slicing decision become stable checklist obligations rather than being reopened or replaced by execution tasks | [Proof strategy](.project/tickets/A639WN-complete-contributions-with-a-default-delivery-checklist/impl-plan.md#proof-strategy) | |
| Fire at boundaries, not every turn | Validation runs when the plan is reviewed, checklist state is updated, readiness is reported, or the first execution edit is attempted | [Proof strategy](.project/tickets/A639WN-complete-contributions-with-a-default-delivery-checklist/impl-plan.md#proof-strategy) | |
| Optimize for the NTB without constraining the TBU | Fixed readiness states lead with the next owning boundary while retaining evidence class and revision detail | [Proof strategy](.project/tickets/A639WN-complete-contributions-with-a-default-delivery-checklist/impl-plan.md#proof-strategy) | explicit-conflict |
| Contribute, then converge | Each refusal leads with the observed state and one concrete repair; an applicability change is proposed in the Execution Plan before review rather than asked as an abstract question | [Proof strategy](.project/tickets/A639WN-complete-contributions-with-a-default-delivery-checklist/impl-plan.md#proof-strategy) | |
| Correct and safe; then clear; then simple | One typed Markdown source reuses existing artifact, review, and revision patterns with no new dependency | [Proof strategy](.project/tickets/A639WN-complete-contributions-with-a-default-delivery-checklist/impl-plan.md#proof-strategy) | |

Architecture applicability: this is a shared workflow-contract extension. It
honors [Separate Implementation and Execution Planning Gates](../../../ARCHITECTURE.md#separate-implementation-and-execution-planning-gates),
which governs the phase and artifact separation, and
[Typed CLI Execution and Discovery](../../../ARCHITECTURE.md#typed-cli-execution-and-discovery),
which requires machine-readable outcomes without treating them as semantic
authority. Product Rule R4 and the current Execution Plan template place the
checklist in that artifact. This child amends **Conformance-Gated Execution Plan
Review** in place so its retained typed judgment stores the stable checklist
definition. It also amends **Digest-Bound Planning Decisions in the Shared
Review Ledger** in place to name `delivery-proof:v1` as derived evidence that
grants neither human approval nor merge authority. The Known deviations section
records why this host cannot apply those two exact edits before approval.
5F5ZZA later governs semantic invalidation and authenticated user provenance.
No new architecture record is needed.

## Known deviations

The current session's installed Codex planning hook blocks an `apply_patch`
targeting `ARCHITECTURE.md` even though the working-tree hook's configured-path
check permits that exact target; a direct source-adapter reproduction passes.
The active installed hook and current source therefore disagree at this
boundary.
Immediately after Implementation Plan approval advances this ticket to
`plan-execution`, apply the two in-place amendments named above before writing
the Execution Plan or application code. That phase change disables the
installed hook's `plan-implementation`-only freeze, so the same `apply_patch`
becomes executable without replacing the hook. This temporary ordering does not grant
execution authority: approval covers this design only, and planning cannot
continue until the architecture text matches it.

The current Execution Plan template has an unversioned seven-line Delivery
Checklist. This feature replaces that provisional section with the accepted
complete category set and typed state. The deviation is intentional because the
existing lines cannot express evidence currency, ownership, or partial progress;
the workflow is unreleased and YCFFNC owns coordinated activation.
This is the recorded **Add, never replace** conflict: replacement is narrower
and safer than preserving two checklist contracts.

The instruction not to place credentials, customer data, or secret-bearing
evidence in the checklist remains an authoring and review-packet trust-boundary
rule, not a new content scanner. Adding a probabilistic secret classifier here
would exceed this child's accepted scope and could falsely certify arbitrary
prose; existing repository secret controls remain authoritative.

The `human_approval_satisfied_merge_pending` state currently recognizes only
the existing digest-bound human Implementation Plan approval. Other human
dependencies stay pending even if their owner records a decision elsewhere,
because this child has no equally authoritative generic approval source.
Safeword therefore understates those approvals rather than trusting checklist
or pull-request-body text; it never overstates merge authority.

An obligation discovered to be genuinely irrelevant after approval cannot be
marked `not_applicable` as ordinary progress. The contributor must add the
concrete reason and re-review the Execution Plan, because otherwise an
unreviewed reason could dismiss accepted work. This deliberately adds review
friction to R3's update path in exchange for keeping contributor self-report
from becoming authority. R3's “When Safeword updates the Delivery Checklist”
names that complete workflow operation: the accepted `not_applicable` result is
observed after the required re-review, not after the initially refused edit.
This is the recorded **Optimize for the NTB without constraining the TBU**
conflict: the TBU pays targeted review friction so the NTB never sees an
unreviewed obligation dismissal presented as complete.

## Doc impact

- Update the public CLI reference and workflow documentation to explain the
  checklist states, evidence classes, and authority boundary.
- Update the canonical Execution Planning author guidance and template; generated
  Claude, Cursor, Codex, and OpenCode mirrors follow the normal generators.
- README: skip: the planning workflow is documented in the docs site and
  installed skill; the README does not enumerate phase artifact fields.

## Assessment triggers

- People or agents repeatedly produce malformed but visually plausible
  checklist sections: replace the line parser only if a more robust
  human-readable representation avoids a second source of truth.
- Evidence-only edits invalidate current Execution Plan approvals: correct the
  stable/mutable normalization before enabling the coding gate.
- Genuinely irrelevant or newly discovered obligations repeatedly force
  Execution Plan re-review: add a separately reviewed applicability/addition
  lane only if the current fail-closed path becomes routine friction.
- Teams frequently change `designApprovalGate` during execution and the required
  re-review becomes routine friction: separate configuration applicability from
  unrelated checklist identity without weakening the human dependency.
- Routine head changes repeatedly stale unrelated proof or encourage blanket
  compatibility assertions: narrow currency to demonstrably affected
  obligations before enabling readiness claims.
- An earlier-revision proof is accepted without an explicit compatibility
  reason, or a partial proof closes a real-boundary item: strengthen the
  evaluator before admitting the affected workflow.
- A repository needs a default category absent from the canonical set: add it
  through the phase contract rather than project-local parser drift.
- Checklist updates require cross-process atomicity beyond normal source
  control: reassess the single-artifact model before adding a ledger.
