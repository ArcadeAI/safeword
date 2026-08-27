# Test Definitions: Give OpenCode builders full Safeword protection

Feature source: `packages/cli/features/opencode-parity.feature`

test-definitions.md is the R/G/R ledger. Given/When/Then live in the `.feature` source.

Historical evidence note: 63 scenarios reached green behavior without complete
per-step commit evidence in this ledger. On 2026-08-27, Alex explicitly
authorized the evidence waiver documented in `verify.md`. Missing entries are
marked `skip` rather than being assigned invented SHAs. This waives only the
historical commit linkage; all behavior remains covered by the verification
evidence. A GREEN entry of `a0363d051` identifies the exact verified delivery
head under this waiver; it is not represented as the original GREEN commit.

## Rule: opencode-parity.TBU1.R1 — Explicit selection installs the catalogue without changing defaults

### Scenario: Explicit OpenCode selection installs a complete non-empty Safeword catalogue

- [x] RED ae16c239e
- [x] GREEN 58814ff5a
- [x] REFACTOR skip: one derived catalogue inventory feeds schema paths and generated bodies

### Scenario: Generated OpenCode commands bind to their canonical skills

- [x] RED skip: historical step evidence was not captured; see verify.md evidence waiver
- [x] GREEN a0363d051
- [x] REFACTOR skip: historical step evidence was not captured; see verify.md evidence waiver

### Scenario: Generated OpenCode agents bind to their canonical procedures

- [x] RED skip: historical step evidence was not captured; see verify.md evidence waiver
- [x] GREEN a0363d051
- [x] REFACTOR skip: historical step evidence was not captured; see verify.md evidence waiver

### Scenario: OpenCode-only selection installs the shared canonical skills delivery

- [x] RED skip: historical step evidence was not captured; see verify.md evidence waiver
- [x] GREEN a0363d051
- [x] REFACTOR skip: historical step evidence was not captured; see verify.md evidence waiver

### Scenario: OpenCode-only selection excludes Claude-owned surfaces

- [x] RED skip: historical step evidence was not captured; see verify.md evidence waiver
- [x] GREEN a0363d051
- [x] REFACTOR skip: historical step evidence was not captured; see verify.md evidence waiver

### Scenario: OpenCode install leaves project plugin discovery paths non-executable

- [x] RED skip: historical step evidence was not captured; see verify.md evidence waiver
- [x] GREEN a0363d051
- [x] REFACTOR skip: historical step evidence was not captured; see verify.md evidence waiver

### Scenario: Profile installation resolves the documented config root

- [x] RED 4915f963f
- [x] GREEN 342843e73
- [x] REFACTOR skip: profile construction reuses the existing reconciliation transaction and identity schema

### Scenario: USERPROFILE alone is not a Unix config-root fallback

- [x] RED skip: historical step evidence was not captured; see verify.md evidence waiver
- [x] GREEN 2fd55c206
- [x] REFACTOR skip: resolver boundary is already isolated and has no duplication

### Scenario: All profile lifecycle operations share one config-root resolver

- [x] RED skip: historical step evidence was not captured; see verify.md evidence waiver
- [x] GREEN a0363d051
- [x] REFACTOR skip: historical step evidence was not captured; see verify.md evidence waiver

### Scenario: Lifecycle operations fail safely when no config root can be resolved

- [x] RED skip: historical step evidence was not captured; see verify.md evidence waiver
- [x] GREEN a0363d051
- [x] REFACTOR skip: historical step evidence was not captured; see verify.md evidence waiver

### Scenario: Omitted selection does not enroll OpenCode

- [x] RED skip: historical step evidence was not captured; see verify.md evidence waiver
- [x] GREEN a0363d051
- [x] REFACTOR skip: historical step evidence was not captured; see verify.md evidence waiver

### Scenario: Ambient OpenCode evidence does not imply selection

