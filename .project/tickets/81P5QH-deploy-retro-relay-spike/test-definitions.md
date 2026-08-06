# Test Definitions: Deploy the retro relay spike

Feature source: `features/deploy-retro-relay-spike.feature`

## Rule: Invalid runtime configuration never produces a deceptively healthy service

### Scenario: Startup rejects each missing required runtime value

- [x] RED skip: uncommittable partial state — runtime Vitest failed on the missing runtime-config module and the commit lint gate rejected that unresolved import
- [x] GREEN 909c25463
- [x] REFACTOR b107850bd

### Scenario: Startup rejects every malformed runtime value class

- [x] RED e8c75da81
- [x] GREEN 91b80c39a
- [x] REFACTOR b107850bd

## Rule: A healthy instance proves its durable store is open and ready

### Scenario: Railway health reports the hosted SQLite schema ready

- [x] RED d8a2332cd
- [x] GREEN 91c22f7d0
- [x] REFACTOR b107850bd

### Scenario: Local shutdown closes the server, database, and process lock

- [x] RED skip: uncommittable partial state — the lifecycle test imported the not-yet-exported production runtime
- [x] GREEN b107850bd
- [x] REFACTOR 68ba2de1f

### Scenario: Health fails closed when the SQLite schema is unavailable

- [x] RED skip: shared health implementation was required by the preceding readiness scenario
- [x] GREEN b107850bd
- [x] REFACTOR 46abc318d

## Rule: Restarting the hosting instance preserves accepted request identity

### Scenario: A request mismatch remains rejected after an actual Railway restart

- [x] RED skip: live Railway target did not exist before the deployment slice
- [x] GREEN 4a4fa772d
- [x] REFACTOR 46abc318d

### Scenario: Live Railway topology has one replica and one mounted data volume

- [x] RED skip: live Railway target did not exist before the deployment slice
- [x] GREEN 4a4fa772d
- [x] REFACTOR e74746765

### Scenario: Live smoke validation rejects each unsafe Railway topology class

- [x] RED skip: shared topology contract was first exercised by the live positive path
- [x] GREEN 68ba2de1f
- [x] REFACTOR e74746765

## Rule: The disposable spike cannot affect production systems

### Scenario: Provisioning creates a new clearly named Railway project

- [x] RED skip: no disposable project existed before provisioning
- [x] GREEN 4a4fa772d
- [x] REFACTOR e74746765

### Scenario: Generated credentials cannot create a GitHub issue

- [x] RED skip: no hosted credential boundary existed before deployment
- [x] GREEN 4a4fa772d
- [x] REFACTOR 68ba2de1f

### Scenario: Teardown refuses an unrecorded or non-disposable target

- [x] RED skip: independent quality review found the safety path was not wired
- [x] GREEN 68ba2de1f
- [x] REFACTOR e74746765

### Scenario: Teardown previews only the recorded disposable resource IDs

- [x] RED skip: independent quality review found the safety path was not wired
- [x] GREEN 68ba2de1f
- [x] REFACTOR e74746765

## Rule: The spike leaves an actionable operational decision

### Scenario: The spike report records evidence, limitations, promotion, and teardown

- [x] RED skip: no live evidence existed before the Railway proof
- [x] GREEN 4a4fa772d
- [x] REFACTOR b775e98f0

### Scenario: Report validation distinguishes incomplete from secret-bearing evidence

- [x] RED skip: independent quality review proved CLI redaction failed open without stdin secrets
- [x] GREEN e74746765
- [x] REFACTOR 2420730b4

---

## Feature-level cross-scenario refactor

- [x] cross-scenario 2420730b4
