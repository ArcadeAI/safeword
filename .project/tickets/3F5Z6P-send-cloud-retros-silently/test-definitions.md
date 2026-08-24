# Test Definitions: Send retros silently from supported local harnesses

Feature source: `features/send-cloud-retros-silently.feature`

This file is the RED/GREEN/REFACTOR ledger. Each scenario below starts unchecked.

## Rule: send-cloud-retros-silently.NTB1.R1

### Scenario: Install wires only the selected harness completion lifecycle

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Installing both supported harnesses preserves both completion entries

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Reinstalling a selected harness keeps one completion entry

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Install preserves unrelated harness completion entries

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Install preserves malformed harness completion configuration

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: An installed completion entry fires through its harness lifecycle

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Eligibility counts completed event pairs

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: An eligible session without an extracted candidate makes no attempt

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: An eligible session with multiple extracted candidates makes no public attempt

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A substantial supported local session makes one silent attempt

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: An ineligible session makes no network attempt

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A session without a stable identifier is not eligible

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A claimed eligible session is not attempted again

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A malformed marker store fails closed

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Concurrent completion hooks claim one attempt

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A previously ineligible session can become eligible

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A failed atomic claim makes no public attempt

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A crash after claim cannot cause a second attempt

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: send-cloud-retros-silently.NTB1.R2

### Scenario: Available allowlisted source context is collected

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Sanitization protects canonical bytes and the local marker

- [x] RED 09d93cf52
- [x] GREEN fce714c72
- [x] REFACTOR skip: candidate delivery reuses the shared sanitizer and one complete renderer

### Scenario: Contaminated sanitizer output is rejected before persistence

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: An empty sanitized finding is rejected before persistence

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Unavailable optional source context is omitted

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Empty optional source context is omitted

- [x] RED 1031f051e
- [x] GREEN d5db0d09e
- [x] REFACTOR skip: one predicate keeps all optional fields on the same canonical rule

### Scenario: Repository remotes normalize or are omitted

- [x] RED cd27ede4f
- [x] GREEN 0a507a103
- [x] REFACTOR skip: URL parsing plus one SCP-shaped fallback is the smallest credential-free normalizer

### Scenario: Repository credentials never enter the envelope

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: An absent repository remote is omitted

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: User identity follows documented precedence

- [x] RED d604dfa2f
- [x] GREEN 3b550c673
- [x] REFACTOR skip: ordered first-nonblank selection directly expresses the contract

### Scenario: Forbidden source metadata cannot enter the envelope

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: send-cloud-retros-silently.NTB1.R3

### Scenario: First install creates project identity locally

- [x] RED da303fab6
- [x] GREEN c5871be74
- [x] REFACTOR skip: setup delegates the one local config migration to a focused helper

### Scenario: Existing project identity is preserved

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Install and upgrade preserve the collection setting

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Install and upgrade reject a malformed collection setting atomically

- [x] RED be77c66e4
- [x] GREEN 7e4f6bb7d
- [x] REFACTOR skip: the public wrapper keeps validation ahead of the unchanged setup engine

### Scenario: First install in a clone preserves project identity

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: The local CLI turns public retros off or on

- [x] RED 8fe2c2d40
- [x] GREEN c2c648301
- [x] REFACTOR skip: one command handler delegates to the shared config writer without another layer

### Scenario: Invalid public-retro control leaves configuration unchanged

- [x] RED 285aeecf0
- [x] GREEN c19b049ba
- [x] REFACTOR skip: one existence guard completes the rejection boundary

### Scenario: Install repairs malformed project identity locally

- [x] RED skip: missing and malformed identities share the already-green local replacement branch
- [x] GREEN 99a4e47b8
- [x] REFACTOR skip: the setup-level proof needs no new production structure

### Scenario: Uppercase project identity is serialized canonically

- [x] RED skip: the canonical-envelope RED already supplied an uppercase project identity
- [x] GREEN 880df43ef
- [x] REFACTOR skip: canonicalization remains one validation-boundary operation

### Scenario: Cloned projects still distinguish sessions

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: The same project session derives one opaque scope

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Different harnesses cannot collide on one host session identifier

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Different projects distinguish the same host session

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Distinct sessions in one project each receive one attempt

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A project opt-out prevents collection

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: An invalid project config fails closed

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: An absent collection setting defaults on silently

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: An explicit enabled collection setting is honored silently

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: send-cloud-retros-silently.SWM1.R1

