---
name: refactor
description: Improve code structure without changing behavior. Use when
  refactoring, restructuring, simplifying, or extracting code. Also for reducing
  duplication, renaming for clarity, or addressing code smells. Enforces one
  change → test → commit when the commit can stay scoped. NOT for
  style/formatting (use /lint), features, or bug fixes.
---

# Refactoring

Improve code structure without changing behavior. One small step at a time.

Work one refactoring at a time: change, test, commit. Don't batch changes.

## When to Use

Use when the user says "refactor", "clean up", "restructure", "extract",
"rename", or "simplify", or when you've identified a code smell. Skip for adding
a feature or fixing a bug (use tdd-enforcer) and for formatting/style fixes (use
$safeword:lint).

**Code smells** (common triggers):

- Duplicated code (same logic in multiple places)
- Long function (>30 lines, doing too much)
- Magic numbers/strings (unexplained literals)
- Deep nesting (>3 levels of indentation)
- Dead code (unused functions, unreachable branches)
- Poor naming (unclear what something does)
- Wrong level of abstraction (special cases piled on shared infrastructure instead of a generalized mechanism; detect via _shotgun surgery_ — one logical change forces edits in many places)

**Scout first.** Default for any multi-smell or unnamed request ("clean this up", "tidy this module"). Skip it only when the user named one specific smell — then go straight to Phase 3 with a one-entry ledger.

Discovery is the one phase that may **fan out**. Sweep in independent read-only passes — `$safeword:lint` + `$safeword:audit` for the mechanical smells (long function, deep nesting, magic literals, duplication, dead code — already detected there), plus separate judgment passes for the semantic ones (reuse / duplicated intent, wrong level of abstraction). Per smell category or per module these passes are independent, so run them concurrently (sub-agents where your harness supports it) and merge the findings — the same fan-out-then-merge _shape_ as `quality-review`'s independent reviewer passes. The **model policy differs**, though: these are discovery passes, not reviews of your own work, so `quality-review`'s _no-weaker_ reviewer rule does **not** apply — you (the orchestrator) verify the merged ledger. Spread the passes across smells/modules; cheaper or varied models are fine. _Coverage_ diversity is the lever here, not model tier.

Merge into a **ledger**, not a loose list: each entry is a smell + location, ordered _prioritized and dependency-aware_ — leaf-first, so no fix lands before the change it depends on (the Mikado ordering). Persist it as the Phase 5 checklist and never silently truncate — if you cap it, say what you dropped. A scout that reads as "nothing else" when it truncated is a bug.

---

## Phase 1: ASSESS

**Is this actually refactoring?**

| User Intent         | Action                                          |
| ------------------- | ----------------------------------------------- |
| "Make this cleaner" | ✓ Refactoring                                   |
| "Add validation"    | ✗ New behavior → tdd-enforcer                   |
| "Fix this bug"      | ✗ Bug fix → tdd-enforcer or systematic-debugger |
| "Format this code"  | ✗ Style → $safeword:lint                        |

**If not refactoring:** Explain and suggest correct approach.

---

## Phase 2: PROTECT

**Does the code have tests?**

| Coverage         | Action                                        |
| ---------------- | --------------------------------------------- |
| Well-tested      | Skip to Phase 3                               |
| Partial coverage | Add characterization tests for untested parts |
| No tests         | Add characterization tests first              |

**When writing characterization tests:** Characterization tests are still tests — apply behavioral testing principles (assert on what the system does, not how).

**If the code can't be exercised under test** (hard-wired dependencies, no instantiation point): introduce a _seam_ first — the smallest dependency-break that lets a test run — then characterize. That seam is itself a Tier-3 refactoring; make it under whatever coverage exists, in its own step. (Feathers, _Working Effectively with Legacy Code_.)

### Characterization Tests

Capture current behavior before refactoring:

