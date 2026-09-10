# Impl Plan: Approve coherent Implementation Plans

**Status:** planned
**Planned on:** 2026-09-08

## Approach

Architecture at a glance: one canonical phase model owns the transition from
behavior to design to execution; one project-local `impl-plan.md` owns the
accepted design; one generated author/reviewer contract defines its quality;
and existing transition hooks, review packets, and receipts enforce the same
boundary across supported hosts. The Implementation Plan gives a reviewer the
mental model, contracts, operational consequences, risks, and unresolved
authority needed to approve the approach. Linked artifacts may carry detailed
proof, research, or execution data and may carry the full detail of a named
decision when they are resolvable, explicitly subordinate to `impl-plan.md`, and
included in the bounded review packet. The plan must still name the decision,
why it matters, its consequence, and the supporting link. A separately
authoritative or unlinked feature design document is a competing plan of record
and blocks approval.

This is a prospective design plan written while transitional implementation
machinery already exists. The plan therefore labels proposed decisions,
implemented facts, available proof, known deviations, and pending human
authority separately. Existing code is evidence about current behavior, not
automatic proof that the proposed design is correct or approved.

Current delivery state is explicit: production slices for R1–R10 exist, but
scenario repairs reopened R1, R2, R3, R6, R7, and R9 because their old proof no
longer covers the accepted behavior. R11 retains only its independently accepted
executable RED; R12 is the last currently proven scenario. R13–R20 and the new
missing-contract, directory-ADR, ownership-conflict, lifecycle, approval-order,
and applicability partitions remain unimplemented. These open ledger entries
are the current known defects. Scenario-driven edits require a fresh plan review.
The optional human design-approval gate is not configured, so no human plan
authority is pending. The accepted 41-scenario baseline was reviewed only by the
documented bounded main-thread fallback after both independent routes exhausted;
it is accepted without a claim of independence. Both 2026-09-10 architecture
decisions were separately user-authorized and remain distinct from plan-review
or test state.

The riskiest assumption is that a second explicit planning phase produces a real,
cross-host boundary rather than another prose-only convention. The cheapest
discriminating slice is the R1 phase-transition scenario: an unresolved
behavior-shaping choice must block `plan-implementation → plan-execution`, while
a current reviewed Implementation Plan must permit it. A constant allow or deny
implementation fails one of those rows.

The design adds one canonical `plan-execution` phase between
`plan-implementation` and `implement`. The Implementation Plan remains the one
project-local design record. It contains the decisions a human or agent must
judge—architecture, data, interfaces, risk, rollout/rollback, and proof scope—but
not file-by-file work or test commands. A separate project-local
`execution-plan.md` will later translate the accepted design into startable TDD
work. This ticket establishes the first half of that boundary; sibling `7CAMAD`
owns the Execution Plan contents and its implement-entry gate.

The author and reviewer will consume one generated Implementation Plan contract.
Its canonical source is a delimited contract block in the planning skill; the
build extracts that exact text for the review runtime. Review preparation hashes
the resolved contract, records its identity in the review packet and durable
receipt. This ticket distinguishes present-but-unequal author/reviewer contract
identities. Digest inequality blocks approval; the same delimited-obligation
comparison used by conformance proof identifies each missing or changed
obligation by its contract heading in the receipt and names reconciliation as
recovery. A mismatch-only receipt is insufficient. If no packaged contract is
readable, the installed CLI blocks authoring and approval and names the
regenerate action. SHA-256 is integrity identity, not a claim that the prose is
semantically good; independent semantic review still judges the decisions.

The Implementation Plan parser will enforce only observable structure and
applicability: a present, non-empty architecture-at-a-glance section, scope boundary,
approach decisions, architecture and data applicability, rollout/rollback,
proof strategy, decision-depth state models for significant workflows,
measurement-design applicability, linked supporting detail, unresolved
authority, truthful state labels, exact-plan human-approval state, repair-loop
state, and honest skips. The review rubric—not the parser—will judge
whether decisions are complete, evidence is credible/current, the summary fits a
focused 30–60 minute review, and execution choreography obscures the decision.
Every simultaneous blocker is returned so authors do not repair one hidden
failure at a time.

The deterministic contract-conformance fixture is not a scripted verdict
table. Each semantic obligation has a mutation check: deleting its clause from
the exact packaged contract bytes must make the corresponding scenario fail,
and the emitted finding must identify the missing contract obligation. This
keeps the packaged author/reviewer contract, rather than a test-only checker, as
the real judgment boundary.