- [x] RED skip: historical step evidence was not captured; see verify.md evidence waiver
- [x] GREEN a0363d051
- [x] REFACTOR skip: historical step evidence was not captured; see verify.md evidence waiver

### Scenario: Omitted status selection neither reports nor probes OpenCode

- [x] RED skip: historical step evidence was not captured; see verify.md evidence waiver
- [x] GREEN a0363d051
- [x] REFACTOR skip: historical step evidence was not captured; see verify.md evidence waiver

### Scenario: Explicit OpenCode selection does not become a persisted default

- [x] RED skip: historical step evidence was not captured; see verify.md evidence waiver
- [x] GREEN a0363d051
- [x] REFACTOR skip: historical step evidence was not captured; see verify.md evidence waiver

### Scenario: Default install leaves prior explicit OpenCode project assets untouched

- [x] RED skip: historical step evidence was not captured; see verify.md evidence waiver
- [x] GREEN a0363d051
- [x] REFACTOR skip: historical step evidence was not captured; see verify.md evidence waiver

### Scenario: OpenCode installation does not restore retired Codex project skills

- [x] RED skip: historical step evidence was not captured; see verify.md evidence waiver
- [x] GREEN a0363d051
- [x] REFACTOR skip: historical step evidence was not captured; see verify.md evidence waiver

### Scenario: OpenCode lifecycle preserves user configuration

- [x] RED skip: historical step evidence was not captured; see verify.md evidence waiver
- [x] GREEN a0363d051
- [x] REFACTOR skip: historical step evidence was not captured; see verify.md evidence waiver

### Scenario: OpenCode install does not create absent user configuration

- [x] RED skip: historical step evidence was not captured; see verify.md evidence waiver
- [x] GREEN a0363d051
- [x] REFACTOR skip: historical step evidence was not captured; see verify.md evidence waiver

### Scenario: Unknown integration selection is rejected

- [x] RED skip: historical step evidence was not captured; see verify.md evidence waiver
- [x] GREEN a0363d051
- [x] REFACTOR skip: historical step evidence was not captured; see verify.md evidence waiver

## Rule: opencode-parity.TBU1.R2 — Covered calls are denied before violation

### Scenario: Covered tool inputs reach the canonical pre-tool guard

- [x] RED 07db8b1fd
- [x] GREEN 4bff60b6e
- [x] REFACTOR skip: generated transport is isolated and the canonical envelope remains shared

### Scenario: Guard failure denies closed

- [x] RED skip: historical step evidence was not captured; see verify.md evidence waiver
- [x] GREEN a0363d051
- [x] REFACTOR skip: historical step evidence was not captured; see verify.md evidence waiver

### Scenario: The profile plugin honors the pinned dispatcher's exit contract

- [x] RED f70367a84
- [x] GREEN 65ad90e4c
- [x] REFACTOR skip: one packaged entry delegates to the existing guard without a second policy implementation

### Scenario: A policy denial exposes only a sanitized reason

- [x] RED 8d8c19f94
- [x] GREEN aef8880dc
- [x] REFACTOR skip: one fixed denial boundary replaced the discarded child-output parser

### Scenario: Covered command input is transported without a shell

- [x] RED skip: historical step evidence was not captured; see verify.md evidence waiver
- [x] GREEN a0363d051
- [x] REFACTOR skip: historical step evidence was not captured; see verify.md evidence waiver

### Scenario: Every multi-target patch path reaches the canonical guard

- [x] RED skip: historical step evidence was not captured; see verify.md evidence waiver
- [x] GREEN a0363d051
- [x] REFACTOR skip: historical step evidence was not captured; see verify.md evidence waiver

### Scenario: The profile plugin is inert outside Safeword projects

- [x] RED skip: historical step evidence was not captured; see verify.md evidence waiver
- [x] GREEN a0363d051
- [x] REFACTOR skip: historical step evidence was not captured; see verify.md evidence waiver

