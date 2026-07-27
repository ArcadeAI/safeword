# Test Definitions: Deploy the retro relay spike

Feature source: `features/deploy-retro-relay-spike.feature`

## Rule: Invalid runtime configuration never produces a deceptively healthy service

### Scenario: Startup rejects each missing required runtime value

- [x] RED skip: uncommittable partial state — runtime Vitest failed on the missing runtime-config module and the commit lint gate rejected that unresolved import
- [x] GREEN 909c25463
- [ ] REFACTOR

### Scenario: Startup rejects every malformed runtime value class

- [x] RED e8c75da81
- [x] GREEN 91b80c39a
- [ ] REFACTOR

## Rule: A healthy instance proves its durable store is open and ready

### Scenario: Railway health reports the hosted SQLite schema ready

- [x] RED skip: pending commit — Vitest received 401 instead of the required unauthenticated 200 health response
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Local shutdown closes the server, database, and process lock

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Health fails closed when the SQLite schema is unavailable

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: Restarting the hosting instance preserves accepted request identity

### Scenario: A request mismatch remains rejected after an actual Railway restart

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Live Railway topology has one replica and one mounted data volume

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Live smoke validation rejects each unsafe Railway topology class

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: The disposable spike cannot affect production systems

### Scenario: Provisioning creates a new clearly named Railway project

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Generated credentials cannot create a GitHub issue

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Teardown refuses an unrecorded or non-disposable target

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Teardown previews only the recorded disposable resource IDs

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: The spike leaves an actionable operational decision

### Scenario: The spike report records evidence, limitations, promotion, and teardown

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Report validation distinguishes incomplete from secret-bearing evidence

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

---

## Feature-level cross-scenario refactor

- [ ] cross-scenario