The R9 single-plan check runs at semantic review. Project knowledge resolution
supplies an authority manifest containing `impl-plan.md`, the configured
architecture record, and every design-detail link named by the ticket or plan.
Ordinary phase artifacts such as `spec.md`, `ticket.md`, `dimensions.md`, and
the behavior ledger are bounded review context, not design-plan candidates, and
need no link from `impl-plan.md`. No new design-root setting or scan of every
Markdown file is introduced. A file outside the configured architecture record
or an explicitly named design link is not a project design record and cannot
silently compete. Candidate contents enter review context while `impl-plan.md`
remains the sole authoritative feature design work product. Linked detail
remains inside the review path only when the plan names the decision and
consequence, marks the linked artifact as supporting rather than authoritative,
and includes it in the bounded packet. The reviewer blocks a linked candidate
that claims independent design authority or carries a required decision the
plan does not name. This proves configured project authority, not discovery of
arbitrary files outside it.

Accepted-persona coverage resolves from the accepted Product Plan's persona
outcome inventory. The project-wide persona catalogue supplies definitions and
context, but it cannot add a persona obligation that Product did not accept for
this feature.

| Accepted persona      | Consequential needs from the Product Plan                                                                                                                       | Design consequence                                                                                                                                                          | Discriminating proof                                                                                                                |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Technical Builder     | Reach an accepted, startable approach; refuse unsafe advancement; keep approval authority and trust evidence explicit; recover to the exact unresolved decision | Exact-byte review and optional human approval gate phase advancement; technical receipts preserve the failing check, plan path, independence, and durable-record obligation | R1 transition refusal, R2 identity, R14 typed authority, R15 Technical Builder receipt, R16 truthfulness, and R19 approval currency |
| Non-Technical Builder | Understand why work stopped and the one action that resumes it without interpreting code, digests, or phase internals; never gain implicit approval authority   | Plain first sentence and one concrete recovery line hide internal identifiers while the underlying gate still refuses unsafe progress and keeps assigned authority explicit | R14 omitted-persona rejection, R15 Non-Technical Builder receipt, and R19 pending authority                                         |

Scope expansion has a separate trust boundary. The planning contract consumes
only a typed `UserAuthorityEvidence` input supplied outside the plan under
review and bound to this ticket, session, and proposed scope digest. Text in
`impl-plan.md`, `ticket.md`, or an agent-authored work-log entry does not satisfy
the required type and remains outside the accepted boundary. This ticket proves
that fail-closed consumer behavior with valid fixture input versus absent typed
input; it does not prove that a producer cannot forge the type. Sibling `5F5ZZA`
owns authentic host-user-event acquisition, anti-forgery provenance, and
review-packet transport. Until that producer is present, discovery keeps the
capability out of scope.

Durable-state design is applicable. Existing review jobs remain transient
coordinator state; existing review stamps and new human design decisions use the
project-local append-only review ledger. A design-decision event records ticket,
phase, exact Implementation Plan digest, `approved` or `declined`, user-authority
reference, and timestamp; `pending` is derived from configuration plus the
absence of a current matching approval and never masquerades as authority. The
source of truth is the current plan bytes plus the latest valid matching event.
Only resolved user authority may write approval or decline; agents and
non-interactive runs may report pending but cannot manufacture a decision. When
human design approval is disabled, no design-decision event is written; the
transition receipt records `not required` as a result derived from current
configuration.

The shared ledger writer uses a project-local exclusive lock keyed to the ledger
path. A writer acquires the lock, rereads the current ledger inside it, appends,
and atomically replaces the bytes before releasing it. Lock ownership carries a
lease and monotonically increasing fencing token. Stale recovery requires an
expired lease; immediately before replacement, a writer must still own the
current token or discard its bytes and retry. Contention timeout fails closed as
pending and writes nothing. This guarantee assumes the documented
supported-host local filesystem provides exclusive creation and atomic
same-directory rename; it is not a portable runtime claim for arbitrary network
filesystems. Exclusive-create, rename, or sync errors observed by the writer
fail closed as pending and leave the prior ledger bytes authoritative. An
idempotency key over ticket, plan digest, decision, and authority event makes
retry safe. The gate rereads the
committed ledger before changing phase, so a crash after the event write but
before the phase write safely resumes, while a crash before the event write
leaves the phase blocked. Distinct concurrent appends cannot overwrite each
other; a failed or timed-out writer retries from the newly committed ledger.
Events are retained with
the project for audit; new plan bytes make old events non-current rather than
deleting them. The host-user event flows through 5F5ZZA's typed provenance
boundary into this consumer and stores no decision rationale or sensitive
content beyond the minimum authority reference. Existing tickets with approval
enabled but no digest-bound event enter `pending`; no backfill invents approval.
Unknown review-ledger event kinds are inert for authority decisions and are
preserved byte-for-byte when known events are appended; known receipts remain
readable rather than making the whole ledger unusable. Rolling the feature back
leaves new design-decision events readable but non-authoritative under the old
phase sequence. YCFFNC owns deployment activation, compatibility, and rollback
to that pre-feature sequence.