### Scenario: A project-less plugin load creates no activation evidence

- [x] RED skip: historical step evidence was not captured; see verify.md evidence waiver
- [x] GREEN a0363d051
- [x] REFACTOR skip: historical step evidence was not captured; see verify.md evidence waiver

### Scenario: Marker resolution uncertainty self-disables without claiming protection

- [x] RED b0bd80cec
- [x] GREEN 50a5de2b7
- [x] REFACTOR skip: classification, evidence, and dispatch remain separate single-purpose boundaries

### Scenario: A marker-resolution failure invalidates prior activation

- [x] RED 7a5be3f8b
- [x] GREEN 9ac237e1f
- [x] REFACTOR skip: status validation now delegates only the exact profile-error binding check

### Scenario: Successful project classification clears a prior resolution failure

- [x] RED 914475d82
- [x] GREEN 8ca264a69
- [x] REFACTOR skip: recovery composes the existing clear and atomic activation boundaries

### Scenario: A confirmed project with an unavailable dispatcher denies with repair

- [x] RED 2599fb22b
- [x] GREEN 55d6ea80c
- [x] REFACTOR skip: one identity-validation boundary covers every unavailable dispatcher state

### Scenario: Dispatcher unavailability outranks stale activation

- [x] RED ec98628fa
- [x] GREEN 1fd9465c1
- [x] REFACTOR skip: plugin and dispatcher integrity share one ordered identity-binding boundary

### Scenario: The profile identity version governs every marked project

- [x] RED skip: historical step evidence was not captured; see verify.md evidence waiver
- [x] GREEN a0363d051
- [x] REFACTOR skip: historical step evidence was not captured; see verify.md evidence waiver

### Scenario: Malformed covered-tool input denies closed

- [x] RED 15ab1fb79
- [x] GREEN 37a69ab90
- [x] REFACTOR skip: validation stays local to the single canonical-envelope boundary

### Scenario: An uncovered tool is observed without being presented as blocked

- [x] RED 4e54439b0
- [x] GREEN b78b09bae
- [x] REFACTOR skip: uncovered calls reuse the existing bounded activation writer and binding rules

### Scenario: Shell lifecycle identifiers bind guard evidence to the tool call

- [x] RED 914475d82
- [x] GREEN 8ca264a69
- [x] REFACTOR skip: the shared activation writer hashes host lifecycle identifiers at one boundary

### Scenario: Activation evidence stores only hashed lifecycle identity

- [x] RED skip: historical step evidence was not captured; see verify.md evidence waiver
- [x] GREEN a0363d051
- [x] REFACTOR skip: historical step evidence was not captured; see verify.md evidence waiver

### Scenario: Activation evidence records OpenCode version only when known

- [x] RED skip: historical step evidence was not captured; see verify.md evidence waiver
- [x] GREEN a0363d051
- [x] REFACTOR skip: historical step evidence was not captured; see verify.md evidence waiver

### Scenario: A marked project records plugin-load activation

- [x] RED 80e746657
- [x] GREEN 5989bc226
- [x] REFACTOR skip: activation and profile-error evidence already share one atomic writer

### Scenario: OpenCode lifecycle capabilities produce their declared evidence

- [x] RED 2f2e09454
- [x] GREEN cc7dc4709
- [x] REFACTOR skip: one lifecycle recorder normalizes the four observational hooks while pre-tool keeps its blocking path

### Scenario: Activation evidence remains isolated between projects

- [x] RED skip: historical step evidence was not captured; see verify.md evidence waiver
- [x] GREEN a0363d051
- [x] REFACTOR skip: historical step evidence was not captured; see verify.md evidence waiver

### Scenario: Observational lifecycle boundaries never deny

- [x] RED skip: historical step evidence was not captured; see verify.md evidence waiver
- [x] GREEN a0363d051
- [x] REFACTOR skip: historical step evidence was not captured; see verify.md evidence waiver