```typescript
// Characterization test - captures ACTUAL behavior
it('processOrder returns current behavior', () => {
  const result = processOrder({ items: [], user: null });
  // Whatever it returns NOW is the expected value
  expect(result).toEqual({ status: 'empty', total: 0 });
});
```

**Purpose:** Safety net, not specification. Test what the code DOES, not what it SHOULD do.

---

## Phase 3: REFACTOR

One refactoring at a time; run tests after every change.

**Discovery fans out; mutation never does.** The scout step (in "When to Use", above) may run parallel read-only passes. Execution is the opposite — one change, in isolation, then test, then commit — because the safety net lives here. Parallel or batched edits forfeit the revert protocol (Phase 4), break `git bisect`, and destroy single-change test attribution: you can no longer tell which edit turned the suite red. The one-change rule is **per-edit, not per-session** — you still work through every ledger entry (Phase 5), just one at a time.

### Refactoring Catalog

**Tier 1 - Lowest Risk** (behavior-preserving _when references are complete_):

| Smell                | Refactoring          | Example                                |
| -------------------- | -------------------- | -------------------------------------- |
| Unclear name         | **Rename**           | `d` → `discountAmount`                 |
| Long function        | **Extract Function** | Pull 10 lines into `calculateTax()`    |
| Unnecessary variable | **Inline Variable**  | Remove `temp = x; return temp;`        |
| Misplaced code       | **Move Function**    | Move `validate()` to `Validator` class |

> Not "behavior change impossible" — each has a failure mode when references or
> context are incomplete: **Rename** breaks exported/public-API names, string or
> reflection/serialized references, and tests that assert on the name; **Inline
> Variable** changes behavior if the variable captured a once-computed value but
> the expression is side-effecting or re-evaluated (e.g. inlining `const now =
Date.now()` used twice); **Move Function** can shift `this`/closure binding or
> introduce import-cycle / load-order effects (the `validate()` → class example
> above changes `this`). Verify _all_ references before calling any of these done.
> Only **Extract Function** is near-unconditionally safe.

```typescript
// ❌ Before: unclear name
const d = price * 0.2;

// ✅ After: Rename
const discountAmount = price * 0.2;
```

**Tier 2 - Safe with Tests** (low risk if tests exist):

| Smell               | Refactoring               | Example                                           |
| ------------------- | ------------------------- | ------------------------------------------------- |
| Repeated expression | **Extract Variable**      | `order.items.length > 0` → `const hasItems = ...` |
| Complex conditional | **Decompose Conditional** | Extract `if` branches to named functions          |
| Nested conditionals | **Guard Clauses**         | Early returns instead of deep nesting             |
| Magic literal       | **Replace Magic Literal** | `0.2` → `VIP_DISCOUNT_RATE`                       |
| Unused code         | **Remove Dead Code**      | Delete unreachable branches                       |

```typescript
// ❌ Before: nested conditionals
function getDiscount(user) {
  if (user) {
    if (user.isVIP) {
      return 0.2;
    } else {
      return 0.1;
    }
  }
  return 0;
}

// ✅ After: Guard Clauses
function getDiscount(user) {
  if (!user) return 0;
  if (user.isVIP) return 0.2;
  return 0.1;
}
```

**Tier 3 - Requires Care** (higher risk, break into smaller steps):

| Smell                      | Refactoring                                                                                                                                   | Caution                                                                                                                    |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| God class                  | **Extract Class**                                                                                                                             | Do incrementally, move one method at a time                                                                                |
| Type-checking conditionals | **Replace with Polymorphism**                                                                                                                 | Requires class hierarchy                                                                                                   |
| Too many parameters        | **Introduce Parameter Object**                                                                                                                | Changes function signature                                                                                                 |
| Complex loop               | **Replace Loop with Pipeline**                                                                                                                | Ensure equivalent behavior                                                                                                 |
| Wrong level of abstraction | **Generalize the Mechanism** _(a design move, not one catalog refactoring — sequence it as Extract / Move / Inline steps, each its own edit)_ | Replace the special-case pile with one general path; pull the abstraction to the right altitude — don't add another branch |

