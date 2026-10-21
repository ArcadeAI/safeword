---
id: 2ENRH5
slug: consistent-host-contract
type: feature
phase: implement
phase_anchors:
  - define-behavior: .project/tickets/2ENRH5-consistent-host-contract/spec.md
  - scenario-gate: features/consistent-host-contract.feature
  - plan-implementation: features/consistent-host-contract.feature
  - plan-execution: .project/tickets/2ENRH5-consistent-host-contract/impl-plan.md
  - implement: .project/tickets/2ENRH5-consistent-host-contract/execution-plan.md
status: in_progress
scope:
  - define small content-delivery and enforcement contracts by extending the existing integration registry canonical schema and shared policy owners
  - account automatically for Claude Code, Codex, Cursor, OpenCode V1 compatibility, and OpenCode V2 delivery
  - migrate the complete shipped host-facing workflow catalogue and lifecycle policy inventory into the contract with explicit host dispositions
  - register canonical bundled skills guides and runtime directly where supported and derive host wrappers or copies only where required by the host
  - deliver native Cursor and OpenCode V2 plugins and reuse portable Agent Plugins components where supported
  - normalize host events and apply shared decisions through adapters that contain host mechanics rather than independent workflow policy
  - distinguish verified active protection, permitted alternatives, unmet guarantees, and invalidated evidence with actionable recovery
  - preserve user-owned project knowledge, settings, existing host selection, and supported legacy installations through install upgrade repair and uninstall
  - require architecture boundary checks, deterministic generated-output checks, shared conformance, and installed-host evidence before completion
out_of_scope:
  - changing upstream host APIs or guaranteeing unsupported interception or completion boundaries
  - rewriting unrelated workflow rules or language tooling presets
  - forcing an MCP server a universal plugin runtime or a single executable plugin format across hosts
  - automatically enrolling unselected hosts, bypassing trust, or replacing user-owned configuration
  - new cloud or unverified desktop guarantees inferred from another runtime
  - public release, publishing, merging, or destructive cleanup without separate authorization
done_when:
  - every shipped host-facing skill guide workflow entrypoint and lifecycle policy has one authoritative source and a disposition for every supported host
  - an existing shared policy change and an existing shared skill change each reach every applicable host without equivalent per-host edits or a supplied host checklist
  - required checks reject stale generated output missing dispositions policy bypasses and invalid protection claims with negative controls
  - installed native delivery proves catalogue discovery and the precise enforcement or continuation guarantees claimed for each supported host version
  - lifecycle evidence proves preservation idempotency recovery and absence of competing Safeword authorities without probing or mutating unselected hosts
  - before and after evidence shows removed independent authoring or policy paths for every consolidated duplication while retaining necessary host mechanics
  - the demo and all accepted Rule scenarios have recorded evidence and no missing required host proof is treated as passing
product_plan_contract: v1
created: 2026-10-20T03:40:27.990Z
last_modified: 2026-10-20T04:25:32.000Z
---

# Reduce duplicated maintenance and agent drift for Safeword maintainers

**Goal:** Minimize duplicated maintenance and drift across Claude Code, Codex, Cursor, and OpenCode by authoring shared behavior once, deriving host delivery, and enforcing the boundary between shared policy and host mechanics.

**See:** [spec.md](./spec.md) for personas, jobs-to-be-done, and outcomes.

## Proposed Engineering Scope

The user accepted Shape and Killer Demo with “go” and accepted the refined
engineering scope with “do it” on 2026-10-19 PDT. The frontmatter scope and
boundaries below are accepted. The requested fresh-reader check runs before
the transition from intake to scenario definition.

### Research-derived design constraints

The scope preserves the accepted outcomes and all three milestones. The
precedents below narrow implementation choices rather than add a new platform.

1. **Two small boundaries:** Content delivery describes shared workflows and
   host discovery, invocation, and resource paths. Enforcement describes shared
   decisions, host input translation, and the actual guarantee applied. Both
   reuse the existing registry and policy owners. Content conversion cannot
   establish enforcement equivalence.