### Scenario: Concurrent activation writes remain atomic

- [x] RED skip: historical step evidence was not captured; see verify.md evidence waiver
- [x] GREEN a0363d051
- [x] REFACTOR skip: historical step evidence was not captured; see verify.md evidence waiver

### Scenario: Activation evidence write failure does not change the guard decision

- [x] RED skip: historical step evidence was not captured; see verify.md evidence waiver
- [x] GREEN a0363d051
- [x] REFACTOR skip: historical step evidence was not captured; see verify.md evidence waiver

## Rule: opencode-parity.TBU1.R3 — Reconciliation preserves user and shared content

### Scenario: Removing OpenCode preserves user-authored sibling content

- [x] RED skip: historical step evidence was not captured; see verify.md evidence waiver
- [x] GREEN a0363d051
- [x] REFACTOR skip: historical step evidence was not captured; see verify.md evidence waiver

### Scenario: Singular catalogue compatibility directories remain user-owned on uninstall

- [x] RED skip: historical step evidence was not captured; see verify.md evidence waiver
- [x] GREEN a0363d051
- [x] REFACTOR skip: historical step evidence was not captured; see verify.md evidence waiver

### Scenario: Project catalogue collisions preserve user bytes

- [x] RED skip: historical step evidence was not captured; see verify.md evidence waiver
- [x] GREEN a0363d051
- [x] REFACTOR skip: historical step evidence was not captured; see verify.md evidence waiver

### Scenario: A profile collision is not overwritten or removed

- [x] RED skip: historical step evidence was not captured; see verify.md evidence waiver
- [x] GREEN 2fd55c206
- [x] REFACTOR skip: collision handling shares the existing profile observation path

### Scenario: Install repairs recognized managed plugin drift

- [x] RED skip: historical step evidence was not captured; see verify.md evidence waiver
- [x] GREEN a0363d051
- [x] REFACTOR skip: historical step evidence was not captured; see verify.md evidence waiver

### Scenario: A plugin without verifiable identity is handled conservatively

- [x] RED skip: historical step evidence was not captured; see verify.md evidence waiver
- [x] GREEN a0363d051
- [x] REFACTOR skip: historical step evidence was not captured; see verify.md evidence waiver

### Scenario: A recognized identity without its plugin remains safely recoverable

- [x] RED skip: historical step evidence was not captured; see verify.md evidence waiver
- [x] GREEN a0363d051
- [x] REFACTOR skip: historical step evidence was not captured; see verify.md evidence waiver

### Scenario: Upgrade preserves user-owned OpenCode content

- [x] RED skip: historical step evidence was not captured; see verify.md evidence waiver
- [x] GREEN a0363d051
- [x] REFACTOR skip: historical step evidence was not captured; see verify.md evidence waiver

### Scenario: Upgrade removes retired managed catalogue stubs

- [x] RED skip: historical step evidence was not captured; see verify.md evidence waiver
- [x] GREEN a0363d051
- [x] REFACTOR skip: historical step evidence was not captured; see verify.md evidence waiver

### Scenario: Uninstall preserves a user-modified managed plugin

- [x] RED skip: historical step evidence was not captured; see verify.md evidence waiver
- [x] GREEN a0363d051
- [x] REFACTOR skip: historical step evidence was not captured; see verify.md evidence waiver

### Scenario: Repository-wide uninstall does not probe an unselected OpenCode runtime

- [x] RED skip: historical step evidence was not captured; see verify.md evidence waiver
- [x] GREEN a0363d051
- [x] REFACTOR skip: historical step evidence was not captured; see verify.md evidence waiver

### Scenario: Repository-wide uninstall sweeps managed OpenCode project assets without probing runtime

- [x] RED skip: historical step evidence was not captured; see verify.md evidence waiver
- [x] GREEN a0363d051
- [x] REFACTOR skip: historical step evidence was not captured; see verify.md evidence waiver