Proof strategy by behavior cluster:

| Rules / behavior                                         | Real boundary                                                                                                                                                                      | Primary proof                                                                                                                                                                                                                                                             | Confidence limit                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1 phase entry                                           | Ticket transition through the installed hook/CLI gate                                                                                                                              | Integration                                                                                                                                                                                                                                                               | Local integration proves deterministic phase gating; cloud-host rows still require their existing real-host acceptance lanes.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| R11 unresolved decisions                                 | Exact packaged Implementation Plan contract through the deterministic contract-conformance reviewer; installed CLI review receipt for the simultaneous-blocker case                | Pure contract matrix plus separate real-process CLI integration                                                                                                                                                                                                           | The contract matrix proves unresolved and resolved API, rollback, and proof-scope outcomes at the accepted semantic-fixture boundary. It does not prove installed wiring or live-reviewer consistency; the tagged CLI scenario separately proves that one installed invocation retains every simultaneous blocker.                                                                                                                                                                                                                                                                                                                                   |
| R2 exact contract identity                               | Canonical skill extraction → packet → reviewer → receipt/stamp and installed missing-contract recovery                                                                             | Integration plus unit parser matrices for equal, unequal, and absent contracts                                                                                                                                                                                            | Independent review, rather than digest equality, proves semantic quality. The installed absence row proves actionable fail-closed recovery.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| R13 structural-vs-semantic evidence                      | Implementation Plan parser followed by the packaged semantic reviewer contract                                                                                                     | Parser matrix that independently removes the evidence reference, applicable version, and retrieval date; contract mutation and review fixture for a contradicted applicability skip                                                                                       | Each missing field produces its own structural finding, while a structurally complete but dishonest skip reaches semantic review and fails there. The fixtures prove the division of responsibility, not external-source truth.                                                                                                                                                                                                                                                                                                                                                                                                                      |
| R3 mental model and focused reviewability                | Implementation Plan parser followed by the real review coordinator with bounded project-local packet                                                                               | Parser rejection for an absent or empty architecture-at-a-glance section; deterministic review fixtures for usable decision-first, unusable contract-bearing, and execution-first presentations; current-revision independent-review acceptance artifact                  | Structural absence blocks before semantic review with the same observable no-approval outcome; a present section still fails semantic review when it does not give a usable mental model or buries decisions under execution detail. Live reviewer consistency remains variable, so unavailable exact-contract acceptance is reported honestly rather than inferred.                                                                                                                                                                                                                                                                                 |
| R12 evidence quality                                     | Packaged reviewer contract over a current and a named-superseded evidence baseline                                                                                                 | Contract mutation matrix plus independent-review acceptance                                                                                                                                                                                                               | Removing the credible-alternative, losing-tradeoff, or evidence-currency obligation fails its matching mutation. The matrix proves the rubric distinguishes those states, not that every external source is true.                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| R14 bounded discovery and persona consequences           | Typed authority consumer and accepted Product Plan persona inventory in the review packet                                                                                          | Contract matrix plus deterministic review integration                                                                                                                                                                                                                     | The proof rejects plan-authored authority and omitted accepted-persona consequences. Authentic production and anti-forgery provenance remain a `5F5ZZA` prerequisite.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| R15 focused-review receipt judgment                      | Real review coordinator receipt projection                                                                                                                                         | Deterministic semantic-review integration                                                                                                                                                                                                                                 | The proof distinguishes a subordinate-detail summary from one obscured by execution mechanics; it does not prove installed CLI wording or persona-specific recovery.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| R15 persona-specific blocked receipts                    | Installed Safeword CLI presenting a reviewer result through real internal collaborators                                                                                            | Real-process CLI integration for Non-Technical Builder and Technical Builder projections                                                                                                                                                                                  | The Non-Technical Builder assertion covers the first sentence and recovery line, including the absence of phase names, review identifiers, digests, and internal types. The Technical Builder assertion separately requires the failing check, plan location, and durable-record obligation. Neither row proves other host renderers, which remain a `YCFFNC` prerequisite.                                                                                                                                                                                                                                                                          |
| R16 state truthfulness                                   | Reviewer contract supplied independently varied implementation, proof, defect, and human-authority state                                                                           | Contract mutation matrix plus deterministic semantic-review integration                                                                                                                                                                                                   | Distinct cases fail if code is treated as proof, proof as release authority, or independent review as human approval; the fixtures prove state separation, not the truth of untrusted self-reported evidence.                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| R4 project-local authority                               | Installed Safeword CLI and project-local artifact resolution                                                                                                                       | CLI integration                                                                                                                                                                                                                                                           | This ticket proves only the canonical CLI boundary. Installed host delivery, including OpenCode Desktop advisory behavior, remains an explicit `YCFFNC` prerequisite.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| R5 architecture and R7–R9 durable/single-record behavior | Implementation Plan parser and semantic review using configured project knowledge; phase edit gate for the configured architecture location                                        | Unit contract matrices plus integration review packet and edit-gate matrix covering an exact configured file; a sibling; a direct `YYYYMMDD-slug.md` child of a configured ADR directory; non-dated, nested, and outside-directory near misses; and ordinary path denials | A configured file admits only itself. A configured directory admits only direct children matching the dated ADR filename contract. Semantic review still blocks absent or unresolved links, competing design authority, and significant choices without a durable record.                                                                                                                                                                                                                                                                                                                                                                            |
| R6 decision-bearing data coverage                        | Packaged plan contract and semantic reviewer over applicable, honestly inapplicable, incomplete, contradictory, and mechanics-polluted data models                                 | Contract mutation matrix plus deterministic semantic-review integration                                                                                                                                                                                                   | The proof varies all eleven decision areas, rejects a persisted owner that contradicts the named source of truth, and rejects exact migration commands even when every data decision is present. It proves that decisions and mechanics are distinguished, not that a future migration will execute correctly.                                                                                                                                                                                                                                                                                                                                       |
| R8 file-count-independent architecture significance      | Semantic-review contract over shared-interface, quality-attribute, data-lifecycle, migration/compatibility, difficult-reversal, and contract-preserving mechanical fixtures        | Contract matrix plus independent-review acceptance pair                                                                                                                                                                                                                   | The review receipt requires a durable record for every semantic trigger family and does not require one for the mechanical control; file count is never a trigger.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| R10 proof scope without mechanics or evidence ledger     | Implementation Plan parser and reviewer contract                                                                                                                                   | Unit rejection matrix plus review integration                                                                                                                                                                                                                             | The plan names behavior, real boundary, proof type, and confidence limit, then links detailed evidence. Lexical checks alone cannot classify every sentence; semantic review remains authoritative.                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| R17 significant workflow decision depth                  | Packaged plan contract and deterministic semantic-review conformance boundary                                                                                                      | Contract matrix plus installed CLI review integration                                                                                                                                                                                                                     | Durable state, authorization, migration, concurrency, and lifecycle fixtures vary state, transition authority, atomicity, retry, compatibility, and preserved evidence so labels alone cannot pass.                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| R18 measurement-design ownership                         | Product promise → Implementation Plan review packet                                                                                                                                | Contract matrix plus deterministic semantic review                                                                                                                                                                                                                        | Product owns the promised 30–60 minute target and reviewer population. This plan owns the study method and validity safeguards: start when the reviewer begins the decision summary, stop at approve/block, record whether the reviewer can explain the approach and unresolved authority, sample reviewers without authoring context, and report setup interruptions separately. Independent rejection cases prevent changing the Product-owned target, changing the affected population, or substituting instrumentation commands for validity decisions. The semantic receipt's pass/fail is diagnostic input, not duration proof by self-report. |
| R19 approval-ledger durability                           | Project-local ledger writer and installed transition gate using real temporary-project files, two concurrent writer processes, a controlled clock, and injected write/phase faults | Concurrent-writer integration plus crash/fault matrix covering distinct appends, contention timeout, expired lease with stale fencing token, crash before event write, crash after event write but before phase change, idempotent retry, and unknown-event preservation  | The proof fails if either distinct append is lost, a stale writer commits, timeout mutates bytes, recovery invents approval, retry duplicates an event, or a known append changes an unknown event's bytes. It establishes the supported local-filesystem boundary only; installed-host and non-local filesystem claims require their own acceptance evidence.                                                                                                                                                                                                                                                                                       |
| R19 exact-plan human approval and headless completion    | Installed CLI approval boundary with interactive and non-interactive invocation fixtures                                                                                           | Real-process integration                                                                                                                                                                                                                                                  | Approval runs only after semantic review passes, binds exact bytes, recomputes currency after edits, and leaves headless work settled in Implementation Planning with approval pending. The two post-Execution-Plan scenarios use a contract-compatible completed-plan fixture to prove approval reuse and staleness here; `7CAMAD` must prove composition with the real artifact and implement-entry gate before parent release. Fixture authority proves consumer behavior only; authentic human-event provenance remains a `5F5ZZA` release prerequisite.                                                                                         |
| R20 complete repair loop                                 | Installed CLI review and decision-discovery loop with deterministic reviewer process results                                                                                       | End-to-end CLI integration                                                                                                                                                                                                                                                | The first receipt exposes the full three-defect set together; accepted owners resolve each decision; the approving receipt binds the corrected digest and cannot bind the original bytes; unavailable external authority produces an honest pending result rather than approval or a fixed retry cap.                                                                                                                                                                                                                                                                                                                                                |

