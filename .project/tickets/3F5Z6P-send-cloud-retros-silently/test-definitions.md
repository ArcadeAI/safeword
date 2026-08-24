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

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

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

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Repository remotes normalize or are omitted

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Repository credentials never enter the envelope

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: An absent repository remote is omitted

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: User identity follows documented precedence

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Forbidden source metadata cannot enter the envelope

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: send-cloud-retros-silently.NTB1.R3

### Scenario: First install creates project identity locally

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Existing project identity is preserved

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Install and upgrade preserve the collection setting

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Install and upgrade reject a malformed collection setting atomically

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: First install in a clone preserves project identity

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: The local CLI turns public retros off or on

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Invalid public-retro control leaves configuration unchanged

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Install repairs malformed project identity locally

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Uppercase project identity is serialized canonically

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

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

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Both adapters use only the built-in HTTPS collector

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Collector redirects are never accepted as preservation

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Request identity is generated once outside the envelope

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Distinct attempts receive distinct request identities

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Independent preparation is deterministic

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

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
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Concurrent fresh identities cannot share one session scope

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Distinct submissions remain independent

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Source metadata never becomes duplicate authority

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A minimal source profile is accepted

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: The raw v1 envelope size boundary is enforced

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Reusing a request identity with different bytes is rejected

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Semantic equivalence cannot override byte-different raw bodies

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Reusing a session scope with different bytes is rejected

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A fresh request identity cannot reuse an accepted session scope

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A malformed request identity is rejected

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Invalid envelope schema is rejected

- [x] RED 20f3d3ece
- [x] GREEN 117ecae46
- [x] REFACTOR skip: canonical decode check is already the smallest clear implementation

## Rule: send-cloud-retros-silently.SWM1.R3

### Scenario: Public intake stores a quarantined record without GitHub access

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Public collector has no private filing authority

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Public submission needs no credential

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Credential-bearing public submissions are rejected

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: An authorized operator can inspect a quarantined record

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Non-operator credentials cannot read public records

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Anonymous callers cannot enumerate public records

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Public correlation values grant no read or filing authority

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Collector failure cannot fall through to private filing

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: The public route cannot mutate accepted records

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Existing private filing remains operational beside public collection

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: send-cloud-retros-silently.SWM1.R4

### Scenario: Work within both budgets is preserved

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Extraction time does not consume the delivery budgets

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Preparation failure makes no handoff

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Preparation reaching its deadline is abandoned on the boundary

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

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

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

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

- [ ] cross-scenario