### Scenario: Explicit OpenCode uninstall removes recognized managed assets

- [x] RED skip: historical step evidence was not captured; see verify.md evidence waiver
- [x] GREEN a0363d051
- [x] REFACTOR skip: historical step evidence was not captured; see verify.md evidence waiver

### Scenario: OpenCode health is read-only

- [x] RED skip: historical step evidence was not captured; see verify.md evidence waiver
- [x] GREEN a0363d051
- [x] REFACTOR skip: historical step evidence was not captured; see verify.md evidence waiver

### Scenario: Profile installation fails atomically when the resolved root is not writable

- [x] RED skip: historical step evidence was not captured; see verify.md evidence waiver
- [x] GREEN a0363d051
- [x] REFACTOR skip: historical step evidence was not captured; see verify.md evidence waiver

### Scenario: Interrupted profile installation leaves no loadable partial plugin

- [x] RED skip: historical step evidence was not captured; see verify.md evidence waiver
- [x] GREEN a0363d051
- [x] REFACTOR skip: historical step evidence was not captured; see verify.md evidence waiver

### Scenario: Concurrent profile installs converge through one lock

- [x] RED skip: historical step evidence was not captured; see verify.md evidence waiver
- [x] GREEN a0363d051
- [x] REFACTOR skip: historical step evidence was not captured; see verify.md evidence waiver

## Rule: opencode-parity.TBU1.R4 — Real-process conformance proves the supported boundary

### Scenario: Pinned OpenCode proves native catalogue discovery

- [x] RED aa6742a71
- [x] GREEN dec0d1268
- [x] REFACTOR 4a2a12c9f

### Scenario: Pinned OpenCode proves denial without a side effect

- [x] RED c49d47e7a
- [x] GREEN 159bfc498
- [x] REFACTOR skip: the loopback protocol stays cohesive in the isolated fixture module

### Scenario: The denial sentinel is capable of producing its side effect

- [x] RED 11d454aff
- [x] GREEN 0c4ac25a6
- [x] REFACTOR skip: armed and disarmed paths already share one sentinel executor

### Scenario: Pinned OpenCode invocation loads the referenced canonical skill

- [x] RED 94b0636fc
- [x] GREEN 3b2d64922
- [x] REFACTOR skip: the native skill call and canonical body observation form one bounded fixture proof

### Scenario: The required conformance lane fails instead of skipping

- [x] RED 4b19d64cf
- [x] GREEN 24922dc01
- [x] REFACTOR skip: one bounded fault selector drives the real fixture and the standalone lane stays declarative

### Scenario: Conformance fails safely when the OpenCode executable boundary is invalid

- [x] RED 62031948a
- [x] GREEN d1d4aab1e
- [x] REFACTOR skip: executable resolution, version probing, and typed remediation are already separate functions

### Scenario: Persisted conformance evidence excludes sensitive execution content

- [x] RED 02171a4da
- [x] GREEN 3cae4aea7
- [x] REFACTOR skip: exact validation, path binding, and durable persistence form one small boundary

### Scenario: Conformance evidence is rejected when a binding dimension differs

- [x] RED 9010b2f8b
- [x] GREEN 444be3bce
- [x] REFACTOR skip: the existing conformance predicate now receives one optional exact-version binding

### Scenario: Bound conformance evidence does not expire by age alone

- [x] RED skip: the existing binding predicate was already intentionally age-agnostic
- [x] GREEN b333a58b6
- [x] REFACTOR skip: the shared age table is the smallest clear characterization

### Scenario: Future-dated conformance remains valid when bindings match

- [x] RED skip: the existing binding predicate was already intentionally age-agnostic
- [x] GREEN b333a58b6
- [x] REFACTOR skip: the shared age table is the smallest clear characterization

## Rule: opencode-parity.NTB1.R1 — Health distinguishes independent dimensions

### Scenario: Healthy supported-process protection reports independent dimensions

