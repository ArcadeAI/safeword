# Impl Plan: Keep plan reviews current and trustworthy

**Status:** planned
**Planned on:** 2026-09-20

**State reconciliation (2026-10-21):** Main `9f6ac6fce` (#5995) already
implements the contract family, phase-owned context, dispositions, approval,
and authenticated fallback repairs. Those are implemented facts, not proposals
for this continuation. The remaining #5139 decisions are accepted-scope/persona
judgments, typed evidence records, bounded installed-rule currency, and stricter
fallback qualification. No available proof establishes feature completion;
final-head verification and independent test re-review remain pending. The
[qualification record](qualification-5139.md) and
[verification record](verify-5139.md) retain implementation state, observed
results, interrupted runs, and historical evidence defects. No merge, Ready
promotion, or historical-evidence repair is authorized.

The proposed capability extension in `ARCHITECTURE.md` now describes main's
sealed pair comparison, replacing the rejected integer-rank overlay. This
documentation correction retains route configuration, verified identity, typed
unknown/weaker failures, and main's authenticated reduced fallback semantics.

**Inherited decisions retained, not new recovery work:** The reconciliation
planner's `resolveFileContent` calls `parsePlanningContract` for the canonical
Execution contract before an executable reconciliation plan is returned.
Missing, duplicated, or conflicting upstream invalidation declarations throw
`invalid_invalidation_contract`, naming Execution Planning. Validate the entire
desired planning-contract set before executing any write: refusal preserves
all three installed contracts byte for byte, even with valid pending shared
updates. This validation path cannot partially write and therefore needs no
rollback; a future change that moves validation after writes would have to
restore all affected copies before reporting refusal. Existing R9 invalidation
reconciliation tests own this proof. This continuation preserves that preflight.

OpenCode native lifecycle authority remains a deferred host-proof obligation,
not a new #5139 mechanism. Its qualified state must come from independently
retained native dispatch and activation observations bound to the exact running
version and plugin identity. Absent, failed, simulated-only, or explicitly
deferred observations leave guidance advisory; neither a caller-supplied flag
nor profile/status fixtures grant authority. This continuation adds no such
proof artifact and claims no OpenCode enforcement. The R8 generated-guidance
proof must cover derivation from authenticated observations as well as rendered
guidance before that broader obligation can be called complete. Current local
adapter tests remain narrower evidence. YCFFNC owns that deferred native-host
qualification and coordinated activation. No #5857 recovery work is imported.

## Approach

**Decision status:** The context resolver, identity projector, dispositions,
approval boundary, authenticated fallback ladder, data ownership, and existing
rollout described below are retained implemented main decisions. Only the four
explicit continuation decisions below are proposed additions; wording that
describes the broader feature does not reopen already-shipped main behavior.

| Proposed continuation decision | Boundary retained from main |
| --- | --- |
| Judge accepted scope in both directions and inventory applicable persona outcomes | Existing phase contracts, context roles, and user-owned scope authority |
| Retain typed planning and verdict evidence records, including declared reuse limits | Existing authenticated job store, receipt identity, and untrusted-evidence boundary |
| Recompute currency from the bounded installed canonical rules while keeping whole-copy integrity mandatory for use | Exact canonical contract identity and separate authoring/dispatch/admission integrity checks |
| Refuse unknown or weaker configured reviewers before launch on the supported verified-author path | Existing route order, successful stronger feedback, typed exhaustion, and reduced fallback semantics |

### Continuation decisions

**Accepted scope and personas:** Phase rubrics judge both omitted accepted work
and overreach against the existing resolved authorities. Product authoring
records applicable success, refusal, failure, approval, trust, and recovery
outcomes per persona, separating facts, assumptions, and unresolved choices.
The scenario gate judges the outcome-to-scenario mapping in its existing
verdict. No persistent mapping store or structural tag scheme is introduced.

**Typed evidence:** New reviewer planning verdicts carry a versioned
`evidence_records` wrapper, with an empty records array when no new external
evidence is asserted. A plan may embed a `#### PlanEvidenceRecordV1` heading
inside `## Decisions`, immediately followed by a fenced JSON object with
`schema_version: 1`. Each record has eleven nonblank fields: source_identity,
checked_version, source_version, target_version, supported_claim,
license_identifier, attribution_notice, redistribution_limit, security_limit,
privacy_limit, and reuse_limit. Explicit `none_declared` retains a declared
absence without inventing a permission. Every embedded V1 object must validate;
legacy research tables do not have to become V1 objects. This preserves
format-flexible historical decision evidence. New retrieved external evidence
requires a V1 plan record before reuse; historical tables cannot qualify new
reuse. The parser validates declared records, while semantic review must reject
a missing required declaration. Plan records remain plan inputs; reviewer
records remain authenticated verdict outputs and cannot rewrite plan bytes.

**Bounded installed-rule currency:** The trusted package or plugin's
`templates/skills/bdd/DISCOVERY.md`, `PLAN_IMPLEMENTATION.md`, or
`PLAN_EXECUTION.md` supplies the phase's exact marked canonical region: the Product,
Implementation, or Execution rubric start/end markers and its contained shared
clauses. Currency compares those exact bytes, including internal whitespace
and comments, against the packaged generated rubric and the reviewed contract
identity. An edit outside that region leaves currency unchanged. An edit
inside it, even cosmetic, is a canonical-contract change and stales the review.
Independently, authoring, dispatch, and admission require the entire author
copy to match its generated exact-byte digest, so even an outside-region
cosmetic edit blocks use until reconciliation. R5's unchanged canonical phase
contract is essential: its cosmetic installed-copy case does not permit a
changed canonical region. The identity remains V1; no projection-version
backfill is added. Changed canonical bytes invalidate earlier receipts through
their existing contract identity while preserving historical records.

**Pre-launch qualification:** For the existing supported verified Claude-author
path, explicit cross-agent Claude/Codex model selectors are compared with the
sealed catalogue before launch. An unknown exact selector, an unqualified
explicit alias, or an observed weaker selector is skipped with its typed
failure and sends no packet. An omitted model (a runtime-default route) and
the unverified OpenCode adapter retain main's launch-and-confirm path; they
cannot earn independent approval without the existing post-launch identity
and capability checks. This continuation does not claim universal pre-egress
qualification. Typed qualification refusals exhaust those candidates without
pretending a process ran, but cannot alone unlock fallback. At least one
independent route must actually be attempted and return a typed failure. If
every selector is refused before launch, the result is blocked with recovery
to pin a qualified selector. Existing authenticated job writes and retry
currency preserve this evidence; no recovery protocol is added. Route order,
retained stronger findings, zero-route
refusal, and main's unknown-author reduced-receipt behavior remain unchanged.

### Retained main reference

The following architecture, context, disposition, and fallback detail describes
the implemented baseline; the four decisions above are the continuation's
review focus. The existing ARCHITECTURE records remain linked design records:
their historical Proposed labels are not new claims that main lacks those
mechanics, and this continuation does not silently promote those records.

**Riskiest assumption:** Safeword can ignore cosmetic and unrelated context edits without also ignoring a decision that changes what the reviewer was required to judge. The cheapest discriminating proof is R4's paired context-identity outline: whitespace/comment and unrelated-inventory edits must retain approval, while a changed Rule, referenced persona, affected surface, principle, scope boundary, or plan decision must stale it.

**Architecture at a glance:** one phase-aware context resolver constructs the complete review dependency set from the ticket and project configuration. One identity projector turns those inputs into a canonical record containing the target-plan identity, exact canonical-contract digest, ticket and review kind, and a semantic digest per load-bearing context role. Product and Implementation Plans use exact target bytes. Execution Plans retain the accepted normalized identity that excludes only ordinary progress in the four trusted Delivery Checklist progress cells; every stable obligation field and every other plan byte remains identity-bearing. The existing review coordinator snapshots that resolved packet and stores the identity with its authenticated receipt; every phase gate asks the same admission service whether the current identity still matches. A separate exact-byte copy-integrity check requires every installed authoring contract and generated reviewer rubric to match the canonical generated bytes at authoring, dispatch, and admission. Product, Implementation, and Execution Planning keep different rubrics and approval meanings, while generated shared clauses keep their lifecycle, scope-authority, and trust language identical.

Retained context and identity invariants are defined in [Semantically Projected
Planning Review Provenance](../../../ARCHITECTURE.md#semantically-projected-planning-review-provenance)
and [Digest-Bound Planning Decisions](../../../ARCHITECTURE.md#digest-bound-planning-decisions-in-the-shared-review-ledger).
The continuation preserves main's closed phase-owned role set, exact Product
and Implementation target identity, normalized Execution progress identity,
user-owned scope and dispositions, and direct Execution dimensions,
architecture, and triggered data-guidance inputs. No resolver, disposition,
approval, or transaction repair is part of this increment.

### Proof plan

Deferred native-host proof: YCFFNC owns the accepted OpenCode R6 gate rows,
R8 independently-passed guidance rows, and R9 installed-gate rows. Adapter
fixtures do not prove native dispatch and activation authority. These rows
remain deferred and unverified here; no scenario completion, historical skip
rewrite, or enforced-authority claim is made.

| Behavior | Owning boundary | Primary proof | Why this scope | Confidence limit / support |
| --- | --- | --- | --- | --- |
| R1: one shared source generates the common clauses and preserves phase-only clauses | real Safeword reconciliation from packaged source through installed copies | integration | proves the authoring source, generator, schema, and reconciliation cooperate | generation tests cannot judge prose quality; the semantic phase reviewers cover that |
| R2-R3: every required current input resolves or dispatch fails closed | real review-packet preparation with project configuration and filesystem inputs | integration | omissions, defaults, stale overrides, and unreadable files cross modules and I/O | exhaustive malformed-file partitions stay in lower-level table tests |
| R4-R5: target-plan identity, exact canonical contract, and semantic context determine currency while exact generated-copy bytes gate use | identity projector, copy-integrity gate, and real job-status recomputation | integration | proves exact Product/Implementation identity and normalized Execution progress separately from semantic context and installed-copy conformance | SHA-256 detects changes but does not prove the selected semantic fields are complete; mutation partitions support it |
| R6: independent-first routing and the ordered fallback ladder record achieved assurance honestly | real coordinator and phase admission with only reviewer subprocesses mocked, plus real host lifecycle payload fixtures | integration | route selection, typed exhaustion, author/reviewer process identity, reviewer capability, authenticated receipts, and gate admission must cooperate; host fixtures prove exact Claude author identity and fail-closed Codex/Cursor/OpenCode absence | provider authentication itself remains covered by existing live verification, not deterministic CI |
| R6 capability catalogue: every packaged cross-provider ordering is earned and every default independence claim is executable | pinned human-labelled planning-review corpus, Claude/Codex live adapter selector proofs, and release verification | eval + integration + live | repeated semantic review distinguishes model capability; release checks bind admitted results and adapter-specific confirmation to shipped catalogue/default routes | a small corpus can establish only its declared planning-review boundary and live proofs must be refreshed when CLIs, models, rubrics, or defaults change |
| R7: retrieved and reviewed material stays evidence, not instructions | quarantine/parser integration plus judged reviewer evaluation | integration + eval | deterministic code proves no execution or disclosure path; an eval proves semantic instruction resistance | eval confidence is bounded by the pinned judge/rubric and repeated-run agreement |
| R8: ungated hosts receive advisory guidance while gated hosts retain enforcement claims | real CLI reconciliation of host guidance and independently retained native observations | integration plus live host proof | text assertions alone cannot grant host authority; derive qualification from exact-version native dispatch and activation observations | OpenCode native observation derivation remains deferred, outside this continuation; simulated and absent evidence leave it advisory |
| R9: only dependent reviews stale and receipts cannot cross ticket or kind | current identity recomputation through the real phase gate | integration | exercises dependency direction and authenticated receipt admission together | concurrent filesystem mutation is covered by the coordinator snapshot checks, not this matrix |
| R9: invalid canonical upstream declarations preserve all installed contract bytes | reconciliation planner preflight through the CLI | integration | missing/conflicting declarations report invalid_invalidation_contract before any pending update executes | retains main's validation-before-write guarantee; does not promise general filesystem transaction recovery |
| R10-R11: each phase contract asks and approves only its own decision, with bounded findings and fresh-byte repair | fixed-rubric judged review plus real phase-gate corrected-byte/fresh-verdict integration | integration + eval | semantic finding authority needs judgment while receipt currency is deterministic | the eval remains model-dependent; exact-byte integration cannot judge finding quality |
| R12-R15: accepted boundaries include all authorities and reject both omissions and overreach without granting guidance authority | resolved-boundary packet plus fixed-rubric judged review | integration + eval | integration proves complete context; eval proves bidirectional scope judgment | no proof can invent unavailable human authority; unresolved choices remain blocked |
| R14 disposition command: a user decline is explicit, durable, and currency-bearing without widening scope | real pseudo-terminal CLI through ticket write, fresh packet, and phase admission | integration | proves interactive confirmation/refusal/no-input behavior, lock and digest checks, atomic write, accepted-boundary matching, and disposition-to-stale/fresh-review linkage through the public entry point | cooperating-writer proof does not claim protection from an out-of-band writer that ignores the lock |
| R16: Product Plan review inventories persona outcomes and epistemic status, then scenario review proves every applicable outcome has coverage | real Product Plan and scenario-gate review entry points with fixed-rubric judged fixtures | integration + eval | proves the Product gate inventories outcomes and the separate scenario gate maps each applicable inventory item to at least one accepted scenario | semantic mapping remains judge-dependent, so fixed pass/fail fixtures and repeated agreement are required |

Every judged-eval row above uses the same pinned judge identity and exact rubric
bytes, deterministic sampling settings, and a recorded repeated-run agreement
threshold. A result below that threshold is inconclusive rather than passing;
the deterministic integration proof remains separately required. Paired pass/
fail fixtures establish semantic correctness; three repeated calls with a
2-of-3 agreement threshold detect residual provider or harness nondeterminism
despite deterministic requested sampling settings.

Every new public or lifecycle entry point receives a real wiring proof: CLI configuration → context resolution → packet snapshot → coordinator receipt → phase admission, mocking only the external reviewer process. Pure projection edge cases use table-driven unit support, but never substitute for that path.

### Affected surfaces

- **Safeword CLI, Claude Code, OpenAI Codex, Cursor:** the real local phase boundary is covered by the shared wiring proof plus host-specific adapter integration.
- **Claude Code Cloud and Cursor Cloud Agents:** the checked-in project hook path is covered in a fresh-project fixture; external provider execution remains outside deterministic proof.
- **OpenCode CLI/TUI:** local adapter/profile tests are narrower evidence; independent exact-version native dispatch and activation qualification remains deferred, so this continuation claims no enforced authority. **OpenCode Desktop** remains advisory.
- **OpenAI Codex Cloud and Claude Code on the Web:** `skip:` the accepted feature marks them unaffected or advisory; no approval is claimed there.

Retained admission and fallback invariants are defined in [Authenticated
Reduced-Independence Planning Review Fallback](../../../ARCHITECTURE.md#authenticated-reduced-independence-planning-review-fallback)
and the [host-owned coordinator](../../../ARCHITECTURE.md#host-owned-cross-agent-adversarial-review-coordinator).

- A current authenticated receipt remains separate from user scope, human
  design approval, merge, or release authority.
- Under prefer, fallback requires at least one actual independent reviewer
  attempt with a typed failure and exhaustion of every stronger route. If all
  explicit selectors are refused before launch, coding stays blocked with
  qualified-selector recovery; a skipped route is never an actual attempt.
- A successful different-agent review with unknown author capability retains
  main's reduced classification. It is not independent; require still blocks.
- Same-agent headless, fresh-context, and self-review tiers retain their order,
  fixed packet, authenticated receipts, and source-currency checks.
- Canonical integrity, configured policy, user route lists, and durable history
  remain fail closed. No rollback or concurrency recovery is added.

Rollout and rollback cover only the four continuation additions and their
generated carriers. Reverting them preserves main's implemented contract,
context, disposition, approval, and fallback repairs. Records remain intact;
an older reader that cannot authenticate or parse a new result must refuse
admission rather than infer compatibility. No feature flag or service is added.

Measurement applicability: skip: this child's accepted contribution carries no
quantitative product promise. The capability corpus is an internal release gate,
not a promised user outcome; its threshold, scoring validity safeguards, and
change authority are decided in Supporting decision detail — capability
catalogue qualification below. The parent Product Plan's
focused 30–60 minute reviewability target and receipt judgment are owned by
sibling G1C9PP R15 under TBU1.R17.

### Persona consequences

The 2026-10-21 #5139 continuation preserves current main (#5995)'s resolved
context partition and sealed empirical capability comparison. It introduces no
integer-rank overlay or additional Execution context authority. The original rank-overlay proposal is rejected for this continuation in favor of main's shipped
implementation; historical failures and deferred host proofs remain unchanged.

| Persona | Consequential needs | Design consequence | Confidence limit |
| --- | --- | --- | --- |
| Technical Builder | Inspect what was reviewed, understand why a receipt is current or stale, retain user authority over scope and optional strengthening, and route design acceptance through the configured human gate when enabled. | Typed identity exposes the target identity, exact canonical contract, dependency role, reviewer route, and bounded authority; typed failures name the reconciliation action. Reviewer findings cannot expand scope, and review approval remains distinct from configured human design approval. An unqualified reviewer returns `reviewer_capability_unknown` with one action: pin a qualified exact selector or update Safeword. An unknown author returns `author_capability_unknown` with one action: use a host with verified author metadata or change `require` to `prefer` for honest reduced fallback. | Deterministic integration proves identity, gate result, and preserved authority, not whether every explanation is optimally phrased for a particular developer. |
| Non-Technical Builder | Trust that the agent cannot reuse stale approval, understand a refusal in plain language, and receive one concrete recovery action. Approval authority is not applicable merely because this persona is non-technical; the same user-owned scope and configured design-approval boundaries apply. | Phase admission fails closed on missing, stale, or unauthenticated evidence and carries a typed recovery value through the shared result contract. K3EBHB R7 and R10 own the final installed plain-language wording and its acceptance proof. | This ticket proves the typed reason, recovery value, and lack of invented authority, but cannot claim the NTB wording is understandable until K3EBHB's installed-surface scenarios pass. |
| Safeword Maintainer | Reconcile generated copies, identify stale qualification, and preserve failed and deferred evidence when the planning contract changes. | Keep whole-copy integrity separate from bounded currency, derive qualification from sealed current observations, and retain historical collections separately. Unknown qualification refuses inference before the supported fallback path; it never authorizes a waiver or rewrites history. | Installed currency and refusal tests prove mechanics; fresh bounded model observations qualify only their exact corpus and selectors. Neither proves the deferred live-host privacy/retrieval cases or supplies missing historical RED. |

## Decisions

### Implementation Inspiration — review identity

<!-- prettier-ignore -->
| Reference | Checked on | Source version | Target version | Evidence of fit | Principle to borrow | Mismatch / license / security boundary |
| --- | --- | --- | --- | --- | --- | --- |
| [RFC 8785](https://www.rfc-editor.org/rfc/rfc8785.html) | 2026-09-20 | June 2020 | Bun 1.3.14 / ECMAScript JSON | Defines deterministic JSON serialization for repeatable hashes | Hash a typed canonical projection, not presentation text | Informational RFC under IETF legal terms; concept only, no code copied; JCS does not decide which domain fields are relevant |
| [Bazel remote caching](https://bazel.build/remote/caching) | 2026-09-20 | current documentation | Safeword review jobs | Reuse is safe only when the action key covers declared inputs; untracked tools create false hits | Make every load-bearing review input an explicit typed dependency | Build-cache semantics are analogous evidence, not reused code; Safeword reviews are judgments, not builds |
| [SLSA provenance 1.2](https://slsa.dev/spec/v1.2/provenance) | 2026-09-20 | v1.2 Approved | Review receipt schema v1 | Provenance identifies the subject and the inputs/process that produced a claim | Bind a verdict to its reviewed subject, context, and actual producer route | Community Specification License 1.0; conceptual use only; Safeword does not claim SLSA conformance |
| [NIST FIPS 180-4](https://csrc.nist.gov/pubs/fips/180-4/upd1/final) | 2026-09-20 | August 2015, revision planned | Node/Bun `sha256` | SHA-256 produces a digest that detects changed message bytes | Retain the existing SHA-256 primitive for plan, contract, and projection identity | Public standard; no source reused; a digest authenticates neither the reviewer nor semantic completeness |

**Decision impact:** changed: review currency uses exact Product/Implementation
target bytes and the accepted normalized Execution identity plus the exact
canonical-contract bytes and semantic context projections; installed contract copies remain
subject to a separate exact-byte integrity gate.
**Decision informed:** Bind each verdict to the phase's target-plan identity plus
exact canonical contract and semantic projections of every load-bearing context
role, without weakening exact generated-copy conformance.

### Supporting decision detail — capability catalogue qualification

These retained research references were checked on 2026-09-20; they are not
fresh qualification evidence or authority to infer a model comparison.

| Historical reference | Decision consequence | Limit |
| --- | --- | --- |
| [OpenAI model catalogue](https://platform.openai.com/docs/models) | Identify exact selectors; admit comparisons only from the pinned Safeword corpus | Provider documentation cannot establish a packaged capability comparison |
| [Anthropic model lifecycle](https://docs.anthropic.com/en/docs/about-claude/model-deprecations) | Bind records to exact selectors and dated evidence | Replacement guidance is not a cross-provider benchmark |
| [Anthropic success criteria](https://docs.anthropic.com/en/docs/test-and-evaluate/define-success) | Predeclare measurable criteria and fixture-level comparison | Provider guidance neither chooses Safeword's threshold nor proves model capability |

Packaged cross-provider comparisons are generated only from a release-gating pinned
planning-review capability corpus. Each exact model reviews the same Product,
Implementation, and Execution Plan packets under the same rubric, tools, and
deterministic settings for three runs; human-labelled expected verdicts and
required/forbidden findings score each run. A run passes only when its verdict
matches the expected verdict, every required finding is present, and no
forbidden finding is present. A model qualifies only when every
fixture passes in at least two of three runs and at least 90% of all runs pass.
A fixture is baseline-reliable for an author model when that author passes it in
at least two of three runs. A candidate is not worse only when its passing-run
count equals or exceeds the author's count on every baseline-reliable fixture.
A cross-provider ordering is emitted only when the candidate meets all three
conditions; otherwise the pair stays unknown or observed weaker. The versioned capability-
corpus manifest, owned by the Safeword release maintainer and reviewed as code,
declares the 90% floor before any candidate result is run. Changing the floor,
fixtures, rubric, or settings changes its digest and requires rerunning every
model in the comparison; results cannot tune the bar retroactively. Generated
entries retain model ID, corpus/rubric/settings digests, evidence date, results
digest, and directional classification. Current-main evidence was checked
against `9f6ac6fce` and the fresh collections on 2026-10-21; see
`qualification-5139.md`. The dated external references above remain historical
research, not fresh provider verification or capability admission evidence.

### Implementation Inspiration — one resolver and receipt path

<!-- prettier-ignore -->
| Reference | Checked on | Source version | Target version | Evidence of fit | Principle to borrow | Mismatch / license / security boundary |
| --- | --- | --- | --- | --- | --- | --- |
| [Bazel remote caching](https://bazel.build/remote/caching) | 2026-09-20 | current documentation | Safeword review coordinator | Declared inputs are assembled before reuse is decided | Resolve dependencies once and feed both execution and currency checks from that result | Analogy only; no Bazel dependency or code |
| [Host-owned cross-agent adversarial review coordinator](../../../ARCHITECTURE.md#host-owned-cross-agent-adversarial-review-coordinator) | 2026-09-20 | accepted 2026-08-02 | current repository | The existing coordinator already owns packet integrity, routes, typed failures, and provenance | Extend the established authority boundary instead of adding another review service | Repository-owned decision; no external licensing boundary |

**Decision impact:** retained: the existing coordinator, job store, review ledger, and phase admission stay authoritative; a shared resolver/projector is added beneath them.
**Decision informed:** Extend the existing coordinator and review ledger instead of creating a second planning-review subsystem.

### Implementation Inspiration — generated contract source

<!-- prettier-ignore -->
| Reference | Checked on | Source version | Target version | Evidence of fit | Principle to borrow | Mismatch / license / security boundary |
| --- | --- | --- | --- | --- | --- | --- |
| [RFC 8785](https://www.rfc-editor.org/rfc/rfc8785.html) | 2026-09-20 | June 2020 | generated planning contracts | Repeatable identity requires one invariant representation | Generate marked shared bytes from one canonical source and hash those exact bytes | The RFC covers JSON rather than Markdown generation; concept only, no source copied |
| [Schema as Single Source of Truth](../../../AGENTS.md) | 2026-09-20 | current repository | Safeword template schema | Managed assets are declared once and reconciled rather than copied ad hoc | Register one source and every generated mirror in the existing schema/parity system | Repository-owned guidance; generated files remain non-authoritative |

**Decision impact:** changed: lifecycle, scope-authority, trust, and contract-shape clauses become one generated marked block; phase-specific judgment remains in its owning contract.
**Decision informed:** Author shared planning clauses once and generate exact marked copies while keeping phase-only judgment separate.

### Recorded Decisions

| Decision | Choice | Alternatives considered | Rejected because |
| --- | --- | --- | --- |
| Proposed: judge persona outcomes and accepted scope in the existing phase verdicts. | Keep the mapping as judged review evidence and judge omissions as well as overreach. | A persistent mapping store; structural tags alone; reviewing only added scope. | Another store creates new authority and migration; tags cannot establish semantic coverage; one-sided review misses accepted work. Existing phase-gate dispatch and paired semantic fixtures are the proof boundary. |
| Proposed: keep typed plan evidence separate from verdict evidence. | Embed optional V1 plan records in Decisions and require the V1 wrapper on new planning verdicts, using the same eleven limit fields. | One shared evidence store; a mandatory linked artifact; converting every legacy research table. | A shared store blurs author/reviewer authority; a linked artifact adds identity and lifecycle machinery; mandatory conversion breaks format-flexible historical evidence. Parser and authenticated-output integrations exercise the selected boundary. |
| Proposed: read bounded installed canonical rules for currency and keep exact whole-copy integrity for use. | Hash the exact marked region of the installed packaged author file, compare it with the generated rubric, and retain the existing exact canonical identity. | Trust only compiled rubric bytes; hash the whole installed file for currency; normalize canonical whitespace/comments. | Compiled-only currency misses changed installed rules; whole-file currency stales on unrelated copy edits; canonical normalization violates the accepted exact-contract invariant. Paired inside/outside-marker mutations plus independent dispatch refusal distinguish these choices. |
| Proposed: refuse unqualified explicit selectors before launch on the supported verified-author path. | Classify explicit Claude/Codex selectors before egress, retain post-launch confirmation, and record typed skipped exhaustion. | Launch every explicit selector before classification; reject all runtime-default and unverified-host routes before launch; discard retained stronger feedback. | Launching a known refusal exposes a packet unnecessarily; universal preflight changes main's compatibility and host boundaries; discarding stronger feedback weakens the existing ladder. Route subprocess logs and exact typed refusal assertions prove the chosen boundary. |
| Bind each verdict to its phase's target-plan identity plus exact canonical-contract bytes and semantic context projections, while gating generated copies by exact bytes separately. | Use exact Product/Implementation target bytes and the accepted normalized Execution identity that excludes only ordinary checklist progress; use a versioned typed context projection and an exact canonical-copy digest for authoring, dispatch, and admission conformance; reject unknown required shapes. | Hash every packet byte into review currency; normalize stable Execution Plan fields; persist a general Merkle dependency graph. | Whole-packet hashing would rereview already-approved work after each checklist tick. Normalizing stable obligations could hide design changes. A general graph adds storage, migration, and traversal machinery without improving this fixed three-phase dependency model. |
| Extend the existing coordinator and review ledger instead of creating a second planning-review subsystem. | One resolver feeds packet construction, job fingerprinting, status, stamps, and phase admission. | Validate only in hooks; add a new planning receipt store. | Hook-only checks drift by host. A second store would split authority and duplicate integrity, concurrency, and fallback behavior already present. |
| Author shared planning clauses once and generate exact marked copies while keeping phase-only judgment separate. | One canonical shared-clause source generates Product, Implementation, and Execution contract mirrors; each phase owns its distinct rubric. | Duplicate prose with parity tests; collapse all phases into one rubric. | Duplicate prose remains two authorities even if tested. One rubric would erase the different behavior/design/delivery approval meanings. |
| Treat semantic projection as a closed domain model, not generic Markdown normalization. | Retain exact canonical-contract bytes and parse role-specific context sections into typed values; sort only unordered sets and preserve meaningful order. | Strip comments and whitespace from every file generically. | Generic normalization can erase meaningful Gherkin/doc structure or preserve unrelated inventory, creating false-current or false-stale receipts. |
| Record a user-declined optional strengthening in ticket context. | Add a versioned `review_dispositions` ticket field written from an authenticated nonblocking finding after explicit user direction; include only matching-review-kind dispositions in that phase's semantic ticket projection so the unchanged plan receives fresh same-kind review without staling unrelated phase receipts. | Append a new review-ledger event; create a separate disposition store; project every disposition into every review kind; keep the decline only in session/reviewer output. | The ledger would gain authority beyond phase-admission claims; another store adds integrity and concurrency machinery; whole-field projection creates unrelated rereviews; ephemeral output cannot preserve the accepted decline across sessions. |
| Classify reviewer capability from sealed empirical pair comparisons and fail closed when comparison is unavailable. | Compare verified exact author/reviewer model identifiers through the predeclared eval-backed packaged pair catalogue; require an observed not-weaker comparison. | Infer capability from vendor/agent identity; treat unknown models as equivalent; require users to configure every comparison; assign undocumented maintainer integers; use aggregate score alone. | Agent identity does not establish model strength; permissive unknowns overstate assurance; configuration-only ranking breaks the fire-and-forget default for known supported models; undocumented integers are not auditable; an aggregate-only bar can hide a regression on a planning failure the author reliably catches. |
| Admit authenticated reduced-independence receipts without discarding stronger completed evidence. | Under `prefer`, admit a successful different-agent, separate-process review immediately as `reduced` when author capability is unknown; only route failures descend through same-agent fallback after every stronger configured route is exhausted. Seal the actual reviewer, route, reason, and tier in the existing job store; no reduced receipt is labeled cross-agent. | Discard successful different-agent evidence and force fallback; preserve non-stamping host fallback; call fallback independent; let hosts write ledger stamps directly. | Discarding a stronger completed review wastes evidence and work; non-stamping fallback cannot satisfy accepted R6 recovery; calling it independent fabricates assurance; direct host stamps bypass coordinator authentication and packet identity. |

The recommendation is the typed semantic projection because it is the only candidate that satisfies both sides of R4. Whole-packet hashing is safer than under-invalidation but contradicts the accepted cosmetic-stability behavior; a persisted dependency graph is flexible but moves complexity into schema and migration the ticket does not need. **Premortem:** six months from now a new accepted field is not represented and a stale approval remains current; mitigation is a closed role enum, fail-closed unknown structures, paired retained/invalidating mutation tests, and one resolver used by dispatch and admission.

### Data applicability

Data applicability: review provenance and user-owned review dispositions are durable project-local authority data, so this feature changes their schemas but does not add a store.

- **Purpose:** prove which phase-specific target identity and exactly identified canonical contract and accepted context, ticket, review kind, reviewer route, and independence level produced a verdict, while separately proving installed copies match the canonical generated bytes.
- **Store and model:** retain the ticket file, integrity-protected review job JSON, append-only review ledger, and main's versioned `review_identity` and `review_dispositions`. Add only the versioned `evidence_records` collection to new planning verdicts; stamps continue to cite the coordinator review ID rather than copy identity data.
- **Schema and relationships:** one review identity belongs to one review job and contains one phase-specific target-plan identity, one exact canonical-contract digest, and ordered role/path/semantic-digest dependencies. Each evidence record belongs to the verdict that produced it. Each ticket disposition cites one authenticated review kind and finding fingerprint plus the accepted-boundary digest it was judged against. A stamp references one job by ID and phase scope; generated-copy digests are recomputed conformance inputs, not currency fields.
- **Source of truth:** captured plan and resolved project files are review inputs; the coordinator job record is the source of provenance and reviewer-produced evidence records; the ticket is the source of user-owned decline dispositions; the ledger is the source of phase-admission claims. No host-authored duplicate becomes authority.
- **Ownership and access:** the coordinator writes job identity and evidence records; the stamp helper writes admission claims after authenticating that job; the user is the change authority for ticket dispositions and the typed CLI records one only after explicit user direction against an authenticated nonblocking finding. External reviewers receive bounded snapshots but never write authority files.
- **Identity and integrity:** SHA-256 covers exact Product/Implementation bytes or the trusted normalized Execution identity, plus exact canonical-contract bytes and semantic context projections including only ticket dispositions matching the current review kind. Existing job integrity covers identity, verdict, and evidence records. Evidence records are outputs and do not affect the identity of the review that produced them; if reused later, their semantic projection becomes an input dependency. A separate SHA-256 comparison requires every generated copy to match canonical bytes. Review kind and ticket identity prevent cross-kind and cross-ticket reuse.
- **Cross-system flow:** project sources and prior reusable evidence → resolver/projector → neutral packet → external verdict and evidence records → authenticated job → ledger stamp → phase admission. A user decline flows from an authenticated nonblocking finding → typed ticket disposition command → atomic ticket update → stale matching-kind receipt → fresh same-kind review of the unchanged plan.
- **Lifecycle and retention:** use existing ticket, review-job, and ledger retention. Source changes stale their declared dependents; disposition changes recompute only matching-kind identity and make that receipt non-current. Evidence records remain with their verdict and declare reuse limits before later use. No automatic deletion or compaction is added.
- **Migration and backfill:** skip: the ticket excludes migration policy and adds no backfill. Existing receipts are preserved; they authorize only when the active admission reader can authenticate them and recompute the current required identity.
- **Compliance:** packets retain the existing credential scan, size/containment checks, and prohibition on customer data, secrets, and private context sent for external research. Review dispatch follows the user's configured coordinator policy.
- **Rollback:** reverting the increment leaves records intact. An older reader that cannot authenticate or parse a new result must refuse admission; acceptance of new fields by older readers is not assumed. No rollback path rewrites or deletes ticket or ledger history.

The identity is written in the same integrity-protected job result and under the
same per-job lock as the verdict, using the existing temporary-file atomic
replacement; there is no independently committed identity state. A killed or
partial write therefore yields no readable authenticated terminal job. Status
retry rereads the one job record and either returns that terminal result or the
existing pending/recovery state; it never synthesizes approval. Stamp creation
is a later, idempotent ledger transition under the ledger's lease, fencing, and
atomic-replace rules. A crash after the job becomes terminal but before its stamp
preserves the reviewed job and leaves admission pending; retry may create the
same digest-bound claim. A crash after the atomic ledger replacement leaves the
claim readable. Admission always authenticates the cited job and recomputes the
current identity, so neither boundary can turn an orphaned or stale record into
authority.

Ticket disposition writes use an exclusive `O_CREAT | O_EXCL` sibling lock, an
expected SHA-256 digest of the exact ticket bytes, an adjacent temporary file,
and same-filesystem rename. Under that lock the command rereads `ticket.md` and
rejects a digest mismatch, so cooperating Safeword disposition writers serialize
and any earlier ticket edit returns the current digest for retry. This is not a
universal filesystem compare-and-swap: an out-of-band writer that ignores the
lock can still race after the reread, so the command and its proof make no
stronger claim. A filesystem that cannot provide exclusive creation or an
atomic same-filesystem rename fails closed without changing the ticket. A crash
before rename leaves the authoritative ticket unchanged,
while a crash after rename leaves the complete disposition readable. The
disposition is preserved evidence of the user's boundary decision, not
permission for the reviewer or agent to alter accepted scope.

## Design alignment

| Principle | Consequence | Proof | Conflict |
| --- | --- | --- | --- |
| Optimize for the NTB without constraining the TBU | Every failure carries a typed missing/stale reason and recovery action inspectable by the TBU; K3EBHB R7/R10 owns proof that the final installed wording is understandable to the NTB. | [Typed reason and recovery scenarios](features/keep-plan-reviews-current-and-trustworthy.feature) | explicit-conflict |
| 1. Structure enforces; instructions suggest | Packet preparation and phase admission reject incomplete, stale, or unauthenticated evidence rather than trusting reviewer prose. | [Planning gate scenarios](features/keep-plan-reviews-current-and-trustworthy.feature) | |
| 2. Fire at boundaries, not every turn | Identity is checked at authoring, dispatch, and phase transition boundaries, not on ordinary edits. | [R4/R5 boundary scenarios](features/keep-plan-reviews-current-and-trustworthy.feature) | |
| 3. Add, never replace | Existing coordinator, ledger, host adapters, and project-owned configuration are extended; configured sources remain authoritative. | [R6/R9 coordinator-to-admission scenarios](features/keep-plan-reviews-current-and-trustworthy.feature) | |
| 4. Discover decisions before prescribing work | Product, Implementation, and Execution contracts share decision-discovery boundaries while preserving their distinct outputs and return paths. | [R10 bounded-decision scenarios](features/keep-plan-reviews-current-and-trustworthy.feature) | |
| 6. Correct and safe; then clear; then simple | One closed resolver/projector path replaces per-host context lists; no new dependency or general graph store is introduced. | [R2/R3 context-resolution scenarios](features/keep-plan-reviews-current-and-trustworthy.feature) | |

Architecture applicability: this continuation changes the shared verdict schema,
installed canonical-currency source, and explicit-selector compatibility. Its
durable proposed extensions are recorded in [Semantically Projected Planning
Review Provenance](../../../ARCHITECTURE.md#semantically-projected-planning-review-provenance)
and [Authenticated Reduced-Independence Planning Review Fallback](../../../ARCHITECTURE.md#authenticated-reduced-independence-planning-review-fallback).
Main's separate planning gates, conformance admission, host-owned coordinator,
and digest-bound ledger remain binding. Approving this plan accepts only its
four continuation decisions; it does not promote the historical records as a
whole. Safeword maintainers own separate reconciliation of their historical
Proposed labels.

## Known deviations

The scenario-definition correction below is resolved by the restored R2 row
and its current approved scenario review. The retained fallback
record linked above supersedes the older coordinator record's clauses that
called every same-agent result `degraded`, prohibited host-owned fallback
receipts from creating a stamp, and allowed host tiers to read live worktree
paths without revalidating source integrity. It also narrows two older policy
behaviors at planning gates: `off` no longer satisfies a required phase review,
and `require` no longer treats a different process as independent when the
author model cannot be verified. Every tier instead reviews the same immutable
coordinator packet through a tier-bound continuation, and every independence
claim includes verified capability rather than agent/process separation alone. The
Implementation Plan is the only feature-local design
plan; applicable design, data, and testing guidance is incorporated here rather
than emitted as another design artifact. **Optimize for the NTB without constraining the TBU** has
one explicit, bounded conflict: this ticket proves typed recovery mechanics but
defers final NTB wording and comprehension proof to K3EBHB so it does not
duplicate that sibling's accepted scope. R9's broad phrase “the accepted
Implementation Plan changes” is intentionally interpreted as a semantic change
so it remains consistent with R4's explicit cosmetic-stability behavior; exact
whitespace/comment changes still stale the Implementation Plan's own receipt.
R4 and R9's Execution Plan byte-change partitions exclude the four ordinary
Delivery Checklist progress cells already normalized by the accepted Execution
Plan review contract. Editing Disposition, Evidence class, Revision, or final
evidence on an `open` or `complete` contributor row retains that review; every
stable checklist field and every other Execution Plan byte still stales it.
R14's accepted-expansion record is intentionally the authoritative ticket or
parent scope edit, not a parallel `accepted` disposition, so user authority is
visible before the plan changes.
YCFFNC owns coordinated activation for tickets already past `intake`, including
preserving TBU1.R15's rule that they are not retroactively blocked unless they
return to planning; this ticket defines the new Product Plan boundary but does
not migrate in-flight tickets.
The current-main continuation preserves direct Execution context requirements
from `9f6ac6fce:packages/cli/templates/skills/bdd/PLAN_EXECUTION.md`: dimensions,
configured architecture records and triggered data guidance remain direct
inputs alongside the accepted Implementation Plan. The earlier narrower design
description was incorrect for this baseline. The R2 row now retains main's
original inventory and has a current approved scenario review. No production
context repair or expansion is part of this continuation. Both plan reviews
must be current against these corrected inputs before coding resumes; the
backward non-review exit did not authorize coding.
The child R2 partition also narrows inherited TBU4.R4 for Product Plan review:
accepted scenarios and downstream design guidance are not yet available at the
Product Plan exit, so that phase directly reviews the ticket/project/parent/
milestone boundary, Rules and epistemic state, principles, personas, affected
surfaces, exact Product Plan, and canonical Product contract. Scenario coverage
is enforced later by the separate scenario gate described above. This accepted
child partition prevents a predecessor phase from requiring its own downstream
output while preserving the parent's completeness intent.

## Doc impact

- **README.md:** explain that planning reviews bind their phase-specific target identity and only semantically relevant context, including the narrow Execution checklist-progress exclusion, and distinguish review approval from human/merge authority.
- **packages/website/src/content/docs:** update the BDD planning flow, recovery guidance, supported/advisory host matrix, and the three bounded approval meanings.
- Generated skill/command copies are implementation outputs, not a substitute for these customer-facing docs.

## Assessment triggers

- A false-current approval reveals a load-bearing field missing from a projection.
- Cosmetic or unrelated project-knowledge edits cause repeated unnecessary review.
- A fourth planning artifact or configurable contract introduces a dependency direction the closed role model cannot express.
- A host gains or loses a reliable lifecycle boundary, changing enforced versus advisory status.
- SHA-256 is withdrawn for this use or the runtime's deterministic serialization behavior no longer matches the recorded contract.
- Review-job or ledger retention creates measurable project-size or lookup cost.
- A configured independent route reports an unqualified model identifier;
  maintainers must refresh the sealed packaged comparison or the route owner
  must select an already qualified exact model before that route can earn
  cross-agent independence.
- An out-of-band ticket writer can race a disposition update without honoring
  its sibling lock; reassess whether ticket mutations need one shared writer or
dispositions need a separate append-only authority surface.
- An authoring host gains trusted exact-model metadata or a reviewer adapter
  gains a stronger model-confirmation contract; reassess the host matrix and
  rerun release proof before upgrading its independence classification.
