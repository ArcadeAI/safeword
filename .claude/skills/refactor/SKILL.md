---
name: refactor
description: Improve code structure without changing behavior. Use when
  refactoring, restructuring, simplifying, or extracting code. Also for reducing
  duplication, renaming for clarity, or addressing code smells. Enforces one
  change → test → commit cycle. NOT for style/formatting (use /lint), features,
  or bug fixes.
allowed-tools: '*'
---

# Refactoring

Improve code structure without changing behavior. One small step at a time.

**Iron Law:** ONE REFACTORING → TEST → COMMIT. Never batch changes.

## When to Use

Answer IN ORDER. Stop at first match:

1. User says "refactor", "clean up", "restructure"? → Use this skill
2. User asks to "extract", "rename", "simplify"? → Use this skill
3. Code smell identified? → Use this skill
4. User wants to add feature or fix bug? → Skip (use tdd-enforcer)
5. User wants formatting/style fixes? → Skip (use /lint)

**Code smells** (common triggers):

- Duplicated code (same logic in multiple places)
- Long function (>30 lines, doing too much)
- Magic numbers/strings (unexplained literals)
- Deep nesting (>3 levels of indentation)
- Dead code (unused functions, unreachable branches)
- Poor naming (unclear what something does)
- Wrong level of abstraction (special cases piled on shared infrastructure instead of a generalized mechanism; detect via _shotgun surgery_ — one logical change forces edits in many places)

**Scout first.** Default for any multi-smell or unnamed request ("clean this up", "tidy this module"). Skip it only when the user named one specific smell — then go straight to Phase 3 with a one-entry ledger.

Discovery is the one phase that may **fan out**. Sweep in independent read-only passes — `/lint` + `/audit` for the mechanical smells (long function, deep nesting, magic literals, duplication, dead code — already detected there), plus separate judgment passes for the semantic ones (reuse / duplicated intent, wrong level of abstraction). Per smell category or per module these passes are independent, so run them concurrently (sub-agents where your harness supports it) and merge the findings — the same fan-out-then-merge shape as `deep-research` and `quality-review`.

Merge into a **ledger**, not a loose list: each entry is a smell + location, ordered _prioritized and dependency-aware_ — leaf-first, so no fix lands before the change it depends on (the Mikado ordering). Persist it as the Phase 5 checklist and never silently truncate — if you cap it, say what you dropped. A scout that reads as "nothing else" when it truncated is a bug.

---

## Phase 1: ASSESS

**Is this actually refactoring?**

| User Intent         | Action                                          |
| ------------------- | ----------------------------------------------- |
| "Make this cleaner" | ✓ Refactoring                                   |
| "Add validation"    | ✗ New behavior → tdd-enforcer                   |
| "Fix this bug"      | ✗ Bug fix → tdd-enforcer or systematic-debugger |
| "Format this code"  | ✗ Style → /lint                                 |

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

**Iron Law:** ONE refactoring at a time. Run tests after EVERY change.

**Discovery fans out; mutation never does.** The scout (Phase 1) may run parallel read-only passes. Execution is the opposite — one change, in isolation, then test, then commit — because the safety net lives here. Parallel or batched edits forfeit the revert protocol (Phase 4), break `git bisect`, and destroy single-change test attribution: you can no longer tell which edit turned the suite red. The Iron Law is **per-edit, not per-session** — you still work through every ledger entry (Phase 5), just one at a time.

### Refactoring Catalog

**Tier 1 - Always Safe** (no behavior change possible):

| Smell                | Refactoring          | Example                                |
| -------------------- | -------------------- | -------------------------------------- |
| Unclear name         | **Rename**           | `d` → `discountAmount`                 |
| Long function        | **Extract Function** | Pull 10 lines into `calculateTax()`    |
| Unnecessary variable | **Inline Variable**  | Remove `temp = x; return temp;`        |
| Misplaced code       | **Move Function**    | Move `validate()` to `Validator` class |

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

| Smell                      | Refactoring                    | Caution                                                                                                                    |
| -------------------------- | ------------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| God class                  | **Extract Class**              | Do incrementally, move one method at a time                                                                                |
| Type-checking conditionals | **Replace with Polymorphism**  | Requires class hierarchy                                                                                                   |
| Too many parameters        | **Introduce Parameter Object** | Changes function signature                                                                                                 |
| Complex loop               | **Replace Loop with Pipeline** | Ensure equivalent behavior                                                                                                 |
| Wrong level of abstraction | **Generalize the Mechanism**   | Replace the special-case pile with one general path; pull the abstraction to the right altitude — don't add another branch |

**Tie-breaker:** If multiple refactorings apply, choose smallest scope first (Rename < Extract Variable < Extract Function < Extract Class).

---

## Phase 4: VERIFY

After each refactoring:

1. **Run tests** - Must pass
2. **Regression checklist** (tests can miss these) - did the change silently drop a guard/anchor an extract or move was carrying, introduce setup/teardown asymmetry in a test, give a predicate method a side effect, or flip a config default? If any, fix or revert before continuing.
3. **If tests pass (and the checklist is clean):** Commit with `refactor: [what changed]`
4. **If tests fail:** Revert immediately

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
    ├─ Run `/audit` to verify no dead code or new issues
    └─ Report: "Refactoring complete. Resolved: [ledger summary]. Deferred: [items + why]."
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
- Ask user: "Found potential bug at X. Fix it now (switching to tdd-enforcer) or continue refactoring?"

**User requests large refactoring:**

- Break into steps: "I'll refactor this incrementally. First: [step 1]"
- Complete each step fully before next
- Never batch multiple refactorings in one edit

---

## Anti-Patterns

| Don't                           | Do                                    |
| ------------------------------- | ------------------------------------- |
| Batch multiple refactorings     | One refactoring → test → commit       |
| "Fix" a failed refactoring      | Revert, then try smaller step         |
| Refactor without tests          | Add characterization tests first      |
| Change behavior during refactor | That's a feature/fix, not refactoring |
| Skip the commit                 | Commit after every green test         |

---

## Key Takeaways

1. **One change at a time** - Never batch refactorings
2. **Tests before refactoring** - No safety net = no refactoring
3. **Revert on failure** - Don't fix, revert and retry smaller
4. **Commit after each success** - `refactor: [description]`
5. **Smallest scope first** - Rename < Extract < Move < Restructure
6. **Audit when done** - Run `/audit` to verify no dead code or new issues
