# Implementation Plan: Complete contributions with a default Delivery Checklist

**Status:** planned
**Planned on:** 2026-09-12

## Approach

### Decision summary

Extend the canonical Execution Plan with one versioned, human-readable Delivery
Checklist section. Safeword parses that section into a typed model; it does not
store a hidden JSON mirror or create another artifact. Each item separates:

- stable planning identity: item ID, default category, obligation, owner
  boundary, and required Proof ID when applicable, plus the reviewed proof
  specification that binds method, scope, boundary, currency, and invocation;
  from
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
boundary rather than merely prove that some exit-zero command ran. The worker
proves that only retained argv can run; after the item model exists, pure
evidence derivation proves the required real-boundary result can complete while
a narrower result stays partial. These checks retire caller substitution and
evidence-class promotion, but cannot prove that a contributor has not weakened
the target test body under unchanged argv. Round-trip and mutation tests
separately prove the Markdown representation stays readable and fail-closed.

### Proof strategy

| Behavior                                  | Primary proof and real boundary                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Confidence limit                                                                                                                                                                                                               |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Checklist prerequisite helper             | Integration: after the ordinary phase gate allows an edit, the CLI-owned pre-tool helper runs in a real process against an `implement` feature with `plan-execution` provenance, returns `checklist_review_required` when the checklist or admitted review is absent and `stable_definition_changed` when an admitted definition drifts, then raises no checklist-originated objection after admission; an already-`implement` legacy fixture is exempt, while a legacy ticket returned through `plan-execution` loses the exemption                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Does not prove live first-edit composition or installed-host dispatch; 7CAMAD and YCFFNC own those conjuncts                                                                                                                   |
| Missing execution prerequisites           | Integration: after the ordinary phase gate allows an edit, the same first-execution helper runs against an `implement` feature with `plan-execution` provenance. Repeated invocations return `missing_accepted_scenarios`, `missing_accepted_approach`, or both in stable scenarios-before-approach order before evaluating checklist admission; exact human-output assertions require a plain-language reason, the stopped boundary, and one concrete action for each code                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Proves the shared CLI helper and its provenance parameter; 7CAMAD owns producing and persisting the provenance field and composing the live boundary                                                                           |
| Default categories and typed shape        | Unit mutation tests plus real plan-execution admission cases remove each category and require every omission in canonical order; a generated Execution Plan is parsed through the same validator with all eleven categories under both `designApprovalGate` settings                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Structure cannot prove that an obligation is semantically applicable                                                                                                                                                           |
| Scenario and approach coverage            | Semantic plan-execution conformance cases accept obligations derived from the ticket's accepted scenarios and approach and reject a structurally valid checklist containing unrelated generic obligations                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Model sampling cannot guarantee every future reviewer version reasons identically                                                                                                                                              |
| Honest dispositions and in-flight updates | Integration: edit and re-read a real Execution Plan; an unreadable-file refusal names `execution-plan.md`, the structural defect, and one repair action without generating a replacement. A contributor item marked `pending_human` returns `invalid_owner_disposition` and projects the retained item as open contributor work; a human item changed from its reviewed dependency to `open` returns `stable_definition_changed`. The genuinely-irrelevant R3 case proves refusal then acceptance after re-review. A partial-progress fixture makes the proof recorder update test evidence, report the next open item immediately, and leave readiness naming monitoring and documentation as the remaining obligations                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Does not prove concurrent editors will avoid ordinary source-control conflicts                                                                                                                                                 |
| Contributor obligations cannot be escaped | Integration: mutate each retained item field separately—ID, Category, Obligation, Owner, and Required proof—plus item insertion/removal, every proof-specification field, reviewed applicability, and live `designApprovalGate`; both readiness and the first-execution consumer return `stable_definition_changed` until re-review                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | The shared ledger has concurrency integrity, not authenticated authorship; 5F5ZZA owns authenticated host-user provenance                                                                                                      |
| Feature-only placement                    | Integration: the real ticket resolver accepts the feature-local Execution Plan and creates no checklist artifact; task and patch fixtures remain untouched                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | 3EG00H owns the later proportional small-work contract                                                                                                                                                                         |
| PR-slicing structure                      | Deterministic integration cases reject an absent, stale, or shape-incompatible plan-execution review record and reject `one_pull_request` without a nonblank rationale; a current multi-slice record closes the decomposition item with every retained slice referenced                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Structure cannot judge whether the recorded slicing decision is correct                                                                                                                                                        |
| PR-slicing judgment                       | Semantic plan-execution conformance cases consume 6XW8H7's one-versus-many record and judge whether its rationale matches the plan                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Model sampling cannot guarantee every future reviewer version reasons identically                                                                                                                                              |
| Contributor readiness and authority       | Integration: the public `ticket delivery-checklist` CLI leaf reports each readiness value in `data.readiness_state`, including proven and reviewed-not-applicable contributor work, pending human work, and a satisfied design approval. A gate-enabled fixture keeps `ready_for_human_review` when another human dependency remains. Editing the approved Implementation Plan returns to human review, and Execution Plan re-review refreshes the dependency digest before a new matching approval can satisfy it                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Generic human dependencies remain pending until an authoritative source exists                                                                                                                                                 |
| Evidence currency                         | Integration exercises both retained methods from a clean proof subject: a command proof runs only its reviewed argv, while a plan review proof resolves only under the normalized plan identity decision. Recording refuses pre- or post-proof changes outside this ticket's Execution Plan and the shared review ledger. Two sequential proof recordings remain current. A later commit preserves command evidence only when the producing HEAD remains an ancestor and Git reports no change outside those paths; plan-review evidence remains current while its normalized identity and delivery definition match. Admission rejects a contributor item's required Proof ID unless its reviewed `Qualifies as` is `real_boundary`. A same-item receipt for a different real-boundary Proof ID remains open as supporting evidence. An earlier command receipt plus a compatibility reason accepted by an independent `quality-review` route completes only the exact required `compatible_earlier_allowed` Proof ID as `reusable_earlier_revision`; the acceptance binds ticket, item, receipt, reason digest, and both subject revisions. Missing, denied, degraded, unrelated, reason-stale, dirty-subject, or source-changed evidence leaves it open. A narrower receipt remains partial; a combined earlier-revision and narrower-scope receipt reports both gaps; foreign-ticket, foreign-item, caller-substituted, failed, stale, or stronger-claim evidence cannot complete an item; concurrent appends preserve proof and approval events | Review judges whether a method is capable of exercising its named boundary; the receipt proves which invocation ran against which clean contribution snapshot, not that mutable target code still tests that boundary honestly |
| Template and host-mirror parity           | Schema, parity, rubric-generation, catalogue, and machine-contract tests prove the canonical template, Execution Planning guidance, command discovery and effects, and generated host mirrors change together                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Proves repository-owned generated artifacts; YCFFNC owns installed-host activation and dispatch                                                                                                                                |