Affected-surface coverage. All six host rows share one justified M2 deferral:
YCFFNC owns installed delivery and parity; the table retains only each host's
distinct proof boundary.

| Surface                      | Proof                                                                                       |
| ---------------------------- | ------------------------------------------------------------------------------------------- |
| Safeword CLI                 | Public review/transition command integration uses real config resolution and collaborators. |
| Claude Code                  | skip: installed lifecycle boundary in M2.                                                   |
| Claude Code Cloud            | skip: fresh-VM boundary in M2.                                                              |
| OpenAI Codex                 | skip: packaged-plugin boundary in M2.                                                       |
| OpenCode CLI/TUI and Desktop | skip: installed profile and explicit Desktop advisory boundary in M2.                       |
| Cursor                       | skip: installed project-hook boundary in M2.                                                |
| Cursor Cloud Agents          | skip: fresh-runner boundary in M2.                                                          |

Build order under the current planning contract; labels state current progress:

1. **Reopened proof:** prove the riskiest R1 installed phase-transition boundary
   before further rubric investment.
2. **Partly implemented; proof reopened:** maintain the canonical phase,
   contract identity, and approval-state domain model; prove equal, unequal,
   absent-contract, and current/stale approval cases.
3. **External prerequisite:** sibling `7CAMAD` must establish the Execution Plan artifact
   and implement-entry gate before this ticket may remove build/test mechanics
   from the current plan contract or ship.
