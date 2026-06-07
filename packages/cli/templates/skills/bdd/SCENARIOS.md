# Define Behavior & Scenario Gate

## Define Behavior

**Entry:** Agent enters `define-behavior` phase (after discovery or resume).

### Iron Law

**DERIVE DIMENSIONS BEFORE WRITING SCENARIOS** — systematic coverage, not intuition.

### Pipeline (5 steps)

1. **Derive dimensions** from intake artifacts (resolved questions, done-when, scope) + domain-knowledge dimensions not surfaced during intake
2. **Partition** each dimension into equivalence classes + boundary values
3. **Generate scenarios** — one per partition + boundary cases. Each scenario proves a specific **Acceptance Criterion** from intake (`spec.md`); if a scenario doesn't map to any AC, either it's testing implementation (drop it) or an AC is missing (go back and add it).
4. **Organize under rules** with card-ratio self-check (too many rules? any rules with no examples? open questions?). Rules group scenarios by the AC they prove, so every AC has ≥1 scenario and no scenario is an orphan.
5. **Present to user** (decider) — user accepts, tweaks, or adds

Save the dimension table to `dimensions.md` in the ticket folder before writing test-definitions.md (the pre-tool hook enforces this for features). For tiny features with one obvious behavioral dimension and no partitioning to enumerate, dimensions.md may instead be a single line `skip: <non-empty reason>`.

### Scenario saturation

Each propose-and-converge turn either surfaces new scenarios or doesn't. When a turn produces no new scenarios → proceed to scenario-gate.

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

**Result:** No new scenarios → scenario saturation → proceed to scenario-gate.

### Two formats: discovery vs saved

**Discovery shorthand** (in chat, presenting to user): Rule + bare scenario checkboxes — fast to read, easy to amend in conversation. This is what turn-1 above looks like.

**Saved format** (`test-definitions.md` on disk): nested `## Rule:` / `### Scenario:` with Given/When/Then + per-scenario `- [ ] RED / GREEN / REFACTOR` sub-checkboxes. The R/G/R sub-checkboxes are load-bearing — the prompt hook parses them to inject TDD-step guidance during implement, and they enforce one-commit-per-step discipline. Aim for 3-5 G/W/T steps per scenario, and write each to the **Scenario construction rules** below.

```markdown
## Rule: Description of business rule

### Scenario: Partition A

Given [context]
When [action]
Then [outcome]

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Partition B (boundary)

Given [context]
When [action]
Then [outcome]

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: Non-obvious rule

> Rationale: Why this rule exists and why these partitions matter

### Scenario: Partition C

Given [context]
When [action]
Then [outcome]

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR
```

### Scenario construction rules

Write each saved `Given/When/Then` to these rules — they head off at authoring time the defects the scenario-gate would otherwise catch later. Coaching, not a gate: when a scenario starts to break one, split it on the spot instead of accumulating violations.

- **One behavior, one `When`** — each scenario specifies a single event and its outcome. Multiple `And`-joined `Then` lines are fine when they assert facets of the _same_ outcome (a withdrawal that debits **and** dispenses **and** returns the card); a second `When`, or a second behavior, means a second scenario.
- **Outcome-oriented `Then`** — assert what is true after the `When`, never how the system gets there. "Then the order is rejected" ✓, not "Then `validateOrder()` returns false" ✗.
- **Declarative, business language** — name the intent, not the UI mechanics. "When the customer submits the order" ✓, not "When the user clicks `#submit` and waits 200ms" ✗. Reads as living documentation and survives implementation changes.
- **`Given` is state, not action** — establish the world, don't act in it. "Given the cart holds one item" ✓, not "Given the customer adds an item" ✗ (an action belongs in `When`).
- **No `or` in the `Then`** — one outcome per scenario; "returns 200 **or** 201" is two scenarios. For one behavior across many inputs, use a `Scenario Outline` with an `Examples` table, not copy-pasted scenarios.

Two of these rules mirror gate checks — **one behavior** is AODI's **Atomic**, and externally-observable outcomes are its **Observable** (both in the Scenario Quality Gate below). Author for them here; the gate still validates every scenario adversarially.

### Scenario naming: lineage scheme

Each saved `### Scenario:` title carries the acceptance criterion it proves, so the
link back to AC, JTBD, and persona is machine-checkable rather than eyeballed:

`<jtbd-id>.AC<#>.<scenario_name>` — `scenario_name` is snake_case; the rest is the
AC id from intake (`<slug>.<persona-code><JTBD#>.AC<#>`). Long ids are fine — no
truncation.

Worked example — feature `oauth-flow`, persona Platform Operator (PO), first JTBD:

| Layer    | Id                                                                 |
| -------- | ------------------------------------------------------------------ |
| JTBD     | `oauth-flow.PO1`                                                   |
| AC       | `oauth-flow.PO1.AC2`                                               |
| Scenario | `oauth-flow.PO1.AC2.change_association_applies_to_subsequent_auth` |

```text
### Scenario: oauth-flow.PO1.AC2.change_association_applies_to_subsequent_auth
```

A free-text title (no `<jtbd-id>.AC<#>` prefix) is left alone — it simply proves no
AC. `safeword check` reads the scheme and reports coverage gaps for in-progress
tickets as advisories (never a gate):

- **uncovered** — an AC in `spec.md` that no scenario references.
- **stale ref** — a scenario whose JTBD exists but whose `AC<#>` does not (a typo,
  or an AC that was renumbered).
- **orphan** — a scenario whose JTBD is absent from `spec.md` entirely.

### Define Behavior Exit (REQUIRED)

