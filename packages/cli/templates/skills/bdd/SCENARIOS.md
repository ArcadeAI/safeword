# Phase 3-4: Define Behavior & Scenario Gate

## Phase 3: Define Behavior

**Entry:** Agent enters `define-behavior` phase (after discovery or resume)

### 3.1 Draft Scenarios

1. Read spec goal/scope
2. Draft Given/When/Then scenarios covering:
   - Happy path (main success)
   - Failure modes (what can go wrong)
   - Edge cases (boundaries, empty states)
3. Present scenarios to user
4. User can add/modify/remove scenarios
5. Each scenario gets `[ ]` checkbox for implementation tracking

### 3.2 Save & Exit (REQUIRED)

1. **Save scenarios** to `.safeword-project/tickets/{id}-{slug}/test-definitions.md`
2. **Update frontmatter:** `phase: scenario-gate`
3. **Add work log entry:**

   ```
   - {timestamp} Complete: Phase 3 - {N} scenarios defined
   ```

---

## Phase 4: Scenario Quality Gate

**Entry:** Agent enters `scenario-gate` phase

**Validate each scenario against three criteria:**

| Criterion         | Check                          | Red flag                        |
| ----------------- | ------------------------------ | ------------------------------- |
| **Atomic**        | Tests ONE behavior             | Multiple When/Then pairs        |
| **Observable**    | Has externally visible outcome | Internal state only             |
| **Deterministic** | Same result on repeated runs   | Time/random/external dependency |

**Report issues:**

- Group by type (atomicity, observability, determinism)
- Suggest fix for each issue
- Example: "Scenario 3 tests login AND session creation. Split into two scenarios."

### Phase 4 Exit (REQUIRED)

Before proceeding to Phase 5:

1. Each scenario validated (Atomic, Observable, Deterministic)
2. Issues reported or confirmed clean
3. **Update frontmatter:** `phase: decomposition`
4. **Add work log entry:**

   ```
   - {timestamp} Complete: Phase 4 - Scenarios validated
   ```
