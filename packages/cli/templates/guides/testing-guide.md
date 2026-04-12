# Testing Guide

Test type selection, patterns, and strategies. For iron laws and anti-patterns, see the testing skill (auto-triggered when writing tests).

---

## Test Integrity

**NEVER modify, skip, or delete tests without explicit human approval.**

Tests are the specification. When a test fails, the implementation is wrong — not the test.

| Forbidden action                                | Why                               |
| ----------------------------------------------- | --------------------------------- |
| Changing assertions to match broken code        | Hides bugs instead of fixing them |
| Adding `.skip()`, `.only()`, `xit()`, `.todo()` | Makes failures invisible          |
| Deleting tests you can't get passing            | Removes coverage for edge cases   |
| Weakening assertions (`toBe` → `toBeTruthy`)    | Reduces test precision            |

**What to do instead:** Fix the implementation. If the test seems wrong, explain why and ask before updating.

---

## Test Type Selection

Prefer the highest scope that covers the behavior with acceptable feedback speed. The right test type depends on your stack:

- **Frontend/web** — integration-heavy (Testing Trophy)
- **Backend/libraries** — unit-heavy for pure logic, integration for boundaries
- **Full-stack features** — E2E for critical user flows

### Decision Tree

Answer in order. Stop at first match.

```text
1. Does this test AI-generated content quality?
   └─ YES → LLM Evaluation

2. Does this require a real browser (Playwright/Cypress)?
   └─ YES → E2E test

3. Does this test interactions between multiple components/services?
   └─ YES → Integration test

4. Does this test a pure function (input → output, no I/O)?
   └─ YES → Unit test

5. Re-evaluate: What are you actually testing?
```

**Edge cases:**

- Non-deterministic functions (Math.random, Date.now) → Unit test with mocked randomness
- Functions with environment dependencies (process.env) → Integration test
- Mixed pure + I/O logic → Extract pure logic, unit test it, integration test I/O

---

## Bug Detection Matrix

Which test type catches which bug?

| Bug Type                             | Unit? | Integration? | E2E? | Best Choice     |
| ------------------------------------ | ----- | ------------ | ---- | --------------- |
| Calculation error                    | ✅    | ✅           | ✅   | Unit (fastest)  |
| Invalid input handling               | ✅    | ✅           | ✅   | Unit (fastest)  |
| Database query returning wrong data  | ❌    | ✅           | ✅   | Integration     |
| API endpoint contract violation      | ❌    | ✅           | ✅   | Integration     |
| Race condition between services      | ❌    | ✅           | ✅   | Integration     |
| State management bug                 | ❌    | ✅           | ✅   | Integration     |
| React component rendering wrong data | ❌    | ✅           | ✅   | Integration     |
| CSS layout broken                    | ❌    | ❌           | ✅   | E2E (only)      |
| Multi-page navigation broken         | ❌    | ❌           | ✅   | E2E (only)      |
| Browser-specific rendering           | ❌    | ❌           | ✅   | E2E (only)      |
| AI prompt quality degradation        | ❌    | ❌           | ❌   | LLM Eval (only) |

---

## Testing Technical Constraints

User stories may include technical constraints. Map each to the appropriate test type:

| Constraint Category | Test Type                  | What to Verify                                |
| ------------------- | -------------------------- | --------------------------------------------- |
| Performance         | Load/timing tests          | Response times, throughput, capacity          |
| Security            | Security tests             | Input sanitization, auth, rate limiting       |
| Compatibility       | Cross-browser/device tests | Browser versions, mobile, accessibility       |
| Data                | Compliance tests           | Retention, deletion, privacy rules            |
| Dependencies        | Integration tests          | Required services work, no forbidden packages |
| Infrastructure      | Resource tests             | Memory limits, offline behavior               |

---

## Test Type Examples

### Unit Tests

```typescript
// ✅ GOOD - Pure function, behavioral assertion
it('applies 20% discount for VIP users', () => {
  expect(calculateDiscount(100, { tier: 'VIP' })).toBe(80);
});
```

### Integration Tests

```typescript
it('updates character state after agent processes action', async () => {
  const agent = new GameAgent();
  const store = useGameStore.getState();

  await agent.processAction('attack guard');

  expect(store.character.stress).toBeGreaterThan(0);
  expect(store.messages).toHaveLength(2);
});
```

### E2E Tests

```typescript
test('user creates account and first item', async ({ page }) => {
  await page.goto('/signup');
  await page.fill('[name="email"]', 'test@example.com');
  await page.fill('[name="password"]', 'secure123');
  await page.click('button:has-text("Sign Up")');
  await expect(page).toHaveURL('/dashboard');
});
```

### LLM Evaluations

Use tiered evaluation — deterministic checks first, LLM-as-judge second:

```yaml
- description: 'Infer user intent from casual input'
  vars:
    input: 'I want to order a large pepperoni'
  assert:
    # Tier 1: Deterministic (cheap, every commit)
    - type: javascript
      value: JSON.parse(output).intent === 'order_pizza'
    # Tier 2: LLM-as-judge (expensive, PR/schedule only)
    - type: llm-rubric
      value: |
        PASS: Correctly identifies pizza order, confirms size and type
        FAIL: Wrong intent, ignores key details, or generic response
```

**Cost:** $0.01-0.30 per run. Prompt caching reduces by 90%. Run full evals on PR/schedule, not every commit.

---

## E2E Testing with Persistent Dev Servers

Isolate persistent dev instances from test instances to avoid port conflicts.

- **Dev instance**: Project's configured port (e.g., 3000) — runs persistently
- **Test instances**: `devPort + 1000` (e.g., 4000) — managed by Playwright

```typescript
// playwright.config.ts
export default defineConfig({
  webServer: {
    command: 'bun run dev:test',
    port: 4000,
    reuseExistingServer: !process.env.CI,
  },
});
```

**Cleanup:** See `.safeword/guides/zombie-process-cleanup.md` for killing zombie servers.

---

## TDD Workflow

For task-level TDD (RED → GREEN → REFACTOR), see `.claude/skills/bdd/TDD.md`.

**Escalation check:** If during implementation you discover 3+ files need changes, multiple user flows are affected, or new state management is needed — escalate to `/bdd`.

---

## What Not to Test

- **Implementation details** — Private methods, CSS classes, internal state
- **Third-party libraries** — Assume React/Axios work, test YOUR code
- **Trivial code** — Getters/setters with no logic, pass-through functions
- **UI copy** — Use regex `/submit/i`, not exact text matching

---

## Coverage Goals

Focus on behavioral coverage, not numerical targets. High coverage with mocks = false confidence.

- **Critical paths** — auth, payment, data loss scenarios → always covered
- **Core workflows** — primary feature flows → usually covered
- **Edge cases** — empty input, boundary values, error paths → covered where bugs are likely

**Rule of thumb:** If it breaks, would users notice immediately? If yes, it needs a test.

---

## CI/CD Integration

- Unit + integration → every commit (fast feedback)
- E2E → every PR
- LLM evals → schedule (weekly catches regressions without per-commit cost)