4. **Production slices exist through R10; R11 has accepted executable RED and R12 has current proof; expansion remains open:** replace the current proof-quality-heavy Implementation Plan template/rubric
   with the decision-focused artifact contract, including architecture, data,
   rollout/rollback, proof-scope, reviewability, persona consequences, truthful
   state, significant-workflow decision depth, measurement design, and
   all-blocker receipts; prove R3 and R5–R18.
5. **Partly implemented; expanded proof open:** carry the phase, contract, configured-architecture edit exception, canonical
   skill extraction through review packet to receipt/stamp, and project-local
   plan authority through the installed Safeword CLI; prove the tagged R1, R2,
   R4, R7, R11, and R15 boundaries there, including simultaneous-blocker and
   distinct Non-Technical Builder and Technical Builder receipt projections.
6. **Not implemented:** implement digest-bound approval/decline/pending state,
   the shared ledger writer, and the complete decision-discovery repair loop on
   that installed CLI boundary; prove R19's concurrent append, crash-resume,
   lease/fencing, timeout, idempotency, unknown-event, approval-currency, and
   headless cases plus R20's repair loop with deterministic process results.
7. **Not implemented:** update configured customer documentation, confirm the
   durable architecture record remains current, then run targeted, full, and
   release-contract verification for this M1 slice.

Dogfood activation is deliberately last. Source contracts and tests may be built
behind the current installed workflow, but the canonical template sequence and
generated/project-installed hooks are not reconciled into this repository until
`G1C9PP`, `7CAMAD`, `5F5ZZA`, and `YCFFNC` prerequisites are present together.
The existing installed `plan-implementation → implement` gate therefore remains
authoritative for these in-flight child tickets. YCFFNC owns the final
integration activation mechanism, its crash/retry semantics, and rollback; this
ticket makes no atomic-activation claim.

## Decisions

### Implementation Inspiration

<!-- prettier-ignore -->
| Reference | Checked on | Source version | Target version | Evidence of fit | Principle to borrow | Mismatch / license / security boundary |
| --- | --- | --- | --- | --- | --- | --- |
| https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments | 2026-09-08 | GitHub Actions documentation current 2026-09-08 | Safeword 0.83.1+ | Required reviewers create an observable waiting state and prevent downstream execution until approval | Model planning approval as an explicit transition state, not prose inside one phase | Hosted deployment semantics are not copied; user-self-review policy is outside this ticket |

**Decision impact:** changed: the accepted two-goal model becomes two observable
ticket phases and two separately reviewed artifacts instead of one mixed plan or
an invisible substate.
**Decision informed:** Represent Execution Planning as an explicit canonical phase

### Recorded Decisions

