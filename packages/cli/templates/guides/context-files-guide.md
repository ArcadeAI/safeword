# Project Context Files (CLAUDE.md, CURSOR.md, AGENTS.md)

## What Each Tool Loads

- **Claude Code** loads `CLAUDE.md` natively. Import `AGENTS.md` via `@AGENTS.md` if using both tools.
- **Cursor** loads `CURSOR.md` and `.cursorrules` natively.
- **AGENTS.md** is tool-agnostic — useful when multiple agents share context.

## Claude Code Context Layers

Beyond CLAUDE.md, Claude Code provides:

- **`.claude/rules/`** — path-scoped rules (load only when matching files open)
- **`.claude/skills/`** — on-demand knowledge (loaded when invoked, not always-on)
- **`/init`** — auto-generates starter CLAUDE.md from your codebase
- **Auto-memory** — Claude learns from corrections across sessions

For line counts, imports, modular structure, and include/exclude guidance, follow Claude Code's Best Practices and Memory documentation.

## When to Create

**Root file:** Every project gets one (CLAUDE.md, CURSOR.md, or AGENTS.md).

**Subdirectory files** (e.g., `tests/AGENTS.md`) — create when:

- 3+ unique rules that don't fit in root
- Working in that directory needs specialized context
- Skip if directory is straightforward or already covered in root

**Design implication:** Subdirectory files should assume root context is available. Reference root, don't duplicate.

---

## SAFEWORD Trigger (Required)

Every project-level context file must start with:

```markdown
**⚠️ ALWAYS READ FIRST:** `.safeword/SAFEWORD.md`

The SAFEWORD.md file contains core development patterns, workflows, and conventions.
Read it BEFORE working on any task in this project.
```

---

## File Structure Pattern

```plaintext
project/
├─ SAFEWORD.md                  # Project context (references guides)
├─ CLAUDE.md                    # Claude-specific context
├─ CURSOR.md                    # Cursor-specific context (optional)
└─ tests/AGENTS.md              # Test conventions (cross-agent)
```

**Modular approach:** Keep main file under 200 lines. Use `@path` imports for modularity.

```markdown
@docs/architecture.md
@docs/conventions.md
```

---

## Anti-Patterns

❌ **Redundancy between root and subdirectory files** — each fact stated exactly once

❌ **Implementation details in root** — file paths with line numbers, directory trees, feature status lists

❌ **Testing sections in non-test files** — testing philosophy and commands belong in tests/AGENTS.md

❌ **User-facing documentation** — setup instructions, feature lists, API docs belong in README.md

❌ **Generic advice** — "use TypeScript", "follow best practices", "write tests" (say WHICH tests for WHAT)

❌ **Meta-commentary** — "Last Updated", "reduced from 634 lines", commit history

---

## Cross-Reference Pattern

**Root file:**

```markdown
**Agents** (`app/src/agents/`) - LLM logic. See `/AGENTS.md`.
```

**Subdirectory file:**

```markdown
**Context:** Working with AI agents. See root `SAFEWORD.md`/`AGENTS.md` for architecture.
```

**Import features:**

- Relative paths: `@docs/file.md`
- Recursive imports: max depth 5 hops
- Imports ignored inside code blocks

---

## Content Guidelines

**Include:**

- "Why" over "what" — architectural trade-offs, not feature lists
- Project-specific conventions unique to THIS codebase
- Domain requirements — specialized knowledge the agent can't infer from code
- Concrete examples — good vs bad patterns
- Common gotchas specific to this project
- Cross-references to subdirectory files

**Exclude:**

- Generic advice, setup instructions, API docs, phase tracking
- Content already in Claude Code's native documentation

---

## Domain Requirements Section (Optional)

**Add when:** Project has specialized domain knowledge non-obvious from codebase alone.

**Structure:**

```markdown
## Domain Requirements

### [Domain Name]

- [Key principle or rule]
- [Resource reference if applicable]

**Key principles:**

- [Specific guideline with rationale]
```

---

## Maintenance

- Update when architecture changes
- Remove outdated sections immediately
- Consolidate if multiple files reference same concept
- Test: Can a new developer understand "why" from reading this?

---

## Writing for LLM Comprehension

See `@.safeword/guides/llm-writing-guide.md` for principles and quality checklist.