**Tie-breaker:** If multiple refactorings apply, choose smallest scope first (Rename < Extract Variable < Extract Function < Extract Class).

---

## Phase 4: VERIFY

After each refactoring:

1. **Run tests** - Must pass
2. **Regression checklist** (tests can miss these) - did the change silently drop a guard or anchor that an extract or move was carrying, introduce setup/teardown asymmetry in a test, give a predicate method a side effect, or flip a config default? If any, fix or revert before continuing.
3. **If tests pass (and the checklist is clean):** Run the commit safety check below, then commit with `refactor: [what changed]` only when the commit can stay scoped.
4. **If tests fail:** Revert immediately

### Commit Safety Check

Before committing a green refactor, inspect `git status --short --branch` and
the files changed by this refactor.

Choose exactly one outcome:

- **clean branch** — if the branch is named and the only changes are this
  refactor plus its required tests/generated mirrors, commit with
  `refactor: [what changed]`.
- **mixed dirty tree** — if pre-existing feature or user changes are present,
  commit only the isolated refactor files when they can be staged without
  unrelated work. If isolation is not obvious, do not create a mixed
  feature+refactor commit; defer the commit, report why, and leave unrelated
  work untouched.
- **detached HEAD** — create or switch to a branch before committing. If branch
  creation would disturb the user's state or unrelated work is already present,
  defer the commit and report the exact branch/worktree reason.

Deferring a commit is not skipping the one-change rule; it is preserving the same
single-change attribution that rule exists to protect.

### Revert Protocol

```bash
git checkout -- <changed-files>
```

**After revert:**

- Was the refactoring too large? → Try smaller step
- Did it accidentally change behavior? → Reconsider approach
- DO NOT attempt to "fix" a failed refactoring

### After 2 Failed Attempts

**STOP.** Ask user:

> "I've attempted this refactoring twice and tests keep failing. This suggests either:
>
> 1. The refactoring is too large (need smaller steps)
> 2. The code has hidden dependencies
> 3. Tests are brittle
>
> How would you like to proceed?"

---

## Phase 5: ITERATE

Walk the scout ledger **leaf-first**. Each entry gets its own Phase 3 → Phase 4 cycle; mark it done (or struck, with a reason) before starting the next. The ledger is the completeness contract — you stop when every entry is resolved or explicitly deferred, not when you're tired of the diff. Don't let an unfinished ledger read as "nothing left."

```text
Ledger entries remaining?
├─ Yes → take next leaf-first entry → Phase 3 (one refactoring) → Phase 4 → mark done
└─ No → Done
    ├─ Run `$safeword:audit` to verify no dead code or new issues
    └─ Report what was resolved and what was deferred (with reasons)
```

A single-named-smell request has a one-entry ledger — resolve it, audit, done.

**Audit catches:** Dead code left behind, new duplication (should decrease!), architecture violations.

---

## Edge Cases

**Partial test coverage:**

- Identify which functions are tested vs untested
- Add characterization tests only for code you're about to refactor
- Don't boil the ocean - test what you touch

**Refactoring reveals a bug:**

- STOP refactoring
- Note the bug location
- Ask the user whether to fix it now (switching to tdd-enforcer) or continue refactoring

**User requests large refactoring:**

- Break it into steps and name the first one before starting
- Complete each step fully before next
- Never batch multiple refactorings in one edit

---

## Anti-Patterns

| Don't                                  | Do                                                            |
| -------------------------------------- | ------------------------------------------------------------- |
| Batch multiple refactorings            | One refactoring → test → commit                               |
| "Fix" a failed refactoring             | Revert, then try smaller step                                 |
| Refactor without tests                 | Add characterization tests first                              |
| Change behavior during refactor        | That's a feature/fix, not refactoring                         |
| Create a mixed feature+refactor commit | Commit only an isolated refactor, or defer with the reason    |
| Skip a safe commit                     | Commit after every green test when the commit can stay scoped |