2. **Use the bundled source directly:** Prefer native registration or discovery
   of packaged skills, guides, and helpers. Generate a host-specific copy only
   when a documented host requirement or installed-host proof requires it.
   Reproducibility checks apply to those required outputs; the architecture
   does not require generating copies that a host can already load directly.
3. **One active delivery owner:** Each host component has one active source
   during normal operation. A compatibility bridge fills a real host gap rather
   than registering a second copy of a natively supplied component. Migration
   must detect competing registration and legacy cleanup of current assets.
4. **Measure removed maintenance:** Before consolidation, identify independent
   edits or policy implementations for the affected behavior. Afterward, show
   which disappeared, which outputs are derived, and which host translations
   remain necessary. A newly added interface with unchanged parallel policy
   does not satisfy the maintenance outcome. Do not invent percentage savings
   or equate fewer files with less duplicated authorship.
5. **Separate proofs:** Catalogue registration, resources and helper reachability
   prove delivery. Target-host tests prove denial and continuation guarantees.
   Shared tests prove policy decisions. A test double accepting our interface
   cannot replace proof that the host accepts the adapter's output.
6. **Test actual drift boundaries:** Scenario discovery includes a changed host
   registration schema, rejected registration, duplicate native/legacy
   activation, stale derived output, and cleanup collisions with current assets.
   Required components that fail registration invalidate the affected claim;
   unrelated optional components may remain usable only with truthful status.

Term: adapter = the small integration that translates between shared Safeword
behavior and a particular agent's supported mechanisms.

### Contract inventory

| Contracted family | Authoritative starting inventory | Required coverage |
| --- | --- | --- |
| Workflow guidance | All 24 current `packages/cli/templates/skills/*/SKILL.md` entries and their references; handbook and shipped guides | One authored body per shared workflow, with derived host invocation and resource paths |
| Native entrypoints | Existing command wrapper inventories, native skill catalogues, and declared helper-agent roles | No independently maintained workflow bodies; unsupported custom-agent mechanisms are explicit |
| Lifecycle behavior | Every configured handler in `SETTINGS_HOOKS`, `CURSOR_HOOKS`, Codex plugin hooks, and OpenCode profile dispatch | Classify each as shared policy, necessary host mechanics, or an explicit host limitation; no silently omitted handler |
| Shared decisions | Existing quality, config protection, phase/scenario/plan/completion checks, dependency readiness, review, lint/nudges, context and retrospective integration | Reuse current decision owners; consolidate duplicate host policy without altering unrelated rule meaning |
| Delivery and ownership | Schema, host catalogues, plugin identities, generated inventories, profile installers, and legacy ownership classifiers | Derive framework delivery; preserve user-owned state and existing host selection |
| Proof and status | Lifecycle registry, host activation/trust observations, conformance evidence, status/doctor, and required repository checks | Capability declarations cannot substitute for installed/runtime proof; invalidated evidence cannot retain healthy claims |

The 24-skill count is an intake snapshot, not a second maintained list. Contract
coverage must discover the actual canonical inventory, so new skills or handlers
cannot disappear from coverage because a hand-maintained table was not updated.
Every shipped host-facing behavior is accounted for. Internal helpers stay
behind their current shared owners unless extraction is necessary to remove
host policy duplication; moving every helper into a new framework is not a goal.

### Host evidence boundaries

Exact required conformance targets for this work are Claude Code 2.1.170,
Codex 0.160.0, Cursor IDE 3.24.18 native delivery, Cursor IDE 3.8.23
project-hook compatibility, OpenCode V1 1.18.23, and OpenCode V2 2.0.32.
These are selected engineering test targets, not claims that new native delivery
already works. They come from the repository's existing minimum/pinned/observed
baselines and the researched V2 release. Record exact package and host identity
with each result. Passing only on a different version cannot satisfy this set;
changing a target requires a recorded compatibility decision and rerunning the
affected proof. The supported product set is four agents, with seven distinct
version lanes. OpenCode CLI and TUI need separately identified execution evidence;
Desktop remains advisory and is not covered by either lane's enforcement claim.

