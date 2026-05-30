# Test Definitions: Acceptance Criteria layer (31W8M3)

<!-- RED = AC-gate logic + failing test authored (230cf117, test-first vs a stub);
     GREEN = behavior wired end-to-end + integration-proven (94481805).
     REFACTOR skipped — the gate reuses jtbd.ts's block walk, no per-scenario cleanup. -->

## Rule: AC gate requires ≥1 AC under each JTBD

### Scenario: A JTBD with at least one AC passes

Given a spec.md with one JTBD that has an `#### <jtbd-id>.AC1 — …` heading under it
When the AC gate evaluates the spec
Then the gate passes (ok)

- [x] RED 230cf117
- [x] GREEN 94481805
- [x] REFACTOR skip: reuses jtbd.ts block walk; no structural change

### Scenario: A JTBD with zero ACs and no skip is denied

Given a spec.md with one JTBD and no AC headings or skip under it
When the AC gate evaluates the spec
Then the gate denies, and the reason names that JTBD

- [x] RED 230cf117
- [x] GREEN 94481805
- [x] REFACTOR skip: reuses jtbd.ts block walk; no structural change

### Scenario: A JTBD with an AC skip and a non-empty reason passes

Given a JTBD whose block contains `skip: <non-empty reason>` and no AC headings
When the AC gate evaluates the spec
Then the gate passes (deliberate, auditable omission)

- [x] RED 230cf117
- [x] GREEN 94481805
- [x] REFACTOR skip: reuses jtbd.ts block walk; no structural change

### Scenario: A JTBD with an empty AC skip reason is denied

Given a JTBD whose block contains `skip:` with an empty or whitespace-only reason
When the AC gate evaluates the spec
Then the gate denies (a real reason is required)

- [x] RED 230cf117
- [x] GREEN 94481805
- [x] REFACTOR skip: reuses jtbd.ts block walk; no structural change

### Scenario: With two JTBDs, one missing ACs denies the whole gate

Given a spec.md with two JTBDs where the first has an AC and the second has none
When the AC gate evaluates the spec
Then the gate denies, naming the second JTBD (per-JTBD, not any-JTBD)

- [x] RED 230cf117
- [x] GREEN 94481805
- [x] REFACTOR skip: reuses jtbd.ts block walk; no structural change

### Scenario: HTML-commented example ACs are not counted

Given a JTBD whose only AC heading sits inside an HTML comment block
When the AC gate evaluates the spec
Then that AC does not count — the gate denies as if the JTBD had zero ACs

- [x] RED 230cf117
- [x] GREEN 94481805
- [x] REFACTOR skip: reuses jtbd.ts block walk; no structural change

## Rule: AC gate routing mirrors the JTBD gate

### Scenario: A whole-section JTBD skip passes the AC gate vacuously

Given a spec.md whose Jobs To Be Done section is a single `skip: <reason>` (no JTBD entries)
When the AC gate evaluates the spec
Then the gate passes (no JTBDs means no ACs to require)

- [x] RED 230cf117
- [x] GREEN 94481805
- [x] REFACTOR skip: reuses jtbd.ts block walk; no structural change

### Scenario: A ticket with no spec.md does not fire the AC gate

Given a feature ticket with a complete frontmatter spec but no spec.md file
When test-definitions.md is created (pre-tool gate runs)
Then the AC gate does not fire (grandfathered old-flow ticket) and creation is allowed

- [x] RED 230cf117
- [x] GREEN 94481805
- [x] REFACTOR skip: reuses jtbd.ts block walk; no structural change

## Feature-level cross-scenario refactor

- [x] cross-scenario 6d0a1290
