# Phase 3-4: Define Behavior & Scenario Gate

## Phase 3: Define Behavior

**Entry:** Agent enters `define-behavior` phase (after discovery or resume).

### Iron Law

**DERIVE DIMENSIONS BEFORE WRITING SCENARIOS** — systematic coverage, not intuition.

### Pipeline (5 steps)

1. **Derive dimensions** from intake artifacts (resolved questions, done-when, scope) + domain-knowledge dimensions not surfaced during intake
2. **Partition** each dimension into equivalence classes + boundary values
3. **Generate scenarios** — one per partition + boundary cases
4. **Organize under rules** with card-ratio self-check (too many rules? any rules with no examples? open questions?)
5. **Present to user** (decider) — user accepts, tweaks, or adds

Save the dimension table to `dimensions.md` in the ticket folder before writing test-definitions.md (the pre-tool hook enforces this for features).

### Scenario saturation

Each propose-and-converge turn either surfaces new scenarios or doesn't. When a turn produces no new scenarios → proceed to Phase 4.

### Concrete example

**Context:** User asked for `--dry-run` on init. Intake produced scope (show what would be created without creating), done-when (output matches real init, no side effects).

**Agent turn 1:**

> From intake I see 2 behavioral dimensions:
>
> | Dimension              | Partitions                                    |
> | ---------------------- | --------------------------------------------- |
> | Output correctness     | empty dir, existing config, conflicting files |
> | Side-effect prevention | filesystem writes, git operations             |
>
> Organized under 3 rules:
>
> **Rule: Dry-run output matches real init**
>
> - [ ] Shows expected files in empty directory
> - [ ] Shows warning when config already exists
> - [ ] Shows conflict notice for incompatible existing files
>
> **Rule: Dry-run creates no files**
>
> - [ ] No files created on disk
>
> **Rule: Dry-run skips git operations**
>
> - [ ] No git init or git add executed
>
> 3 rules, 5 scenarios, 0 open questions. The "conflicting files" partition came from domain knowledge — init currently overwrites without warning, so dry-run should surface that. Anything missing, or ready for the quality gate?

**User:** "Looks good, proceed."

**Result:** No new scenarios → scenario saturation → proceed to Phase 4.

### Test-definitions format

```markdown
## Rule: Description of business rule

- [ ] Scenario covering partition A
- [ ] Scenario covering partition B (boundary)

## Rule: Non-obvious rule

> Rationale: Why this rule exists and why these partitions matter

- [ ] Scenario covering partition C
- [ ] Scenario covering partition D
```

### Phase 3 Exit (REQUIRED)

1. **Save scenarios** to `.safeword-project/tickets/{id}-{slug}/test-definitions.md`
2. **Update frontmatter:** `phase: scenario-gate`
3. **Add work log entry:**

   ```
   - {timestamp} Complete: Phase 3 - {N} scenarios defined across {M} rules
   ```

---

## Phase 4: Scenario Quality Gate

**Entry:** Agent enters `scenario-gate` phase.

### AODI Validation

Validate each scenario against four criteria:

| Criterion         | Check                          | Red flag                        |
| ----------------- | ------------------------------ | ------------------------------- |
| **Atomic**        | Tests ONE behavior             | Multiple When/Then pairs        |
| **Observable**    | Has externally visible outcome | Internal state only             |
| **Deterministic** | Same result on repeated runs   | Time/random/external dependency |
| **Independent**   | No ordering dependency         | "After Scenario 2 runs..."      |

### Adversarial pass

After AODI validation, argue against your own scenario list: "What breaks that none of these scenarios catch?" Present any findings to the user.

### Coverage saturation

If the adversarial pass + user feedback produced new scenarios → loop back to Phase 3. If nothing new surfaced → done.

### Phase 4 Exit (REQUIRED)

1. Each scenario validated (Atomic, Observable, Deterministic, Independent)
2. Adversarial pass complete — issues reported or confirmed clean
3. **Update frontmatter:** `phase: decomposition`
4. **Add work log entry:**

   ```
   - {timestamp} Complete: Phase 4 - Scenarios validated (AODI) + adversarial pass
   ```