### Scenario: Both adapters preserve a prepared request unchanged

- [x] RED 17d41b286
- [x] GREEN 1e6275060
- [x] REFACTOR skip: one shared request constructor is the intended deduplication

### Scenario: Both adapters use only the built-in HTTPS collector

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Collector redirects are never accepted as preservation

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Request identity is generated once outside the envelope

- [x] RED f75a632f4
- [x] GREEN 69938b3e0
- [x] REFACTOR skip: the atomic claim is a single filesystem boundary with no duplicate policy

### Scenario: Distinct attempts receive distinct request identities

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Independent preparation is deterministic

- [x] RED c9a250ca6
- [x] GREEN 880df43ef
- [x] REFACTOR skip: the first pure builder slice has one responsibility and no duplication

### Scenario: Escapable and non-ASCII findings serialize deterministically

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A partial source profile keeps canonical key order

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: send-cloud-retros-silently.SWM1.R2

### Scenario: An exact retry returns the original receipt

- [x] RED f4911e7fb
- [x] GREEN 3949b937c
- [x] REFACTOR skip: first vertical slice has no duplication or unclear ownership

### Scenario: Concurrent first submissions converge

- [x] RED skip: convergence was necessarily established by the prior transactional store slice
- [x] GREEN 84dff8caa
- [x] REFACTOR skip: proof required no production change or new abstraction

### Scenario: Concurrent byte-different bodies cannot share one request identity

- [x] RED skip: request conflict handling was necessarily established by the transactional store slice
- [x] GREEN 0384f2263
- [x] REFACTOR skip: proof required no production change or new abstraction

### Scenario: Concurrent fresh identities cannot share one session scope

- [x] RED skip: scope conflict handling was necessarily established by the transactional store slice
- [x] GREEN ec46336f1
- [x] REFACTOR skip: proof required no production change or new abstraction

### Scenario: Distinct submissions remain independent

- [x] RED skip: independent inserts were necessarily established by the transactional store slice
- [x] GREEN 3ad78268e
- [x] REFACTOR skip: proof required no production change or new abstraction

### Scenario: Source metadata never becomes duplicate authority

- [x] RED skip: metadata independence was necessarily established by the transactional store slice
- [x] GREEN 3ad78268e
- [x] REFACTOR skip: existing distinct-submission proof covers this without duplication

### Scenario: A minimal source profile is accepted

- [x] RED skip: minimal-profile acceptance was established by the first collector slice
- [x] GREEN 3ad78268e
- [x] REFACTOR skip: existing acceptance proof already uses the minimal profile

### Scenario: The raw v1 envelope size boundary is enforced

- [x] RED skip: streaming byte enforcement was established by the first collector slice
- [x] GREEN 4e93f9458
- [x] REFACTOR skip: one table proves all four byte-boundary rows without duplication

### Scenario: Reusing a request identity with different bytes is rejected

- [x] RED skip: request conflict behavior was established by the transactional store slice
- [x] GREEN 0384f2263
- [x] REFACTOR skip: concurrent conflict proof is strictly stronger than a serial duplicate test

### Scenario: Semantic equivalence cannot override byte-different raw bodies

- [x] RED skip: canonical raw-byte enforcement was established by envelope validation
- [x] GREEN b71215cf9
- [x] REFACTOR skip: one raw-body authority test proves rejection and record preservation

### Scenario: Reusing a session scope with different bytes is rejected

- [x] RED skip: scope conflict behavior was established by the transactional store slice
- [x] GREEN e6f30af24
- [x] REFACTOR skip: one conflict test proves rejection and winner preservation

### Scenario: A fresh request identity cannot reuse an accepted session scope

- [x] RED skip: fresh-identity scope rejection was established by the transactional store slice
- [x] GREEN ec46336f1
- [x] REFACTOR skip: concurrent scope proof is strictly stronger than a serial reuse test

### Scenario: A malformed request identity is rejected

- [x] RED skip: request identity validation was established by the first collector slice
- [x] GREEN 9216029fb
- [x] REFACTOR skip: one table proves all six malformed identity rows

### Scenario: Invalid envelope schema is rejected