1. **Save scenarios** to `.safeword-project/tickets/{id}-{slug}/test-definitions.md`
2. **Update frontmatter:** `phase: scenario-gate`
3. **Add work log entry:**

   ```
   - {timestamp} Complete: define-behavior - {N} scenarios defined across {M} rules
   ```

---

## Scenario Quality Gate

**Entry:** Agent enters `scenario-gate` phase.

### Vacuous-pass test

Run this **first** — a scenario that would pass without the feature invalidates every check below it. Mentally delete the implementation and ask: _could this scenario still pass?_ If yes, it is vacuous: flag it and propose a stronger `Then`, not just a warning. (A good test is _behavioral_ — if the behavior changed, the result should change; a scenario that survives a deleted feature tests nothing.)

Common vacuous patterns, each with its fix:

- **Existence-only `Then`** ("a response is returned") → assert the actual value, not that _something_ came back.
- **Given-echo** ("Given a row with X exists … Then a read returns X") → that exercises the store, not the feature; assert something the feature must compute or change.
- **Trivially-true setup** — the `Given` already makes the `Then` true regardless of the `When` → move the real precondition out of the assertion.
- **Non-claim `Then`** ("the system remains running") → assert a falsifiable outcome the feature produces.

### AODI Validation

Validate each scenario against four criteria:

| Criterion         | Check                          | Red flag                        |
| ----------------- | ------------------------------ | ------------------------------- |
| **Atomic**        | Tests ONE behavior             | Multiple When/Then pairs        |
| **Observable**    | Has externally visible outcome | Internal state only             |
| **Deterministic** | Same result on repeated runs   | Time/random/external dependency |
| **Independent**   | No ordering dependency         | "After Scenario 2 runs..."      |

### Determinism risks

Sharpen AODI's **Deterministic** check with the patterns that actually flake in CI — each with its fix:

- **Time without a wait** — a `Then` that depends on elapsed time, or asserts an async result after a fixed delay → wait on an observable condition (poll/await the state), never a bare `sleep`.
- **Order-dependent comparison** — asserting an unordered collection as if it were ordered → sort, or compare as a set, before asserting.
- **Unsequenced concurrency** — a `Then` over concurrent operations with no stated ordering → assert on the settled end-state, or name the ordering guarantee the scenario relies on.

Assertion strength (weak vs strong `Then`) isn't repeated here — it is `testing` Iron Law 2, and the vacuous-pass check above already coaches a stronger `Then`.

### Adversarial pass

After AODI validation, argue against your own scenario list: "What breaks that none of these scenarios catch?" Present any findings to the user.

One lens to always run — **negative-case coverage**: for each happy-path scenario, is there a rejection-path counterpart? Partitioning should already have produced the invalid-input classes (equivalence partitioning covers invalid ranges, not only valid ones); this pass is the backstop. Common pairs — create ↔ duplicate, read ↔ not-found, update ↔ not-allowed, act ↔ precondition-failed. Treat a gap as **should-strengthen**, not must-fix — a sibling AC often already covers the rejection: _"Happy path X has no rejection counterpart — add a scenario for path Z?"_ For one behavior across many inputs, use a `Scenario Outline`.

### Cross-cutting checks

Five lenses across the whole scenario set (not per scenario) — each asks "what's missing?":

- **Conflict** — do two scenarios contradict (one allows X, another rejects it) with no distinguishing precondition?
- **Boundary** — zero / one / max / empty / null covered where they apply?
- **Failure** — external-dependency failures covered (timeout, 5xx, malformed, partition)? Distinct from the feature's own rejections (the negative-case lens above).
- **Security** — authn/authz failures and abuse vectors covered?
- **Persona consistency** — is each scenario's triggering persona clear, and would another persona experience it differently?

### Findings format

Report gate findings the way safeword talks to the user — lead with the answer, structure only because a multi-finding review earns it, end with the call:

- **Lead with a tally** — `**Findings:** N must-fix, M should-strengthen, P looks-good.`
- **Three tiers** — Must Fix (correctness/structure), Should Strengthen (clarity/specificity), Looks Good (specific acknowledgement, never padding).
- **One `####` per finding** with the scenario id + a short issue; under it, **Current** (quote the G/W/T, bold the offending phrase) → why → **Proposed** (the rewrite). Fix last, so the explanation reads as the answer, not justification.
- **Bulk** — when one pattern hits ≥3 scenarios: one header, an **Affected** id list, one **Representative** quote, one **Proposed pattern**.
- **End with `**Next:**`** — the single fix to start.

```text
**Findings:** 1 must-fix, 0 should-strengthen.

#### oauth.PO1.AC2.change_applies — Then joins two assertions with "and"
Current: "Then the config shows B and later auths use B" — two independent observables.
Proposed: "Then later authentications use User Source B."

**Next:** split the AC2 scenario, then re-run the gate.
```

### Coverage saturation

If the adversarial pass + user feedback produced new scenarios → loop back to define-behavior. If nothing new surfaced → done.

### Scenario Gate Exit (REQUIRED)

1. Each scenario passes the vacuous-pass test and AODI (Atomic, Observable, Deterministic, Independent)
2. Adversarial pass + cross-cutting checks complete; findings presented in the findings format (or confirmed clean)
3. **Assign test layers + sequence the work** — for each scenario pick the highest test layer that covers it with acceptable feedback speed (unit < integration < E2E), and order tasks so each builds on what's already green. For non-obvious slicing or data-model choices, run `/figure-it-out`; the architecture itself was already designed in intake. (Absorbed from the retired `decomposition` phase — see the ADR in `ARCHITECTURE.md`.)
4. **Update frontmatter:** `phase: implement`
5. **Add work log entry:**

   ```
   - {timestamp} Complete: scenario-gate - Scenarios validated (AODI) + adversarial pass; test layers + build order assigned
   ```