- Claude Code: preserve the existing minimum-version policy (2.1.170) and native
  plugin lifecycle. Evidence records the exact binary and package being tested;
  a minimum-version check alone proves no new runtime guarantee.
- Codex: start conformance from the repository-pinned 0.160.0. Hook trust remains
  required and is tested separately from installed package identity.
- Cursor: retain the existing 3.8.23 observed project-hook behavior as regression
  evidence, and prove native plugin discovery and dispatch in an exact recorded
  IDE version. The old observation does not establish new plugin conformance.
  After the user upgraded Cursor on 2026-10-20, the native-plugin target is
  3.24.18; it must earn its own proof. The 3.8.23 project-hook regression remains
  separate. This is an explicit target update, not failed-run substitution.
  User selected CLI-first testing on 2026-10-20: add exact Cursor CLI
  2026.09.28-64d2043 as a separate lane using the same generated core/extension.
  This additive compatibility decision retains every IDE proof obligation;
  CLI results do not establish IDE activation, enrollment, trust or continuation.
  Unavailable or failed target execution blocks the plugin claim rather than
  asking the user to select a version or silently using a different target.
- OpenCode: retain the pinned 1.18.23 compatibility lane and add native V2 package
  conformance starting at 2.0.32. The lanes must not substitute evidence for one
  another. Desktop remains outside new enforced guarantees until separately
  proven; local CLI/TUI claims are version- and surface-specific.
- Agent Plugins 1.0: prove portable skill/resource loading in Codex and Cursor.
  Hook, agent-role, and continuation claims are proved through host extensions,
  not inferred from portable package validity. Claude and OpenCode keep native
  adapters rather than being described as standard-format loaders.

Baseline changes require recorded engineering evidence and an explicit
compatibility decision; they must not silently broaden claims or drop existing
users. Routine changes do not require a user-selected host matrix.

### Required proof and implementation boundaries

- Shared-policy and shared-content propagation are separate proofs. Each changes
  the existing authoritative definition and exercises every applicable adapter.
- Negative controls deliberately introduce stale output, omitted coverage,
  forbidden dependencies or bypass routing, and invalidated protection evidence.
  Checks must fail for the intended reason and pass after repair.
- Installed packages prove catalogue/resource/helper reachability and the actual
  promised action-denial, ticket-transition, or conversation-continuation
  boundary. Positive controls prove permitted work can proceed. Missing hooks,
  trust, or host access cannot be mislabeled as successful conformance.
- Upgrade, repair, and uninstall include existing mixed-host projects, modified
  user configuration, idempotent reruns, and interrupted migration recovery.
  Removal of old assets requires proven Safeword ownership and usable replacement;
  uncertain ownership produces bounded recovery rather than deleting user work.
- Required CI checks enforce the new shared-policy boundary and generated
  consistency. They do not claim to prove arbitrary semantic equivalence from
  import analysis; behavioral suites and independent review cover that limit.
- Implementation design, exact event schemas, transport details, and reviewable
  change sequencing belong in the implementation plan after scenarios pass
  review. The contract must preserve existing public CLI semantics unless a
  migration is explicitly justified and covered by scenarios.

## Fresh-reader executability result

**Verdict:** Sufficient for scenario definition and implementation planning.
One reader examined only this ticket, its spec, and an isolated repository at
`f48275b5e616010f3ce76bf5baf7329603f9ac57`, without conversation history. It
found no missing product or compatibility decision that prevents planning.
This is advisory planning evidence, not host conformance or scenario approval.

The reader reconstructed inventory, shared-policy adoption, native packaging,
migration, status/evidence, and release-proof sequencing. It identified one
coverage detail already within the accepted scope: inventory must include
session-end, asynchronous, and shell handlers, not just the five events in the
current lifecycle registry. The later formal review found a conflict between
that advisory readiness assessment and the spec's exact-version intake gate.
The exact target table above resolves it before advancement. Event schemas and
per-behavior mechanisms remain engineering-owned. Installed-host access and proof
must be established before implementation can claim completion. No accepted
product outcome was weakened to resolve the gap.