- [x] RED 20f3d3ece
- [x] GREEN 117ecae46
- [x] REFACTOR skip: canonical decode check is already the smallest clear implementation

## Rule: send-cloud-retros-silently.SWM1.R3

### Scenario: Public intake stores a quarantined record without GitHub access

- [x] RED 30e491178
- [x] GREEN 5ac79e3d0
- [x] REFACTOR skip: the composition root and package wiring are already minimal

### Scenario: Public collector has no private filing authority

- [x] RED skip: the preceding package slice already established physical separation
- [x] GREEN 66c60393f
- [x] REFACTOR skip: one manifest and artifact assertion is the smallest structural proof

### Scenario: Public submission needs no credential

- [x] RED skip: credentialless intake was established by the packaged collector slice
- [x] GREEN 5ac79e3d0
- [x] REFACTOR skip: the packaged no-credential request is already end-to-end proof

### Scenario: Credential-bearing public submissions are rejected

- [x] RED skip: credential rejection was established by the foundational intake route
- [x] GREEN 6a45edd88
- [x] REFACTOR skip: one table covers the complete credential-header denylist

### Scenario: An authorized operator can inspect a quarantined record

- [x] RED 1a9c36029
- [x] GREEN a3a8edbbb
- [x] REFACTOR skip: the read handler was extracted before the green commit to keep intake simple

### Scenario: Non-operator credentials cannot read public records

- [x] RED skip: operator authorization was established by the preceding read slice
- [x] GREEN a56d5cff8
- [x] REFACTOR skip: one table covers every non-operator credential class

### Scenario: Anonymous callers cannot enumerate public records

- [x] RED skip: enumeration-neutral routing was established by the operator read slice
- [x] GREEN ad721c158
- [x] REFACTOR skip: one comparison covers listing, existing, and missing-record anonymity

### Scenario: Public correlation values grant no read or filing authority

- [x] RED skip: the operator credential boundary already denied all non-operator values
- [x] GREEN 530b8f8de
- [x] REFACTOR skip: one real-process table covers all four correlation values

### Scenario: Collector failure cannot fall through to private filing

- [x] RED 22497a886
- [x] GREEN f57bf51f8
- [x] REFACTOR a06414dbd

### Scenario: The public route cannot mutate accepted records

- [x] RED skip: the append-only route shape was established by the foundational intake slice
- [x] GREEN da921dc64
- [x] REFACTOR skip: one table proves both mutation verbs and the unchanged raw body

### Scenario: Existing private filing remains operational beside public collection

- [x] RED skip: both independent services were already operational before the coexistence proof
- [x] GREEN 84bbaf204
- [x] REFACTOR skip: test-only composition preserves both production package boundaries

## Rule: send-cloud-retros-silently.SWM1.R4

### Scenario: Work within both budgets is preserved

- [x] RED 163c72f30
- [x] GREEN a0b39a084
- [x] REFACTOR skip: the orchestrator remains linear and delegates request construction

### Scenario: Extraction time does not consume the delivery budgets

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Preparation failure makes no handoff

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Preparation reaching its deadline is abandoned on the boundary

- [x] RED 2342c57e0
- [x] GREEN 3fda07daa
- [x] REFACTOR skip: the shared claim helper keeps the irreversible boundary explicit

### Scenario: An uncommitted claim is abandoned at the preparation deadline

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A claim completing on the preparation deadline makes no handoff

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Latest valid preparation still leaves an exclusive handoff budget

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Handoff failure is not reported as preserved

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Receipt recording failure leaves a claimed unpreserved session

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Receipt recording reaching the handoff deadline is abandoned

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A claimed unpreserved session is not retried

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Hook exit leaves no detached handoff work

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: An oversized prepared envelope is abandoned before handoff

- [x] RED f711991b2
- [x] GREEN 0a9aed190
- [x] REFACTOR skip: one byte-length guard is the smallest complete boundary

### Scenario: A maximum-sized prepared envelope proceeds to handoff

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: send-cloud-retros-silently.SWM1.R5

### Scenario: An unsupported host makes no retrospective attempt

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Install does not create public completion wiring for an unsupported host

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Payload metadata cannot spoof an installed harness

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Feature-level cross-scenario refactor

- [x] cross-scenario 53ad0ba96