| Decision                                                          | Choice                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Alternatives considered                                                                                                                                             | Rejected because                                                                                                                                                                                                      |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Represent Execution Planning as an explicit canonical phase       | Add `plan-execution` between `plan-implementation` and `implement`, with `execution-plan.md` owned by that phase                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Two sections in one plan; two files in one phase with hidden substate                                                                                               | One plan preserves the mixed review unit; hidden state cannot be observed or enforced consistently by host gates and receipts                                                                                         |
| Give Implementation Planning one author/reviewer contract         | Extract one canonical contract block into generated runtime text and bind its SHA-256 identity into review packets and receipts                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Duplicate author/reviewer prose with parity tests; runtime-only rubric; schema alone                                                                                | Duplicate prose can drift before tests run; runtime-only text is not available to authors; structural schema cannot express semantic decision quality                                                                 |
| Keep structural and semantic checks separate                      | Parsers enforce required structure/applicability; independent review judges implementability, evidence, trade-offs, and focused reviewability                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Encode all quality as lexical/parser rules; let review check everything including file existence                                                                    | Lexical rules reward proof-shaped prose and create false confidence; review-only structure produces slow, inconsistent recovery for observable omissions                                                              |
| Validate evidence without prescribing presentation                | The parser requires an evidence-bearing decision section or justified applicability skip and, for each applicable external evidence entry, a stable reference, retrieval date, and applicable version in table, prose, or bullets; semantic review judges credibility, currency, and support                                                                                                                                                                                                                                                                                                           | Parse one mandatory table; require invented citations; leave field presence to semantic review                                                                      | One table violates presentation neutrality; invented citations reduce trust; semantic review is the wrong expensive boundary for observable missing fields                                                            |
| Keep one design plan of record                                    | `impl-plan.md` remains authoritative and names each required decision, why it matters, and its consequence; a resolvable subordinate artifact included in the review packet may carry full decision detail; significant cross-feature decisions also enter configured architecture                                                                                                                                                                                                                                                                                                                     | Require every detail inline; allow unlinked or separately authoritative feature design documents                                                                    | Embedding all detail defeats focused reviewability; competing authority splits the review path and lets required decisions evade the bounded review                                                                   |
| Make durable architecture recording possible before approval      | A configured architecture file admits only that exact file; a configured ADR directory admits only direct `YYYYMMDD-slug.md` children. Siblings, non-dated children, nested/outside paths, and ordinary files remain frozen.                                                                                                                                                                                                                                                                                                                                                                           | Exact-path-only directory matching; permit every directory child; record after implementation starts                                                                | Exact-only prevents ADR creation; blanket prefix access widens the freeze; post-approval recording makes R7 circular                                                                                                  |
| Lead with the reviewer's mental model                             | Open with architecture at a glance, then contracts and invariants, operational consequences and risks, and unresolved decisions with their authority                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Follow code order; use a generic executive summary; lead with a verification ledger                                                                                 | Code order serves the implementer; a generic summary can omit load-bearing choices; evidence-first prose makes proof volume stand in for design quality                                                               |
| Apply guides by decision applicability                            | Architecture guidance applies to component/shared-contract consequences; data guidance covers purpose, store and model, schema and relationships, source of truth, ownership and access, identity and integrity, cross-system flow, lifecycle and retention, migration and backfill, compliance, and rollback at decision depth. A persisted owner that conflicts with the named source of truth blocks approval, and migration commands cannot substitute for decisions even when every decision field is present. Testing guidance chooses behavior, real boundary, proof type, and limitation only. | Always require every guide; leave guides entirely to Execution Planning                                                                                             | Universal checklists add noise; deferral lets behavior-shaping architecture/data/proof decisions become implementer guesses                                                                                           |
| Keep the evidence ledger outside the decision path                | The plan states proof scope and confidence and links detailed current-revision, earlier-revision, partial, or missing evidence in its owning artifact                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Repeat test names, hashes, and scenario results in the plan; omit proof state entirely                                                                              | Repetition bloats and stales the approval surface; omission prevents reviewers from judging whether the approach can be validated                                                                                     |
| Preserve delivery-state truth                                     | Label proposed design, implemented behavior, available proof, known defects, and pending human authority separately whenever they coexist                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Treat current code as accepted design; treat passing proof as release approval; describe only the desired end state                                                 | Each alternative rewrites a materially different fact and can produce false confidence or unauthorized rollout                                                                                                        |
| Preserve one configured human approval                            | Bind approval to the exact independently reviewed Implementation Plan bytes; reuse it while current; require a new decision after change; hold headless work pending without prompting; on decline, remain in Implementation Planning and bind the declined digest in the repair receipt. Decline does not revoke a separately user-authorized durable architecture decision: that record remains current until user authority explicitly supersedes it.                                                                                                                                               | Approval once per ticket; human approval after both plans; advance while pending; no human approval                                                                 | Ticket-wide approval goes stale silently; double approval recreates meeting burden; pending is not authority; no approval removes the explicit design authority teams need                                            |
| Persist approval state safely                                     | Reuse the project-local append-only review ledger with digest-bound, idempotent approval/decline events; derive pending and currency from config, current bytes, and the latest valid event; serialize and atomically replace ledger bytes before phase transition. Treat unknown event kinds as authority-inert, preserve them on append, and continue reading known receipts so older/newer writers interoperate safely.                                                                                                                                                                             | Store mutable approval on ticket frontmatter; overwrite one current receipt; keep state only in host memory; reject the whole ledger when one event kind is unknown | Frontmatter conflates workflow and authority; overwrite destroys audit history; host memory breaks project-local handoff and recovery; whole-ledger rejection lets an unrelated extension erase valid review currency |
| Accept scope expansion only from trusted user authority           | Consume ticket/session/scope-digest-bound `UserAuthorityEvidence` derived outside the reviewed plan from a host user-role event; fail closed when it is absent, and let `5F5ZZA` own its provenance and transport                                                                                                                                                                                                                                                                                                                                                                                      | Accept an approval sentence in the plan or work log; block every scope expansion permanently                                                                        | Agent-authored prose can counterfeit the first option; permanent denial would ignore real user authority and make iterative discovery unusable                                                                        |
| Require decision-depth models only when the choice is significant | Significant concurrency, security, durability, lifecycle, migration, and compatibility decisions must state applicable state, authority, atomicity, retry, and evidence behavior; routine local choices do not                                                                                                                                                                                                                                                                                                                                                                                         | Require the full model for every choice; accept labels without behavioral depth                                                                                     | Universal modeling bloats focused review; labels alone let destructive or retry behavior remain an implementer guess                                                                                                  |
| Keep quantitative ownership split by phase                        | Product owns the promised target and population; Implementation Planning decides measurement origin, method, validity safeguards, and failure behavior; Execution Planning owns instrumentation commands                                                                                                                                                                                                                                                                                                                                                                                               | Put the entire metric in Product Planning; defer all measurement detail to execution                                                                                | Product-only detail cannot establish technical validity; execution-only detail allows measurement design and failure semantics to be invented while building                                                          |
| Repair plans through the same decision-discovery loop             | Return the full current blocking set, route each defect to its accepted decision owner, re-review corrected exact bytes, and stop honestly on unavailable external authority without a fixed repair cap                                                                                                                                                                                                                                                                                                                                                                                                | End at the first rejection; repair one finding per pass; let the reviewer choose missing product behavior                                                           | Rejection alone does not deliver a complete plan; serial hidden findings waste cycles; reviewer-owned decisions silently expand authority                                                                             |

