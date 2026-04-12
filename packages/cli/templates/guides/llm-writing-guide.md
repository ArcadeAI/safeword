# LLM Writing Guide

How to write documentation that LLMs will read and follow: CLAUDE.md, SAFEWORD.md, guides, skills, commands, hooks.

---

## Core Principles

### 1. MECE (Mutually Exclusive, Collectively Exhaustive)

Decision trees must have no overlap and cover all cases.

```markdown
❌ BAD - Overlapping:
├─ Pure function?
├─ Multiple components?
├─ Full user flow?

✅ GOOD - Sequential, stop at first match:

1. AI content quality? → LLM Eval
2. Requires real browser? → E2E test
3. Multiple components? → Integration test
4. Pure function? → Unit test
```

### 2. Explicit Over Implicit

Define all terms. Never assume LLMs know what you mean.

```markdown
❌ BAD: "Test at the lowest level"
✅ GOOD: "Test with the fastest test type that can catch the bug"

Define: "Critical paths" → auth, payment (always); UI polish (rarely)
Define: "Browser" → Real browser (Playwright), not jsdom
```

### 3. Concrete Examples Over Abstract Rules

For every rule, include 2-3 good vs bad examples. Use 3-5 diverse, relevant examples — not exhaustive edge cases.

```markdown
❌ BAD: "Follow best practices for testing"

✅ GOOD:
// ❌ Testing business logic with E2E (slow)
test('discount', async ({ page }) => { await page.goto('/checkout')... })

// ✅ Unit test (fast)
it('applies 20% discount', () => { expect(calculateDiscount(100, 0.20)).toBe(80) })
```

### 4. Edge Cases Must Be Explicit

After stating a rule, add edge cases.

```markdown
Rule: "Unit test pure functions"

Edge cases:

- Math.random(), Date.now() → Unit test with mocked randomness/time
- process.env dependencies → Integration test
- Mixed pure + I/O → Extract pure part, unit test separately
```

### 5. No Contradictions

Different sections must align. Grep for related terms when updating.

```markdown
❌ Section A: "E2E tests only for critical paths"
Section B: "All user-facing features have E2E tests"

✅ Both sections use same definition of "critical"
```

### 6. Use XML Tags for Structure

Structure complex prompts with XML tags for unambiguous parsing.

```markdown
❌ BAD: Instructions mixed with context and examples in flat text

✅ GOOD:
<instructions>
Write a function that validates email addresses.
</instructions>

<context>
The system uses RFC 5322 validation.
</context>

<example>
Input: "user@example.com" → Output: true
Input: "not-an-email" → Output: false
</example>
```

Tags: `<instructions>`, `<context>`, `<input>`, `<example>`, `<document>`.

### 7. Keep Context Lean

Structure prompts carefully with large inputs. Find the smallest set of high-signal tokens that maximize the desired outcome. Don't front-load entire reference documents — load dynamically when needed.

```markdown
❌ BAD: Load 3 guide files before every task (800+ lines of context)
✅ GOOD: Reference guides by path, consult for specific questions
```

Maintain lightweight identifiers (file paths, URLs) and load content just-in-time rather than pre-loading everything.

---

## Decision Tree Patterns

### Sequential Over Parallel

Structure as ordered steps, not simultaneous checks.

```markdown
❌ BAD - Parallel:
├─ Pure function?
├─ Multiple components?
└─ Full user flow?

✅ GOOD - Sequential:
Answer IN ORDER, stop at first match:

1. Pure function? → Unit
2. Multiple components? → Integration
3. Full user flow? → E2E
```

### Tie-Breaking Rules

When multiple options apply, tell LLMs how to choose.

```markdown
"If multiple test types can catch the bug, choose the fastest one."
```

### Lookup Tables for Complex Decisions

When 3+ branches exist, provide a table.

```markdown
| Bug Type          | Unit? | Integration? | E2E? | Best Choice    |
| ----------------- | ----- | ------------ | ---- | -------------- |
| Calculation error | ✅    | ✅           | ✅   | Unit (fastest) |
| Database bug      | ❌    | ✅           | ✅   | Integration    |
| CSS layout broken | ❌    | ❌           | ✅   | E2E            |
```

---

## Document Structure

### Document Placement for Optimal Comprehension

LLMs retain beginning and end better than middle. For long documents (20K+ tokens), place the document at the top of the prompt with queries below — this can improve performance up to 30% on complex queries.

| ❌ BAD                    | ✅ GOOD                  |
| ------------------------- | ------------------------ |
| Background (100 lines)    | Background (100 lines)   |
| Details (200 lines)       | Details (200 lines)      |
| **Critical Rules ← lost** | Appendix (50 lines)      |
| Appendix (50 lines)       | **Key Takeaways ← kept** |

**Rule:** Put critical content at the END of documents. Place large reference documents at the TOP of prompts with instructions below.

### Re-evaluation Paths

Provide concrete next steps for dead ends.

```markdown
❌ BAD: "If none apply, re-evaluate"

✅ GOOD: "If doesn't fit categories:

1. Break it down: Separate pure logic from I/O/UI
2. Test each piece: Pure → Unit, I/O → Integration, Multi-page → E2E"
```

---

## Anti-Patterns

| Don't                                         | Why                                                                  |
| --------------------------------------------- | -------------------------------------------------------------------- |
| Visual metaphors (pyramids, icebergs)         | LLMs don't process visuals                                           |
| Undefined jargon                              | "Technical debt" needs definition                                    |
| Percentages without context                   | "70/20/10" meaningless without adjustment guidance                   |
| Caveats in tables                             | Parentheticals break pattern matching                                |
| Critical info in middle                       | Lost-in-middle phenomenon                                            |
| Aggressive emphasis ("CRITICAL", "IMPORTANT") | Newer models overtrigger on emphasis — use specific, normal language |
| Front-loading entire reference docs           | Context quality degrades with token count                            |

---

## Quality Checklist

- [ ] Decision trees: MECE, sequential, with tie-breakers
- [ ] All terms explicitly defined
- [ ] Every rule has good vs bad examples
- [ ] Edge cases covered
- [ ] No contradictions between sections
- [ ] Complex decisions have lookup tables
- [ ] Dead-end paths have re-evaluation steps
- [ ] Critical rules at END of documents
- [ ] Context is lean — no unnecessary pre-loading
- [ ] XML tags used for complex prompt structure

---

## Key Takeaways

- Decision trees: sequential, MECE, with tie-breakers
- Every rule needs concrete examples (good vs bad)
- Define all terms explicitly — assume nothing is obvious
- Put critical rules at the END of documents
- Keep context lean — load just-in-time, not upfront
- Use XML tags for complex prompt structure
- Use specific, normal language — not aggressive emphasis