Affected host delivery uses the exact skip dispositions in the accepted Product
Plan: YCFFNC owns installed delivery and real-boundary parity in M2, with
OpenCode Desktop advisory until native hook dispatch is independently proven.
This M1 child regenerates repository-owned derivatives to keep packaged
contracts in sync. It delivers the shared CLI-owned checklist evaluator and
pre-tool guard library and proves them by direct process invocation; YCFFNC
owns proving that each installed host actually dispatches that shared guard.
Safeword CLI is also covered by the real plan-execution review boundary.

### Build order

1. Prove the riskiest boundary with the smallest retained command-spec value:
   the worker executes the retained argv and rejects a caller substitute. Add
   no public leaf or checklist persistence.
2. Add the proof-specification and checklist contracts, template sections,
   typed models, parsers, and structural validator. Prove round-trip readability
   and every invalid cross-field combination, then prove pure evidence
   derivation completes the required real-boundary result while keeping a
   narrower result partial before adding a consumer.
3. Extend the canonical plan-execution review contract and retained approval
   record with the stable checklist definition. Prove omitted categories and
   unresolved PR slicing are rejected without changing existing review kinds.
4. Add evidence-currency and readiness projection over mutable checklist state.
   Enforce the State and validation contract's review-bound definition and
   evidence derivation. Reuse the no-shell executable-RED attestation worker
   for command proofs and the current admitted review ledger for review proofs;
   record only a passing delivery-proof receipt in the shared ledger.
   Prove contributor work and human dependencies remain distinct, only a
   current digest-bound design approval can satisfy the supported human
   approval, and no checklist transition grants merge authority. This step
   extends the first proof across persistent command and review receipts and
   ships the public CLI reference beside the commands, readiness states, and
   evidence classes it describes.
5. Add ordered fixed recovery for missing scenarios and accepted approach to
   the shared prerequisite helper. Invoke the shipped
   guard library in a real process with a synthetic first-edit request and
   prove it composes the helper. This child defines only the helper's provenance
   parameter; 7CAMAD produces and persists that field and owns live-boundary
   composition. The helper can ship independently, but cannot be activated on
   real tickets until 7CAMAD supplies the field. It may deny but never authorize
   execution on its own. The public plan-execution admission path, templates,
   and generated host mirrors ship with steps 2-3;
   this final step adds only the private execution prerequisite.

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
required proof boundary when applicable, and any approved `not_applicable`
disposition and reason or human-owned `pending_human` dependency. Store
contributor completion and evidence as mutable fields whose truth is evaluated
against the current revision.

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

**Decision:** Bind current proof to a clean contribution revision while allowing
the plan-and-ledger-only commit that persists its receipt.