The shared-contract pattern is informed by OpenAPI 3.2's single interface
description for human and machine consumers
(https://spec.openapis.org/oas/v3.2.0.html, checked 2026-09-08). The
digest-bound review pattern is
informed by SLSA v1.2 provenance's subject identity
(https://slsa.dev/spec/v1.2/provenance, checked 2026-09-08). Both are
informational patterns only:
Safeword claims neither OpenAPI nor SLSA conformance, and reuses no source code.

The explicit phase and planning edit exception are significant shared workflow
contracts recorded in the resolvable `ARCHITECTURE.md` section “Separate
Implementation and Execution Planning Gates.” The shared review-ledger event,
locking, fencing, retention, and unknown-kind compatibility contracts are
significant too and are recorded separately in “Digest-Bound Planning Decisions
in the Shared Review Ledger.” The first entry explicitly supersedes the
transition and six-section artifact portions of the 2026-07-09
“plan-implementation: a gated planning phase as the Automation on-ramp”
decision while preserving its rationale and content-hash review history. The
remaining choices are feature-local consequences and remain in this plan.

## Design alignment

| Principle                                         | Consequence                                                                                                                                       | Proof                                                                                                                                                                                                                                                                                         | Conflict |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| Optimize for the NTB without constraining the TBU | Blocked receipts lead with a plain recovery while preserving paths, failed checks, identities, and evidence for technical readers                 | `features/approve-coherent-implementation-plans.feature` R15 plus CLI protocol integration                                                                                                                                                                                                    |          |
| 1. Structure enforces; instructions suggest       | Explicit artifacts, phase transitions, contract identities, and receipts enforce the boundary; prose teaches the qualitative judgment             | phase-provenance, plan-gate, review-packet, and receipt integration coverage                                                                                                                                                                                                                  |          |
| 2. Fire at boundaries, not every turn             | Contract and semantic review run at Implementation Planning exit; no per-turn plan-quality judge is added                                         | transition/review-trigger integration coverage                                                                                                                                                                                                                                                |          |
| 3. Add, never replace                             | Preserve customer-owned plan bytes and do not enable the new phase sequence until sibling `YCFFNC` supplies deterministic in-flight compatibility | existing schema-ownership regression tests, outside the behavior ledger because they verify the pre-existing unmanaged-artifact invariant, keep `.project/tickets/**/impl-plan.md` byte-identical through template reconciliation; `YCFFNC` migration scenarios remain a release prerequisite |          |
| 4. Discover decisions before prescribing work     | Implementation Planning resolves consequential choices; Execution Planning may only sequence them                                                 | R11/R14 behavior and the two phase contracts                                                                                                                                                                                                                                                  |          |
| 5. Contribute, then converge                      | The planning guidance proposes concrete candidates and trade-offs before seeking missing user-only authority                                      | planning skill contract review fixtures                                                                                                                                                                                                                                                       |          |
| 6. Correct and safe; then clear; then simple      | One new phase reuses the existing transition/review infrastructure; no second workflow engine or dependency is introduced                         | dependency diff, phase parity, and full-suite verification                                                                                                                                                                                                                                    |          |

Existing decisions honored:

- “Unified BDD+TDD Workflow” keeps TDD inline in the BDD workflow; the new
  boundary separates planning goals, not skills.
- “Continuous Quality Gates” remains the enforcement mechanism; phase and
  review state continue to derive from project-local ticket artifacts.
- “Host-owned cross-agent adversarial review coordinator” and its ranked local
  route extension remain the only review path. Implementation Planning is one
  new kind within its bounded work-product/context packet, typed provenance,
  and exhausted-route contract; sibling `5F5ZZA` owns route and fallback detail.
- The existing content-hash-bound review receipt remains the immediate R1
  currency check: any source-byte change makes the receipt stale and names
  revalidation. Sibling `5F5ZZA` later narrows invalidation to semantically
  relevant context without weakening this ticket's fail-closed behavior.
- “Registry-Driven Agent Integrations with Native Trust Boundaries” remains
  the source of host capability truth; unsupported Desktop enforcement is not
  overstated.

## Known deviations

- The current planning gate asks this transitional `impl-plan.md` to contain a
  build order and proof paths. The new Implementation Plan contract deliberately
  moves those mechanics to `execution-plan.md`; this plan includes them only to
  satisfy the currently installed pre-change gate.
- The current artifact template has no explicit `Proposed new scope` or
  `Unresolved authority` section. This transitional plan carries those facts in
  the ticket scope, decision table, and Known deviations rather than inventing
  another locally authoritative shape; the new contract makes them explicit.
- The configured architecture record is the living `ARCHITECTURE.md`, not a
  second feature design plan. This bootstrap change was recorded there under
  the user's explicit authority. The implementation must make that satisfiable
  without an override for later tickets by admitting only the configured
  project-owned architecture path through the planning freeze; ordinary source
  and documentation paths remain blocked.
- The 2026-07-09 architecture entry now carries a reverse supersession marker,
  and the shared ledger protocol has its own accepted 2026-09-10 decision.
  Those planning edits change the review context, so approval must bind the
  exact revised packet.
- This ticket is not independently releasable: `7CAMAD` must provide the
  Execution Plan and implement-entry gate before G1C9PP removes execution
  mechanics, `5F5ZZA` must provide trusted scope-authority/review provenance,
  and `YCFFNC` must provide in-flight migration. The parent delivery gate treats
  those sibling outcomes as prerequisites rather than silently absorbing them
  into this ticket.
- Within R14, this ticket proves the consumer's typed-input versus absent-input
  boundary. It does not prove that the input was authentically produced or
  cannot be forged; those provenance claims remain unproven until `5F5ZZA`
  supplies host-user-event acquisition and binding. Parent completion must not
  treat a fixture-minted value as that end-to-end proof.

## Doc impact

- `README.md`: explain the two planning goals and the normal feature phase flow
  without exposing internal review machinery to non-technical users.
- `packages/website/src/content/docs/getting-started/workflow.mdx`: G1C9PP owns
  the Implementation Planning purpose, human-review summary, guide-routing, and
  single approval timing. `7CAMAD` owns the Execution Planning instructions;
  `5F5ZZA` owns review freshness/provenance; `3EG00H` owns task/patch wording.

These updates follow the contract, gate, and host work so examples describe the
verified shipped behavior.

## Assessment triggers

- A host gains first-class workflow substate with the same durable,
  project-local transition and receipt guarantees as a phase: reconsider the
  explicit phase to reduce public state.
- A focused-review receipt records that a reviewer could not reach a decision
  within the Product-owned 30–60 minute review window because execution or
  evidence detail obscured the choices: tighten the summary or move supporting
  detail behind links; do not move unresolved decisions into Execution Planning.
- Contract-digest mismatches occur during normal same-version use: audit
  generation and delivery provenance before weakening identity checks.
- Normal local use repeatedly hits approval-ledger contention timeouts, stale
  lease recovery, or material audit-read cost: reassess the append-only ledger,
  lock lease, fencing token, and retention policy before weakening fail-closed
  authority behavior.
- An Execution Plan review returns a newly discovered architecture, API, data,
  rollback, or proof-scope choice to Implementation Planning: strengthen the
  corresponding decision-discovery obligation before accepting that choice
  downstream.
- Live Claude, Codex, OpenCode, or Cursor behavior diverges from declared phase
  enforcement: preserve the project-local plan as authority and downgrade the
  affected host claim until real acceptance evidence is restored.