## External precedent assessment

Checked 2026-10-19 PDT. Earlier intake checked host APIs and local code, but did
not compare existing cross-agent implementations. This targeted source review
does not establish comparative reliability or measured maintenance savings.
The projects were not installed or run.

- **Superpowers:** Its OpenCode adapter registers one bundled skills directory
  through V1 and V2 mechanisms. Registration tests check exact payload fields
  and rejected registration. Borrow shared content and narrow bootstrap/tool
  mappings; do not infer hard enforcement from workflow guidance.
  [Adapter](https://github.com/obra/superpowers/blob/bb92a77741419a4ab5f06e711a283343f1ada0c3/.opencode/plugins/superpowers.js),
  [tests](https://github.com/obra/superpowers/blob/bb92a77741419a4ab5f06e711a283343f1ada0c3/tests/opencode/test-skill-registration.mjs).
- **Compound Engineering:** Its OpenCode plugin derives skill and command
  registrations from bundled skills. Its Codex converter avoids duplicating
  skills already owned by native delivery, and tests reject collisions between
  current skills and legacy cleanup. Borrow one active delivery owner per asset
  and convert only genuine host gaps. Its dual-shape V1 entrypoint targets
  1.18.29+, so this is not proof for Safeword's 1.18.23 baseline.
  [Plugin](https://github.com/EveryInc/compound-engineering-plugin/blob/2e41b4490a37f53db0beb6d4904618da9af2f559/.opencode/plugins/compound-engineering.js),
  [converter](https://github.com/EveryInc/compound-engineering-plugin/blob/2e41b4490a37f53db0beb6d4904618da9af2f559/src/converters/claude-to-codex.ts),
  [cleanup test](https://github.com/EveryInc/compound-engineering-plugin/blob/2e41b4490a37f53db0beb6d4904618da9af2f559/tests/legacy-registry-invariants.test.ts).
- **OpenSpec:** Tool-agnostic command content is formatted by small per-tool
  path/frontmatter adapters. Borrow that separation for delivery; file-format
  conversion alone does not prove runtime enforcement or satisfy plugin delivery.
  [Types](https://github.com/Fission-AI/OpenSpec/blob/c794978f4f8845ce59693373c9dd882ee776588c/src/core/command-generation/types.ts),
  [adapter](https://github.com/Fission-AI/OpenSpec/blob/c794978f4f8845ce59693373c9dd882ee776588c/src/core/command-generation/adapters/cursor.ts).

**Design implications:** Prefer directly registering bundled assets where the
host supports it. Generate copies only where necessary. Separate small delivery
and enforcement contracts rather than building a universal plugin runtime.
Include schema changes, rejected registration, duplicate activation, and cleanup
collisions in scenario discovery. Preserve the accepted outcomes and refined
engineering scope. The main risks are adding abstraction maintenance and
mistaking converted instructions for preserved enforcement. No inspected source
proves Safeword will avoid those risks.

## Work Log

- 2026-10-20T06:20:08.000Z Implementation design approved by
  d2bb1201-0276-4325-b04d-3c21d843261d and Execution Plan approved by
  d8fbcf54-e86c-4ced-bda6-3578faedb95b (codex author, claude reviewer,
  opus, cross-agent). Canonical approve-plan recorded human approval not
  required. Coding authorization initially detected stale scenario context
  after metadata normalization; unchanged scenarios were independently
  approved again by 460df2fc-3fa1-4c45-8218-d33557ca97b7 and stamped.
  Canonical coding authorization now passes. Entered implement; all R/G/R
  rows remain unchecked. Four local PR slices and actual-repository adoption,
  complete acceptance population and shipped-package proofs are retained.
  Exact host binary provisioning is recorded in host-target-preflight.md;
  versions/signatures do not establish native runtime conformance.

- 2026-10-20T05:41:00.000Z Plan reviews
  d0a52098-573f-4f00-9780-e0b546b3f6a5 and
  8badbc0e-3698-4906-a2e7-067d697269a5 (codex author, claude reviewer,
  opus, cross-agent) exposed customer-status evidence and shared-checkout
  migration gaps. The repaired design derives integrity-bound package
  conformance declarations from trusted release runs and combines them with
  current local activation. It retains shared Cursor compatibility hooks and
  resources for teammates/cloud while a profile-local checkout/session epoch
  gates native ownership. Explicit enrollment writers, second-clone regression,
  cache-free legacy regression and single-owner handshake proof are recorded.
  All target guarantees remain unimplemented; no accepted Rule or scope changed.

- 2026-10-20T05:30:59.000Z Implementation-plan review
  dca3ad56-f270-4c12-a064-c428b582cc9d (codex author, claude reviewer,
  opus, cross-agent) requested two agent-owned design repairs: decide native
  registration scope/cross-project cutover, and decide completion-evidence
  stores/writers independently from runtime activation. The proposed repairs
  select workspace-scoped Cursor loading from an immutable cache, location-
  enrolled V2 profile registration with V1 coexistence, project/epoch-bound
  activation, and scoped sealed conformance/owner-inventory records using the
  existing integrity infrastructure. Cross-project and cached-callback proof
  obligations are explicit. Existing executable-resource and single-CLI-lookup
  architecture obligations remain intact. Plan parsing and diff checks pass.
  Coordinator context was normalized to the current Product metadata and YAML
  anchor representation; the already accepted Agent Plugins surface is now in
  the project inventory. No Rule, scenario, outcome or scope changed.
  Independent review of the corrected plan remains pending.

- 2026-10-20T05:15:32.000Z User accepted the reviewed scenarios with "go".
  Review b2e29dae-9653-4078-a349-1b8a81bf1bde approved all 58 definitions
  (91 expanded examples); scenario-gate provenance is stamped with codex author,
  claude reviewer, opus and cross-agent independence. The old 1.1.0 profile
  could not resolve a trusted 1.2.0 receipt reader. With explicit user approval,
  pinned the user's existing Safeword marketplace to this checkout's committed
  development baseline and installed 1.2.0. Its trusted reader now verifies the
  receipt; current prompt/pre/post-tool activation is proved, session-start and
  stop remain unproved. Advanced to plan-implementation without weakening gates.
  No separate disposable build-only kill-risk was identified: documented host
  boundaries and existing code settle API availability; first native installed
  proof remains the load-bearing implementation obligation. Authored a
  parse-valid planned implementation record and proposed durable architecture
  extension. The plan separates design/proof boundaries from later execution
  commands and tasks. Independent implementation-plan review is next.

- 2026-10-20T04:39:02.000Z Scenario review
  bfbfdcc0-8e30-4ad8-8fda-d2e11b67170f (codex author, claude reviewer,
  opus, cross-agent) found the reverse completion-evidence substitution case
  missing. Added the rejection that continuation proof cannot establish
  ticket-transition enforcement. Added positive policy-route and applicable
  automated evidence controls, expanded omitted-component coverage across
  skills/guides/native commands/helper-agent entrypoints, clarified the fallback
  trigger, and put the demo composition in the feature itself. These are
  scope-preserving Rule repairs, not new product decisions. Current revision
  has 58 scenario definitions and 91 expanded examples; parser lint passes.
  All implementation progress remains unchecked; independent review is pending.

- 2026-10-20T04:37:06.000Z Scenario re-review
  0f73f2f8-7667-422b-89a4-847854038861 (codex author, claude reviewer,
  opus, cross-agent) requested lifecycle-operation coverage for unselected hosts
  and discriminating completion-evidence rejection cases. Repaired both:
  selection preservation is an install/upgrade/repair/uninstall outline;
  evidence checks reject different-version substitution, manual-as-automated
  claims, and replacement of failed required target execution. Strengthened
  shared-skill propagation to require the complete runtime set without a host
  list, named single public validation entry points, and made legacy authority
  retirement explicit. Current source and ledger contain 55 definitions and
  85 expanded examples. Parser lint passes; independent re-review is pending.

- 2026-10-20T04:34:49.000Z Scenario gate: definition exit approved by
  fd775435-1e6f-48db-87f5-9be2a39d72d5 and its define-behavior stamp verified.
  Independent scenario review c00b6ab5-6a1a-4d64-aed3-e471fef2528b requested
  one missing partition: new adapter capability must preserve shared policy
  ownership. Added rejection and acceptance examples within the accepted Rule.
  Strengthened installed/native delivery identity, exact versions and runtimes,
  status outcomes, mechanism ranking, selected-host positive control, and
  builder persona wording. Current revision has 52 scenario definitions and
  79 expanded examples; all TDD progress remains unchecked. Parser lint passes.
  The Killer Demo journey combines its single @demo propagation anchor with
  "Coverage includes every supported host without an author checklist",
  "A stale generated host output fails the required check", and
  "An impossible required guarantee produces actionable recovery"; each
  retains its own Rule ownership and proof rather than adding more @demo tags.
  Independent scenario re-review remains pending.

- 2026-10-20T04:32:03.000Z User accepted the scenario set with "go".
  Define-behavior exit reviews d202feae-ff05-46df-8318-c5c9a17e247e and
  f60b9484-954c-41eb-8ae9-ff45a0c2c2f0 (codex author, claude reviewer,
  opus, cross-agent) requested explicit per-host guard proof and unknown or
  unsupported protection states. Repaired both: deny/allow outlines enumerate
  exact host versions and OpenCode CLI/TUI lanes; status rejects unknown and
  unsupported states. Also added positive continuation and consolidation
  evidence controls and named all five host lanes in the propagation demo.
  Current source and ledger contain 50 scenario definitions, 76 expanded
  examples, and nine Rules; all TDD progress remains unchecked. Earlier counts
  describe earlier revisions. Parser lint passes and doctor reports no lineage
  or surface coverage defects; existing host-version warnings remain.
  No production implementation or installed-host execution is claimed.

- 2026-10-20T04:25:32.000Z Define behavior: Formal intake review
  81617178-3048-4842-b4ab-e24a53048d44 approved with no errors (author codex,
  reviewer claude, model opus, independence cross-agent). Recorded the verified
  intake stamp through the current project helper with the installed external
  runtime as receipt witness; the old 1.1.0 packaged helper could not resolve
  this 1.2.0 checkout's receipt route. Advanced to define-behavior. Authored 48
  scenario definitions, 58 expanded examples, across all nine Rules, using
  review-spec Authoring mode. Parser-backed Gherkin lint and source/ledger
  correspondence checks pass. All TDD boxes are unchecked and the feature stays
  @wip. User scenario completeness confirmation and independent scenario review
  are pending. Doctor also reports pre-existing host plugin-version issues;
  these are environment findings, not scenario failures or authority to upgrade
  the user's hosts during definition.

- 2026-10-20T04:24:00.000Z Formal intake review requested changes
  (e840ab15-8e85-4357-bee0-0e7affe55fa4; author codex, reviewer claude,
  model opus, independence cross-agent). Resolved the spec's exact-version gate
  by selecting five exact host test targets, distinguished targets from proof,
  and kept V1/V2 dispositions separate. Added uncertain ownership and Desktop
  evidence boundaries to dimensions. No required guarantee or product scope was
  weakened. The advisory reader result remains recorded with this correction.

- 2026-10-20T04:16:44.508Z Engineering scope accepted: User said “do it” to
  the refined scope. User then explicitly selected the offered fresh-reader
  check. Run one isolated reader with only ticket, spec, and repository; keep
  the phase at intake until its advisory result is recorded and presented.

- 2026-10-20T04:12:13.925Z Scope refinement authorized: User said “do it” to
  incorporating the precedent findings before scope acceptance. Added six design
  constraints: small delivery/enforcement boundaries, direct bundled loading,
  one active delivery owner, before/after maintenance evidence, separate delivery
  and runtime proof, and explicit host-drift and migration failure cases.
  Preserved all accepted jobs, Rules, milestones, and project-ownership limits.
  Engineering scope remains proposed; this authorization did not approve
  implementation or advance the phase. One author review and saved readback
  check cover these refinements; independent scenario review remains later.

- 2026-10-20T03:40:27.990Z Started: Created ticket 2ENRH5
- 2026-10-20T03:42:00.000Z Intake: User authorized starting BDD for shared host
  contracts after discussing capabilities, fallbacks, portable content, and
  enforced contributor boundaries. Drafted Product Bet and four persona jobs.
  Rules, release scope, and phase advancement remain pending.
- 2026-10-20T03:42:00.000Z Evidence: Current lifecycle contract and validation are
  in `packages/cli/src/lifecycle/integrations.ts`. Claude and Codex share a
  blocking stop label; OpenCode declares observation. Cursor implementation and
  newer host capability documentation must be distinguished during adoption.
- 2026-10-20T03:42:00.000Z Correction: `.project/surfaces.md` records OpenCode's
  current profile catalogue and excludes project catalogue reconciliation.
  Earlier chat descriptions of project-local OpenCode delivery were inaccurate.
- 2026-10-20T03:42:00.000Z Sources: Portable components are skills and MCP only:
  https://agent-plugins.org/specification. Host enforcement references:
  https://learn.chatgpt.com/docs/hooks,
  https://cursor.com/docs/hooks,
  https://code.claude.com/docs/en/hooks,
  https://opencode.ai/v2/docs/build/plugins.

- 2026-10-20T03:44:00.000Z User priority: Minimizing duplicated work and drift
  between agents is the primary outcome. Reframed Product Bet, promoted the SWM
  job, and made a single shared edit reaching every applicable host the proposed
  success proof. Generated delivery copies are acceptable; independently
  maintained shared policy is not. Capability truthfulness and runtime proof
  remain supporting requirements. Jobs checkpoint remains in progress.
- 2026-10-20T03:47:00.000Z User priority: The author should not have to think
  about individual agents. Safeword owns adapting shared intent across every
  supported host with minimal duplicated work and drift. Updated the primary
  job, expected outcome, success proof, and demo direction. Coverage is automatic;
  installation remains bounded by existing host selection and authorization.
  Impossible guarantees require a concrete blocker and recovery, not false success.
- 2026-10-20T03:54:07.071Z Jobs checkpoint accepted: User said “go with bdd”
  after prioritizing minimal duplicated work and drift and removing manual agent
  coordination. Drafted nine Rules covering single-source behavior, automatic
  host coverage, required drift/bypass checks, verified capability adaptation,
  active protection evidence, invisible routine handling, actionable limitations,
  derived plugin delivery, and preservation of user-owned work. Rules checkpoint
  is pending; phase remains intake. No production code or scenarios were changed.
- 2026-10-20T03:58:46.529Z Rules checkpoint accepted: User said “do it”.
  Drafted three value-bearing milestones: shared-contract adoption across all
  four existing integrations; native plugin delivery including Cursor and
  OpenCode V2 with preservation and V1 compatibility; and complete drift and
  conformance enforcement. Each milestone carries its own evidence and the
  overall feature includes all three. Drafted the single-change propagation
  demo with stale-output and unavailable-guarantee negative controls. Shape and
  demo checkpoint is pending; engineering scope and scenarios are not accepted.
- 2026-10-20T04:00:12.892Z Shape and demo accepted: User said “go”.
  Drafted engineering scope, exclusions, done criteria, complete host-facing
  inventory boundaries, and version-specific proof obligations. All three
  accepted milestones remain in scope; old OpenCode V1 and Cursor evidence are
  distinguished from new native-plugin proof. Engineering scope checkpoint is
  pending; no implementation or feature scenarios have been started.
