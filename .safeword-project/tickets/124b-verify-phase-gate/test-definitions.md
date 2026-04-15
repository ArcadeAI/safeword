# Test Definitions: Verify Phase Gate (#124b)

**Feature**: Add verify phase between implement and done — done means done
**Related Issue**: #124b
**Test File**: `packages/cli/tests/integration/phase-derivation.test.ts` (extend existing suite)
**Total Tests**: 8 (0 passing, 0 skipped, 8 not implemented)

---

## Rule: Prompt hook shows phase-appropriate reminders

> Rationale: Verify phase needs its own reminder so agents know to run /verify + /audit. Done phase simplifies since verification moved out.

- [ ] Given phase is `verify`, when prompt hook runs, then output includes verify-specific reminder (mentioning /verify and /audit)

### Scenario 1.1: Verify phase prompt reminder

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

- [ ] Given phase is `done`, when prompt hook runs, then output includes simplified done reminder (not the old multi-step message)

### Scenario 1.2: Done phase simplified prompt reminder

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

---

## Rule: /verify writes verify.md artifact to ticket folder

> Rationale: verify.md is the evidence artifact that gates the done transition. Must include timestamp for staleness detection. Must not be written on failure (no partial evidence).

- [ ] Given an active ticket, when /verify runs and all checks pass, then `verify.md` is written to the ticket folder containing timestamp and check results

### Scenario 2.1: Successful verify writes artifact

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

- [ ] Given an active ticket, when /verify runs and tests fail, then `verify.md` is NOT written to the ticket folder

### Scenario 2.2: Failed verify does not write artifact

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

---

## Rule: Stop hook blocks done without valid verify.md

> Rationale: The core enforcement — agent cannot close a ticket without running /verify first. Empty files rejected to prevent gaming.

- [ ] Given phase is `done` and valid `verify.md` exists in ticket folder, when stop hook runs, then it does not hard-block on missing artifact

### Scenario 3.1: Done allowed with valid verify.md

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

- [ ] Given phase is `done` and `verify.md` does NOT exist in ticket folder, when stop hook runs, then it hard-blocks with message to run /verify

### Scenario 3.2: Done blocked without verify.md

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

- [ ] Given phase is `done` and `verify.md` exists but is empty (0 bytes), when stop hook runs, then it hard-blocks (empty file is not valid evidence)

### Scenario 3.3: Done blocked with empty verify.md

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

- [ ] Given phase is `done` and no active ticket (null), when stop hook runs, then it skips the artifact check

### Scenario 3.4: No ticket skips artifact check

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

---

## Static: Phase table and resume logic updated

> Rationale: SKILL.md is the source of truth for phase flow. Must reflect the new verify phase.

- [ ] SKILL.md phase table includes verify between implement and done, resume logic has verify entry

### Verification: Phase table includes verify

- [ ] VERIFIED

---

## Coverage Summary

**Total**: 8 scenarios (7 TDD-cycled + 1 static verification)
**Passing**: 0 (0%)
**Not Implemented**: 8 (100%)

**Rules**: 4

- Prompt hook reminders (2 scenarios)
- /verify writes artifact (2 scenarios — pass and fail)
- Stop hook blocks done without verify.md (4 scenarios — valid, missing, empty, no ticket)
- Phase table updated (1 static verification)