**Choice:** Before and after proof, the working tree must have no tracked,
staged, or non-ignored untracked changes outside this ticket's
`execution-plan.md` and the shared `.project/skill-invocations.log` review
ledger.
The receipt retains the producing HEAD. It remains
`current_revision_real_boundary` only while that commit is an ancestor of the
current HEAD and Git reports no committed or working-tree difference outside
those two exact paths. The Execution Plan is checked by its normalized identity
and stable delivery definition; the ledger is reparsed and the exact referenced
event must remain valid. Git-ignored files are outside the proof subject. A
source change makes the receipt earlier-revision evidence; committing only the
ledger append and progress cells does not create an impossible self-reference.

**Alternative considered:** Bind to exact HEAD; keep evidence current across all
commits; store progress outside the Execution Plan; or hash a second bespoke
working-tree manifest.

**Rejected because:** Exact HEAD makes the commit that persists evidence stale.
Blanket currency silently upgrades changed code. Moving progress breaks the
single-artifact contract. A second manifest duplicates Git's tree comparison
and must invent semantics for ignored files and attributes. Clean-subject proof
plus one excluded, independently authenticated plan is narrower and testable.

**Evidence reference:** [Git diff path comparison](https://git-scm.com/docs/git-diff), [Git content-addressed object model](https://git-scm.com/docs/gitdatamodel), and [revision-bound readiness evaluator](https://github.com/ArcadeAI/safeword/blob/8a87b38f5df4a66a0c33c526d351ae326c730025/packages/cli/src/pr-review/readiness.ts)

**Retrieval date:** 2026-09-12

**Applicable version:** Safeword 0.83.1 plus this unreleased checklist model; no
new dependency or external evidence source.

**Decision:** Expose readiness and proof recording as separate public ticket
leaves while reusing the executable-attestation worker and review ledger.

**Choice:** One read-only leaf projects checklist readiness; one mutating leaf
executes a retained Proof ID and records its receipt. Both use the existing
catalogue and machine envelope. Until 5F5ZZA supplies authenticated host-user
provenance, the mutating leaf inherits the existing same-user project-file
trust boundary and must not be treated as safe authorization from an untrusted
checkout merely because that checkout contains its own review ledger.

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
item. `record-delivery-proof` owns that review workflow: it writes a
deterministic Markdown request under
`.safeword/state/reviews/requests/delivery-compatibility-<request-digest>.md`,
containing those exact bindings, the retained proof definition, and the bounded
Git diff from the producing revision to the reviewed revision. The existing
`quality-review` route reviews that file. A retry finds the matching
integrity-protected job from the request bytes; callers never supply a review
ID. An accepted cross-agent result is retained in the shared ledger as
`delivery-compatibility:v1` before the checklist row changes. The request is
transient review input; the ledger event is the durable authority.

**Alternative considered:** Trust the contributor's reason; re-review the whole
Execution Plan; or create a dedicated compatibility review kind.

**Rejected because:** Contributor self-report is not authority over semantic
compatibility. Whole-plan review adds unrelated churn, a caller-supplied review
ID moves identity matching onto the user, and a new review kind duplicates the
existing independent work-product judgment contract.

**Evidence reference:** [independent quality-review coordinator](https://github.com/ArcadeAI/safeword/blob/8a87b38f5df4a66a0c33c526d351ae326c730025/packages/cli/src/review/coordinator.ts) and [review evidence principles](../../../PRINCIPLES.md#1-structure-enforces-instructions-suggest)

**Retrieval date:** 2026-09-12

**Applicable version:** Safeword 0.83.1 plus this unreleased evidence path; no
new dependency, license, redistribution, or external-service boundary.

### Recorded Decision: Keep plan review identity stable across evidence progress

**Decision:** Hash the reviewed Execution Plan after normalizing only mutable
Delivery Checklist progress fields.

**Choice:** The plan-execution packet computes and retains a normalized plan
digest that preserves every plan byte except ordinary contributor progress in
`Disposition`, `Evidence class`, `Revision`, and `Evidence, reason, or
dependency`. Reviewed `not_applicable` reasons and human `pending_human`
dependencies remain part of the stable definition. A plan review proof is
admissible only when its retained normalized digest and exact delivery
definition match the live plan. Recording one item's progress therefore does
not invalidate the same review for another item, while changing a task, slice,
proof specification, obligation, owner, reviewed applicability decision, or
configuration still requires re-review. `**Status:** planned` is stable plan
content and remains `planned` during execution; changing it also requires
re-review.

**Alternative considered:** Require one atomic operation to complete every
review-backed item; or move the immutable review definition into a third
artifact.

**Rejected because:** Multi-item completion makes one public command special
and couples independent obligations. A third artifact violates the accepted
single-Execution-Plan source of truth and creates a synchronization boundary.

**Evidence reference:** [Conformance-Gated Execution Plan Review](../../../ARCHITECTURE.md#conformance-gated-execution-plan-review);
the proposed packet extension retains the exact typed delivery definition in
`packages/cli/src/review/packet.ts` and validates the reviewer echo in
`packages/cli/src/review/execution-plan-output.ts`.

**Retrieval date:** 2026-09-12

**Applicable version:** Safeword 0.83.1 plus this unreleased review identity;
no new dependency, license, redistribution, or external-service boundary.

### State and validation contract

`ticket delivery-checklist` is the read-only user-reachable readiness leaf.
`ticket record-delivery-proof` is the mutating leaf that runs one plan-declared
command or resolves one plan-declared review receipt, appends a passing delivery
receipt, and updates that item's mutable progress fields. It accepts the checklist item ID
and retained Proof ID. To reuse an earlier receipt, it also accepts the paired
`--receipt <id>` and `--compatible-reason <reason>` options. Safeword proposes `not_applicable` and `pending_human` as
Execution Plan edits that require review before they affect readiness. No third
public update command exists.
The catalogue marks the readiness leaf local-only and declares that
the proof leaf may inherit network effects from its child argv, so `--offline`
refuses proof recording; stdin is closed and no interactive TTY is inherited.
Neither uses a Safeword confirmation prompt. Both supply deterministic
invocation fixtures and the standard snake_case v1 envelope under `--json
--no-input`. Readiness output leads with one fixed verdict and at most one next
action. The CLI contract check and real-process wiring tests cover both leaves.
`contributor_work_incomplete`, `review_required`, `missing_execution_plan`, a
dirty proof subject, a nonzero proof command, and offline recording are
`action_required`/exit 2;
`missing_accepted_scenarios`,
`missing_accepted_approach`, `checklist_review_required`, `missing_categories`,
`required_proof_not_real_boundary`, `checklist_write_conflict`,
`compatibility_review_stale`, `missing_slicing_decision`, `invalid_owner_disposition`, and
`evidence_claim_mismatch` and `invalid_execution_plan` are also
`action_required`/exit 2 because they are expected repairable workflow states;
`stable_definition_changed` is `action_required`/exit 2 with
re-review as its recovery. `ready_for_human_review` and
`human_approval_satisfied_merge_pending`, and `contributor_work_complete` are
`action_required`/exit 2 because merge authorization remains a separate human
boundary even when the checklist itself has no remaining dependency. A retained
proof is `changed`/exit 0; unreadable ledgers and unsafe writes are
`failed`/exit 1. Invalid command arguments are `failed`/exit 1 before work
begins.
Real-process CLI tests assert both the envelope status and process exit for all
four readiness states.

The Execution Plan contains one `## Proof specifications` table before the
versioned Delivery Checklist. Its exact columns are
`Proof ID | Method | Scope | Boundary exercised | Qualifies as | Currency | Invocation`.
Method is `command` or `review_receipt`; Scope is `unit`, `integration`, `E2E`,
or `eval`; Qualifies as is `real_boundary` or `partial_or_structural`; Currency
is `current_required` or `compatible_earlier_allowed`.
Invocation is tagged JSON: a command supplies a project-contained `cwd` and a
nonempty `argv` string array; a review receipt supplies a review `kind` and
nonempty project-contained `targets`. Commands execute directly without a
shell. A review receipt must come from an admitted reviewer route. A
`plan-execution` receipt uses the normalized plan identity defined in the
Recorded Decision above; its live normalized digest and exact retained delivery
definition must match before the receipt is admissible. Its currency follows
that logical plan identity, not repository HEAD. Command receipt currency uses
the clean contribution revision. Other review receipts use their reviewed
target identity. Proof IDs are unique. Plan-execution
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
Every contributor item except reviewed `not_applicable` must name a Required
proof that resolves to a spec whose reviewed `Qualifies as` value is
`real_boundary`; otherwise admission returns
`required_proof_not_real_boundary` with the item and Proof ID named. A reviewed
`not_applicable` item leaves Required proof empty because it makes no proof
claim.

The dependency-and-PR-decomposition item must reference a retained
plan-execution review receipt whose normalized plan digest and delivery
definition still match. Its `ExecutionPlanRecord` supplies
`slicing_decision`, nonblank `rationale`, `slices`, `obligation_owners`, and
`decision_statuses` under 6XW8H7's canonical contract. A missing, stale, or
shape-incompatible record returns `missing_slicing_decision` and keeps the item
open. Mutable progress written after review does not change the normalized
digest. Semantic review judges whether the rationale and the recorded
one-versus-many decision are correct; repository revision currency remains
subject to the Proof ID's declared policy.

- The final column has one disposition-specific grammar: `open` is empty or
  holds `receipt:<id>` for item-bound supporting evidence; `complete` holds
  `receipt:<id>` or `receipt:<id>; compatible:<nonblank reason>`; `not_applicable`
  holds a nonblank reason; and `pending_human` holds a nonblank dependency
  identifier. The one recognized design-approval identifier is
  `design-approval:<ticket-id>:<64-lowercase-hex-impl-plan-digest>`; every other
  nonblank identifier remains a generic pending human dependency. No other
  combination is valid.
- `complete` requires `owner: contributor`, a nonempty `Required proof`, and
  `receipt:<id>` resolving to a `delivery-proof:v1` event in
  the existing project review ledger. The public proof-recording command
  accepts a retained Proof ID—not caller-supplied invocation. For `command`, it
  reuses the no-shell executable-attestation worker and appends an event only
  for exit zero. For `review_receipt`, it resolves an admitted review over the
  retained targets, requires the current normalized plan identity for
  `plan-execution`, and appends no event when that review is missing, denied, or
  definition-stale. The delivery event binds its ID, ticket, checklist item
  ID, Proof ID, method, reviewed scope and boundary, repository HEAD, invocation
  digest, source review ID or complete command-output hashes, outcome, and
  timestamp. Receipt resolution requires the event's ticket and item ID to
  match the live row. Only an event whose Proof ID equals the retained Required
  proof may produce `complete`. A different item-bound Proof ID remains
  supporting evidence when the row is `open`, even when its own `Qualifies as`
  is `real_boundary`; asserting `complete` with that receipt returns
  `evidence_claim_mismatch` and leaves the row unchanged. A locator that resolves
  to no ledger event returns the same code. The
  evaluator derives Revision and Evidence class from
  the event; contributor-authored prose or asserted table values cannot
  override them. `evidence_claim_mismatch` is reserved for a locator that is
  absent from the ledger or whose ticket, item, or Proof ID cannot satisfy the
  live row. A naturally staled
  cached Revision or Evidence class is ignored in favor of the derived value
  and keeps the item in `contributor_work_incomplete`. After the ledger append, the recorder rereads
  `execution-plan.md` and writes `complete` plus the derived locator, revision,
  and class by
  atomic replace only when the complete file still matches its pre-proof
  snapshot. Concurrent edits return `checklist_write_conflict` without changing
  the file; the receipt remains available. The idempotency key binds the ticket,
  item, Proof ID, revision, and retained definition, so a retry reuses the
  receipt and completes the row write without executing a command twice.
  Every successful row update returns the next open obligation in the same
  response. At each clean implementation-task boundary that makes a proof
  available, the contributor records that proof and checks readiness before the
  next task. This boundary also applies to a one-pull-request plan and carries
  the checklist through execution without a per-TDD-step reminder hook.
- Reusing an earlier-revision receipt uses
  `receipt:<id>; compatible:<nonblank reason>` in the final column. The
  contributor invokes `record-delivery-proof` with both reuse options; the
  command writes the locator and reason only when the retained required Proof ID
  declares `compatible_earlier_allowed` and an independent `quality-review`
  route accepts that reason
  against the producing and current revisions. A same-agent or otherwise
  degraded review cannot satisfy the item. On the first call, the command
  creates or reuses the deterministic transient request described in the
  recorded decision and starts or reports its matching review job. The request
  includes the exact bounded Git diff; an oversized or unrepresentable diff
  refuses reuse and tells the contributor to run the retained proof again. On a
  retry, the command accepts only an integrity-protected job whose kind, target,
  source fingerprint, reviewer identity, and cross-agent approval match the
  request, then atomically appends a `delivery-compatibility:v1` event to the
  shared ledger. That event binds the ticket, item ID, delivery receipt ID,
  Proof ID, definition digest, reason digest, producing revision, revision
  reviewed for compatibility, request digest, and source review ID. The
  acceptance remains current
  across later commits only when that reviewed revision remains an ancestor and
  Git reports no committed or working-tree change outside this ticket's
  authenticated Execution Plan and the exact shared review ledger. Any other
  revision change, receipt mismatch, or later reason edit returns
  `compatibility_review_stale` and leaves the item open. The class remains
  `reusable_earlier_revision`, the source review ID and earlier producing
  revision stay visible, and a missing or denied review leaves the item open. A
  `current_required` item remains open on any earlier receipt regardless of
  contributor text or review result. Without the reuse options, the command
  executes or resolves the retained proof again to produce current evidence.
  Supplying only one reuse option is an invalid invocation and changes nothing.
- `not_applicable` requires an empty `Required proof` and a concrete reason. It
  is admissible only when that disposition and reason were present in the
  reviewed Execution Plan; changing an approved item to `not_applicable`
  requires a new Execution Plan review. Its Evidence class is `missing` and its
  Revision is empty because it makes no evidence claim.
- `pending_human` requires `owner: human`, an empty `Required proof`, and a
  named dependency retained by plan-execution review. A human-owned item may
  otherwise be only reviewed `not_applicable`; `open` and `complete` are
  `invalid_owner_disposition`. Its Evidence class is `missing` and its Revision
  is empty because a dependency is not contributor proof.
- A contributor-owned item marked `pending_human` returns
  `invalid_owner_disposition`; recovery projects the retained owner and names
  the item as open contributor work without rewriting the row. This is a
  non-readiness outcome: `data.readiness_state` is absent and
  `findings[].code` carries the defect.
- Stable-definition comparison runs before mutable progress validation after
  admission. Therefore a reviewed human-owned `pending_human` row edited to
  `open` or `complete` returns `stable_definition_changed` and requires a new
  Execution Plan review; it never reaches `invalid_owner_disposition`.
  `invalid_owner_disposition` covers a human-owned `open` or `complete` row at
  admission, plus a contributor-owned row changed to `pending_human` after
  admission. The admission-time human case projects the retained human owner
  and named dependency and tells the contributor to restore `pending_human` or
  obtain a reviewed `not_applicable` disposition. The contributor case names
  the item as open contributor work and tells the contributor to restore an
  allowed contributor disposition. Neither case exposes
  `data.readiness_state`.
- Partial, structural, or missing evidence cannot satisfy an item; an
  earlier-revision receipt satisfies only a retained
  `compatible_earlier_allowed` Proof ID with an explicit reason.
- Command evidence remains `current_revision_real_boundary` across commits that change
  only this ticket's authenticated Execution Plan and the shared review ledger.
  Any other committed or working-tree change makes it earlier-revision evidence;
  it may become reusable only through an explicit compatible-proof assertion
  and retains the producing revision. Proof recording refuses a dirty subject
  before execution and refuses to append a receipt if the command dirties
  anything outside those two exact paths. The ledger writer serializes its own
  append through the existing lease and fencing protocol; concurrent typed
  appends survive. Ledger-only mutations are intentionally outside the Git
  proof subject under the current same-user trust boundary. Recording two proofs
  in sequence leaves both current.
  The evaluator obtains the current and producing revisions from the CLI's Git
  boundary primitives and ledger receipt, never from the editable checklist
  row. It requires the producing revision to remain an ancestor and Git to
  report no difference outside the exact plan and ledger paths. A receipt for the item's
  Required proof ID under that clean-subject comparison derives
  `current_revision_real_boundary` only when the retained proof spec's reviewed
  `Qualifies as` value is `real_boundary`;
  otherwise it remains `partial_or_structural`. A supporting proof also derives
  only its reviewed class. Resubmitting an unchanged locator
  after a source change cannot restore current status. When evidence is both
  earlier-revision and partial or structural, recovery names both the
  stale-revision gap and the narrower-proof gap.

The readiness projection has four successful parse states:
The v1 envelope exposes the distinct value in `data.readiness_state`.
`contributor_work_incomplete` names every open contributor item in plan order
and separately identifies the first next action;
`contributor_work_complete` separately counts proven contributor obligations
and every reviewed-not-applicable item by owner, states that no contributor work or human dependency
remains, and keeps merge authorization pending;
`ready_for_human_review` names every human-owned dependency after contributor
work is proven; and `human_approval_satisfied_merge_pending` names a human
approval satisfied while stating that merge authorization is still pending.
`contributor_work_incomplete` outranks every other readiness state. After all
contributor work is proven, an unresolved human dependency keeps the state at
`ready_for_human_review`; `human_approval_satisfied_merge_pending` requires the
design approval satisfied and no other human-owned dependency pending. Once a
retained design-approval dependency has been satisfied, that state outranks
`contributor_work_complete`; the latter is reserved for plans whose reviewed
definition contains no pending human dependency, including the gate-disabled
`not_applicable` path.
That third state is supported only for a human design-approval dependency whose
stable definition names the ticket and exact Implementation Plan digest. The
projection hashes the live `impl-plan.md`; the live digest, dependency digest,
and approved ledger event written by the interactive approval boundary must all
match. A changed Implementation Plan returns the dependency to
`ready_for_human_review` even though the superseded event remains in the ledger.
No consumer in this child edits `impl-plan.md` after approval; a deliberate
plan edit requires re-review and a new human approval for the new digest. The
corresponding Execution Plan re-review replaces the retained human dependency
identifier with that new digest before the new approval can satisfy it; the old
dependency and approval remain historical ledger evidence only.
Contributor-editable checklist or pull-request-body text cannot create that
decision. Other dependency kinds remain pending.

When `designApprovalGate` is off, generation records the design-approval item
as reviewed `not_applicable` with the configuration reason; it never creates an
unresolvable `pending_human` dependency. This default path ends at
`contributor_work_complete` with `action_required`/exit 2 because merge
authorization remains separate. `ready_for_human_review` and
`human_approval_satisfied_merge_pending` are exercised by gate-enabled fixtures;
other human dependency kinds remain visible but cannot manufacture the latter
state.
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
test or application edits. A private process adapter consumes the host's
first-edit JSON on stdin, emits one typed hook decision, and exits 0 for no
checklist objection, 2 for a checklist denial, or 1 for malformed input. It is
not a public catalogue leaf. It is active in `implement` for feature tickets
whose phase provenance includes the new `plan-execution` transition. It reports
`missing_accepted_scenarios` when 7CAMAD's provenance lacks a current,
achieved-assurance `scenario-gate` approval bound to the ticket and feature
source, and reports `missing_accepted_approach` when that provenance lacks a
current, achieved-assurance `plan-implementation` approval bound to
the ticket, Implementation Plan, and accepted scenarios. A present artifact or
unapproved receipt is not acceptance. When both are missing, one response
returns both findings in scenarios-before-approach order. Only after neither
finding remains does it evaluate checklist admission. It returns
`checklist_review_required` when the versioned checklist or an admitted review
is absent, and `stable_definition_changed` when a previously admitted stable
definition no longer matches. Each denial
uses fixed plain language naming why the edit stopped and one concrete recovery
action. It raises no checklist-originated
objection after admission and cannot authorize an edit the phase gate denied.
Tickets already at `implement` or `verify` when the new phase is activated lack
that provenance and are legacy-exempt. Returning such a ticket through
`plan-execution` ends the exemption. 7CAMAD owns the provenance field and live
first-edit composition; this child defines and directly proves the prerequisite
helper it consumes.

Before approval, authors edit the scaffold as ordinary plan text. The public
readiness and proof-recording leaves return `missing_execution_plan` when the
file is absent, `invalid_execution_plan` when a present file lacks or malforms
either required section, and `review_required` when a structurally valid
definition has no current admitted review. Only the private first-execution
helper emits `checklist_review_required`, for an absent section or admitted
review. These consumer-specific codes make the recovery table exhaustive.
After approval, every public consumer reparses the live checklist and Proof
Specifications table and compares both complete ordered definitions with the
retained reviewed judgment before it evaluates progress. This includes the
readiness leaf, proof recorder, first-execution prerequisite, and update path.
The comparison covers every proof-specification field; item ID, Category,
Obligation, Owner, and Required proof; item insertion and removal; and any
reviewed `not_applicable` or human-owned `pending_human`
disposition and its reason or dependency. A mismatch
returns `stable_definition_changed` instead of readiness, proof, or
authorization and requires a new Execution Plan review. Direct file writes have
no bypass: mutations of each enumerated retained field must fail through each
consumer. A re-review may
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
  parsed into checklist categories and items; `delivery-proof:v1` and
  `delivery-compatibility:v1` events share the existing review ledger. A
  deterministic ignored request file is transient reviewer input, not a second
  authority or durable checklist store.
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
- **Identity and integrity:** checklist version marker, unique item IDs, closed enums,
  cross-field validation, revision binding, stable-field review digests,
  integrity-protected review jobs, and exact compatibility-event bindings
  prevent ambiguous or silently promoted state.
- **Cross-system flow:** no external flow in M1. YCFFNC later installs the same
  contract across hosts. The existing human design-approval ledger supplies a
  read-only exact-digest decision; this feature does not rewrite it.
- **Lifecycle and retention:** scaffold before Execution Plan approval, update
  throughout execution, retain with the ticket, and age evidence when the
  contribution revision changes. Ticket cleanup owns deletion.
- **Migration and backfill:** new-flow feature tickets receive the section when
  their Execution Plan is created. On the next `plan-execution` entry, authoring
  guidance inserts the current proof and checklist sections into an existing
  unreviewed plan that lacks them while preserving its decisions and slices.
  At the first-execution helper, a wholly absent section returns
  `checklist_review_required`; at either public leaf it returns
  `invalid_execution_plan`. A present but malformed section fails without
  automatic repair. Tickets already at `implement` or `verify`
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

| Persona               | Design consequence                                                                                                                                            | Confidence limit                                                               |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Technical Builder     | Sees every contributor-controlled obligation, its current evidence strength, and the next open item in one execution artifact                                 | Compatibility of earlier evidence still requires an explicit semantic judgment |
| Non-Technical Builder | Receives readiness language that distinguishes remaining contributor work from a named human dependency and stops before claiming approval or merge authority | K3EBHB owns final plain-language recovery across installed hosts               |
| Safeword Maintainer   | Maintains one closed parser/model and one generated phase contract rather than a sidecar and synchronization layer                                            | Strict Markdown structure adds a compatibility surface that must be versioned  |

## Design alignment

| Principle                                         | Consequence                                                                                                                                                                           | Proof                                                                                          | Conflict          |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ----------------- |
| Structure enforces; instructions suggest          | Closed fields and cross-field rules enforce observable state while semantic review judges whether obligations and evidence are truthful                                               | Known deviations — Instruction-backed recording cadence                                      | explicit-conflict |
| Add, never replace                                | The checklist extends `execution-plan.md` and the existing review route; it adds no artifact or authority ledger                                                                      | Proof strategy — Feature-only placement                                                        | explicit-conflict |
| Discover decisions before prescribing work        | Resolved decisions and the accepted one-versus-many PR-slicing decision become stable checklist obligations rather than being reopened or replaced by execution tasks                 | Proof strategy — Scenario and approach coverage; PR-slicing structure and judgment             |                   |
| Fire at boundaries, not every turn                | Validation runs when the plan is reviewed, checklist state is updated, readiness is reported, or the first execution edit is attempted                                                | Proof strategy — Checklist prerequisite helper; Honest dispositions and in-flight updates      |                   |
| Optimize for the NTB without constraining the TBU | Fixed readiness states lead with the next owning boundary while retaining evidence class and revision detail                                                                          | Proof strategy — Contributor readiness and authority                                           | explicit-conflict |
| Contribute, then converge                         | Each refusal leads with the observed state and one concrete repair; an applicability change is proposed in the Execution Plan before review rather than asked as an abstract question | Proof strategy — Honest dispositions and in-flight updates                                     |                   |
| Correct and safe; then clear; then simple         | One typed Markdown source reuses existing artifact, review, and revision patterns with no new dependency                                                                              | Proof strategy — Evidence currency; Feature-only placement                                     |                   |

Architecture applicability: this is a shared workflow-contract extension. It
honors [Separate Implementation and Execution Planning Gates](../../../ARCHITECTURE.md#separate-implementation-and-execution-planning-gates),
which governs the phase and artifact separation, and
[Typed CLI Execution and Discovery](../../../ARCHITECTURE.md#typed-cli-execution-and-discovery),
which requires machine-readable outcomes without treating them as semantic
authority. Product Rule R4 and the current Execution Plan template place the
checklist in that artifact. This child amends **Conformance-Gated Execution Plan
Review**, whose retained typed judgment stores the stable checklist definition
and normalized plan digest, and **Digest-Bound Planning Decisions in the Shared
Review Ledger**, whose clean-subject rule gains the exact shared-ledger exclusion
under the documented same-user trust boundary and whose ledger owns the
`delivery-proof:v1` and `delivery-compatibility:v1` evidence events. Its
existing ignored review-state boundary also owns the transient deterministic
compatibility request; that request is reviewer input, never authority.
5F5ZZA later governs semantic invalidation and authenticated user provenance.
No new architecture record is needed.

## Known deviations

The first-edit prerequisite and final readiness result are structural. This is
the recorded **Structure enforces; instructions suggest** conflict: recording
proof at each clean implementation-task boundary is instruction-backed because
Safeword has no host-neutral task-transition event, and this plan rejects a
per-TDD-step hook as disproportionate noise. Final receipts cannot prove when
the contributor recorded them. If contributors repeatedly defer all recording
to the end, add a one-shot task-boundary signal before claiming stronger R3
enforcement.

This child defines and directly proves the shared R1 prerequisite helper, but
does not claim the installed end-to-end first-execution behavior. 7CAMAD owns
producing and persisting phase provenance and composing this helper with the
live gate; YCFFNC owns installed-host dispatch. The dependency direction stays
7CAMAD consuming A639WN, so A639WN does not depend on its consumer. Epic-level
completion of R1 requires those sibling deliverables even though this child's
contract can merge independently. At this child's merge, the accepted scenario
“The installed CLI workflow creates the checklist before execution” and the
matching first `done_when` entry remain intentionally unproven end to end; do
not close the epic against either until those consumers land. The only live
R1-adjacent behavior in this child is plan-execution admission refusing a
missing or unreviewed checklist; the first-edit helper has no runtime effect on
real tickets until its consumers land.

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
Safeword therefore leaves those dependencies pending.

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

- The proof-recording leaf is enabled outside a trusted same-user checkout
  before 5F5ZZA supplies authenticated host-user provenance: stop rollout or
  add an authority check before executing repository-declared argv.
- `designApprovalGate` is disabled after a ticket has entered execution: treat
  the configuration edit as a project-policy decision and require the authority
  that owned the enabled gate before accepting a new plan review.

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
- Repeated same-item, same-revision proof attempts commonly precede a pass:
  retain attempt counts before treating record-on-pass as trustworthy evidence.
- A proof-spec target changes after semantic review while its retained argv
  stays unchanged: require renewed semantic review of that proof before relying
  on a fresh command receipt.
- An earlier-revision proof is accepted without an explicit compatibility
  reason, or a partial proof closes a real-boundary item: strengthen the
  evaluator before admitting the affected workflow.
- A repository needs a default category absent from the canonical set: add it
  through the phase contract rather than project-local parser drift.
- Checklist updates require cross-process atomicity beyond normal source
  control: reassess the single-artifact model before adding a ledger.