- [x] RED 9b58ce129
- [x] GREEN 9a8052bd9
- [x] REFACTOR skip: exact-schema scanners and named binding predicates isolate status evidence rules

### Scenario: An uncovered lifecycle boundary is described as observational

- [x] RED 5cbabc4be
- [x] GREEN b176ae0ee
- [x] REFACTOR skip: the healthy projection adds one advisory without changing action precedence or dimensions

## Rule: opencode-parity.NTB1.R2 — Incomplete states yield one truthful summary and at most one action

### Scenario: Fully uninstalled health emits one consistent summary

- [x] RED c1dc898f2
- [x] GREEN 10cd7baa4
- [x] REFACTOR skip: the existing missing-profile branch now carries the complete bounded summary

### Scenario: Repair priority selects one named next action

- [x] RED skip: historical step evidence was not captured; see verify.md evidence waiver
- [x] GREEN a0363d051
- [x] REFACTOR skip: historical step evidence was not captured; see verify.md evidence waiver

### Scenario: Untested OpenCode versions are not called supported

- [x] RED d85b1f2ab
- [x] GREEN 954d50843
- [x] REFACTOR skip: the evidence projector already encodes the required conformance-before-activation priority

### Scenario: Passing conformance supports its exact stable OpenCode version

- [x] RED 120afd5e4
- [x] GREEN 39592981c
- [x] REFACTOR 349a879ef

### Scenario: A changed managed plugin invalidates prior conformance

- [x] RED skip: historical step evidence was not captured; see verify.md evidence waiver
- [x] GREEN a0363d051
- [x] REFACTOR skip: historical step evidence was not captured; see verify.md evidence waiver

## Rule: opencode-parity.NTB1.R3 — Stale evidence never becomes blocking proof

### Scenario: Invalid activation evidence remains non-current

- [x] RED e63f47561
- [x] GREEN 9f5c50ef5
- [x] REFACTOR skip: one status input carries clock and project context while the existing parser rejects every malformed binding

### Scenario: Activation at the seven-day boundary remains current

- [x] RED e6e2c4eba
- [x] GREEN 8e0ac68e8
- [x] REFACTOR skip: the existing freshness predicate now receives the status clock without another time abstraction

### Scenario: Missing activation evidence is not enforced protection

- [x] RED 41ac210de
- [x] GREEN 3d3cd590a
- [x] REFACTOR skip: status reuses the shared evidence booleans and one human action boundary

## Rule: opencode-parity.SWM1.R1 — Every integration declares a complete adapter

### Scenario: All supported integrations satisfy the adapter registry

- [x] RED skip: historical step evidence was not captured; see verify.md evidence waiver
- [x] GREEN a0363d051
- [x] REFACTOR skip: historical step evidence was not captured; see verify.md evidence waiver

### Scenario: An adapter without ownership declarations is rejected

- [x] RED skip: historical step evidence was not captured; see verify.md evidence waiver
- [x] GREEN a0363d051
- [x] REFACTOR skip: historical step evidence was not captured; see verify.md evidence waiver

### Scenario: An adapter cannot claim a dimension it cannot honor

- [x] RED skip: historical step evidence was not captured; see verify.md evidence waiver
- [x] GREEN a0363d051
- [x] REFACTOR skip: historical step evidence was not captured; see verify.md evidence waiver

### Scenario: Generic conformance reports an unavailable adapter dimension truthfully

- [x] RED skip: historical step evidence was not captured; see verify.md evidence waiver
- [x] GREEN a0363d051
- [x] REFACTOR skip: historical step evidence was not captured; see verify.md evidence waiver

### Scenario: An injected unavailable lifecycle boundary never becomes proof

- [x] RED skip: historical step evidence was not captured; see verify.md evidence waiver
- [x] GREEN a0363d051
- [x] REFACTOR skip: historical step evidence was not captured; see verify.md evidence waiver

