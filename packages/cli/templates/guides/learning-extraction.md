# Learning Extraction

Extract reusable knowledge from debugging sessions and implementation discoveries. Apply `@.safeword/guides/llm-writing-guide.md` principles when writing learning files.

---

## When to Extract (Recognition Triggers)

Extract after experiencing ANY of these:

1. **Observable debugging complexity** — 5+ debug cycles, 3+ error states, or 3+ files modified while debugging same issue
2. **Trial and error** — 3+ approaches tried before finding the right one
3. **Undocumented gotcha** — Not in official library/framework docs
4. **Integration struggle** — Two tools that don't work together smoothly
5. **Testing trap** — Tests pass but UX is broken (or vice versa)
6. **Architectural insight** — Discovered during implementation, not planned upfront

**Key question:** "Would this save time on future work in this codebase?"

---

## File Locations

**Project learnings** (`.safeword-project/learnings/[concept].md`):
Forward-looking patterns that apply to 2+ features. Shared via git.

**Historical archives** (`.safeword-project/learnings/archive/[bug-fix].md`):
One-time debugging narratives. Reference when similar bugs occur.

**Precedence:**

1. Explicit user instruction (highest priority)
2. Project `.safeword-project/learnings/` (project-specific)
3. Project `./SAFEWORD.md` → Common Gotchas (inline reference)

**Discoverability:** Every learnings file should start with a one-line "Covers:" summary after the title. Agents discover learnings via `ls` + filename — the summary enables fast relevance decisions.

---

## Decision Tree

```text
Just learned something valuable
│
├─ Forward-looking? (useful on FUTURE work, not just this bug)
│  ├─ YES → Continue
│  └─ NO → .safeword-project/learnings/archive/[bug-fix].md (optional)
│
├─ Choose destination:
│  │
│  ├─ Architectural? (why we chose X over Y)
│  │  └─ YES → Add to: SAFEWORD.md "Architecture Decisions"
│  │
│  ├─ Short gotcha? (1-2 sentences + code snippet)
│  │  └─ YES → Add to: SAFEWORD.md "Common Gotchas"
│  │
│  └─ Needs examples/explanation?
│     └─ YES → Extract to: .safeword-project/learnings/[concept].md
│        Then cross-reference in SAFEWORD.md
```

---

## Templates

### Forward-Looking Learning (.safeword-project/learnings/)

**Use when:** Pattern applies to 2+ features/files, needs explanation

```markdown
# [Concept Name]

Covers: [one-line topic summary for discoverability]

**Principle:** One-sentence summary

## The Gotcha

What breaks if you don't know this:

❌ **Bad:** [Anti-pattern]
✅ **Good:** [Correct pattern]

**Why it matters:** [User impact or technical consequence]

## Examples

[2-3 concrete before/after code examples]

## Reference

See `.safeword-project/learnings/archive/[investigation].md` for full debugging narrative.
```

### Debugging Narrative (.safeword-project/learnings/archive/)

**Use when:** One-time bug fix, historical record

````markdown
# [Issue Title]

**Date:** YYYY-MM-DD
**Root Cause:** One-sentence explanation

## Problem

Expected: [What should happen]
Actual: [What happened]

## Investigation

1. [Hypothesis] → [Outcome]
2. [Hypothesis] → [Outcome]
3. [Discovery] → [Fix]

## Solution

```diff
- Old broken code
+ New fixed code
```

## Lesson

[One-sentence takeaway]
````

---

## SAFEWORD.md Integration

After extracting to `.safeword-project/learnings/`, add cross-reference in SAFEWORD.md:

**Pattern:** Bold name + one-sentence summary + link to file

```markdown
## Common Gotchas

- **YAML Parsing** - Use failsafe schema to preserve leading-zero IDs → `.safeword-project/learnings/yaml-and-quality-gates.md`
```

---

## Don't Extract

| Signal                          | Example                           |
| ------------------------------- | --------------------------------- |
| In official docs                | "React useState is async"         |
| One-line fix, no principle      | Changed `==` to `===`             |
| Implementation without insight  | "File X uses pattern Y"           |
| Opinion without justification   | "Prefer tabs over spaces"         |
| Steps without lesson            | "Tried 5 things, #4 worked"       |
| Mid-debugging (unconfirmed fix) | Wait until fix is verified        |
| Obsolete technology             | Webpack 4 gotchas when using Vite |