### Scenario: The generic conformance command rejects an unknown integration

- [x] RED skip: historical step evidence was not captured; see verify.md evidence waiver
- [x] GREEN a0363d051
- [x] REFACTOR skip: historical step evidence was not captured; see verify.md evidence waiver

### Scenario: Generic conformance is published as a host-neutral command

- [x] RED skip: historical step evidence was not captured; see verify.md evidence waiver
- [x] GREEN a0363d051
- [x] REFACTOR skip: historical step evidence was not captured; see verify.md evidence waiver

## Rule: opencode-parity.SWM1.R2 — Shared assets leave with their final consumer

### Scenario: A shared asset survives while one selected consumer remains

- [x] RED skip: historical step evidence was not captured; see verify.md evidence waiver
- [x] GREEN a0363d051
- [x] REFACTOR skip: historical step evidence was not captured; see verify.md evidence waiver

### Scenario: The final consumer removes only Safeword-owned shared assets

- [x] RED skip: historical step evidence was not captured; see verify.md evidence waiver
- [x] GREEN a0363d051
- [x] REFACTOR skip: historical step evidence was not captured; see verify.md evidence waiver

### Scenario: Codex does not retain the shared skills delivery after OpenCode leaves

- [x] RED skip: historical step evidence was not captured; see verify.md evidence waiver
- [x] GREEN a0363d051
- [x] REFACTOR skip: historical step evidence was not captured; see verify.md evidence waiver

## Rule: opencode-parity.SWM1.R3 — Contract tests reject overstatement and bypass

### Scenario: Lifecycle operations use the common adapter coordinator

- [x] RED skip: historical step evidence was not captured; see verify.md evidence waiver
- [x] GREEN a0363d051
- [x] REFACTOR skip: historical step evidence was not captured; see verify.md evidence waiver

### Scenario: OpenCode selection exposes its declared plan effects

- [x] RED skip: historical step evidence was not captured; see verify.md evidence waiver
- [x] GREEN a0363d051
- [x] REFACTOR skip: historical step evidence was not captured; see verify.md evidence waiver

### Scenario: Omitted plan selection excludes OpenCode effects

- [x] RED skip: historical step evidence was not captured; see verify.md evidence waiver
- [x] GREEN a0363d051
- [x] REFACTOR skip: historical step evidence was not captured; see verify.md evidence waiver

### Scenario: Existing integration operations retain their recorded origin-main contract

- [x] RED skip: historical step evidence was not captured; see verify.md evidence waiver
- [x] GREEN a0363d051
- [x] REFACTOR skip: selected ownership generation is already isolated at the lifecycle schema boundary

### Scenario: Mixed OpenCode selection preserves existing integration bytes

- [x] RED skip: historical step evidence was not captured; see verify.md evidence waiver
- [x] GREEN a0363d051
- [x] REFACTOR skip: historical step evidence was not captured; see verify.md evidence waiver

### Scenario: OpenCode compatibility sweeping preserves the legacy Cursor sweep

- [x] RED skip: historical step evidence was not captured; see verify.md evidence waiver
- [x] GREEN a0363d051
- [x] REFACTOR skip: historical step evidence was not captured; see verify.md evidence waiver

### Scenario: A registered integration cannot be skipped by lifecycle coordination

- [x] RED skip: historical step evidence was not captured; see verify.md evidence waiver
- [x] GREEN a0363d051
- [x] REFACTOR skip: historical step evidence was not captured; see verify.md evidence waiver

### Scenario: Invalid adapter claims fail contract validation

- [x] RED skip: historical step evidence was not captured; see verify.md evidence waiver
- [x] GREEN a0363d051
- [x] REFACTOR skip: historical step evidence was not captured; see verify.md evidence waiver

## Feature-level cross-scenario refactor

- [x] cross-scenario skip: whole-ticket quality review found no structural change worth making; see verify.md
