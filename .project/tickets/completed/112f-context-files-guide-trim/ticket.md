---
id: 112f
slug: context-files-guide-trim
status: done
type: task
created: 2026-04-11
parent: '112'
---

# Trim context-files-guide.md from 454 to ~200 lines

**Goal:** Remove content that restates Claude Code's official docs (~180 lines), fix outdated claims, add explicit pointers so the agent knows WHERE to find the offloaded content.

## Problem

~40% of this guide restates Claude Code's official Best Practices and Memory documentation. The agent reads both — getting the same content twice wastes context. Worse, some restated content is now outdated (emphasis tokens, recency bias).

## Principle: explicit offloading with pointers

When removing content that Claude Code covers natively, replace it with a specific pointer — not just "see Claude Code docs" but the exact topic so the agent knows what to look for.

Example:

```markdown
**Line counts, imports, modular structure:** Follow Claude Code's CLAUDE.md guidance
(run `/init` to generate a starter, use `.claude/rules/` for path-scoped rules,
keep files under 200 lines, use `@path` imports for modularity).
```

This gives the agent enough keywords to find the right docs without restating them.

## What to cut with pointers (~180 lines)

| Section                                 | Lines   | Pointer replacement                                                                                                                                                        |
| --------------------------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Line count targets                      | 142-151 | "Follow Claude Code's 200-line guidance. Use `@path` imports or `.claude/rules/` to modularize."                                                                           |
| Include/exclude lists                   | 124-141 | "For what belongs in CLAUDE.md vs README vs code comments, follow Claude Code's include/exclude guidance in Best Practices."                                               |
| Import mechanism details                | 234-241 | "Claude Code supports `@path` imports (relative, absolute, recursive to 5 hops). See Claude Code Memory docs for syntax."                                                  |
| Auto-loading behavior                   | 54-75   | "Claude Code walks the directory tree upward and discovers nested files on-demand. Subdirectory files should assume root context is loaded." (Compress to 2 lines, not 20) |
| "Best Practices from Anthropic" section | 422-444 | DELETE entirely — this section literally restates official docs. Contains outdated claim about emphasis tokens.                                                            |
| Key Takeaways                           | 448-454 | DELETE — restates guide, includes outdated "recency bias" claim                                                                                                            |
| \*.local.md deprecation                 | 95      | Cut — agent doesn't need to know about deprecated features                                                                                                                 |

## What to trim (~80 lines)

| Section                           | Lines               | Action                                                                                                              |
| --------------------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Domain Requirements examples      | 354-395 (~42 lines) | Keep template + 1 example, cut the other 2 (Blades in the Dark, Document Editor, Conversational AI → keep just one) |
| Example well-structured root file | 243-301 (~58 lines) | Compress to ~20 lines — keep the structure pattern, cut the full example content                                    |
| "Why this structure" explanation  | 397-404             | Cut — self-evident from the example                                                                                 |
| Hook integration note             | 405-411             | Cut — hook behavior belongs in hook docs, not here                                                                  |

## Outdated claims to fix

### 1. Emphasis tokens (line 436)

Current: `Add emphasis ("IMPORTANT", "YOU MUST") for critical rules`
**Wrong for 2026.** Anthropic guidance says newer models (Opus 4.6, Sonnet 4.6) overtrigger on aggressive emphasis. Use normal language.

Fix: Remove entirely (section is being cut anyway).

### 2. Recency bias (line 453)

Current: `Put critical rules at the END of documents (recency bias)`
**Outdated.** Latest models handle long context better. Anthropic's long-context guidance says put long documents at top with queries below.

Fix: Remove entirely (section is being cut anyway).

## What to add

### 1. Tool-native loading clarification (~5 lines)

The guide teaches CLAUDE.md, CURSOR.md, and AGENTS.md as equivalent. Safeword supports all three (correct), but should clarify what each tool loads natively:

```markdown
## What Each Tool Loads

- **Claude Code** loads `CLAUDE.md` natively. Import `AGENTS.md` via `@AGENTS.md` if using both tools.
- **Cursor** loads `CURSOR.md` and `.cursorrules` natively.
- **AGENTS.md** is tool-agnostic — useful when multiple agents share context.
```

### 2. Complementary context mechanisms (~5 lines)

The guide doesn't mention Claude Code's rules system, /init command, or skills as context. Add a brief note:

```markdown
## Claude Code Context Layers

Beyond CLAUDE.md, Claude Code provides:

- **`.claude/rules/`** — path-scoped rules (load only when matching files open)
- **`.claude/skills/`** — on-demand knowledge (loaded when invoked, not always-on)
- **`/init`** — auto-generates starter CLAUDE.md from your codebase
- **Auto-memory** — Claude learns from corrections across sessions

For full details on these mechanisms, see Claude Code's Memory and Skills documentation.
```

## What to keep (~200 lines)

| Section                                    | Lines   | Why it earns its place                                          |
| ------------------------------------------ | ------- | --------------------------------------------------------------- |
| When to create + tool distinction          | 1-34    | Core routing (with tool-loading clarification added)            |
| SAFEWORD trigger requirement               | 35-52   | Safeword-specific, not in Claude Code docs                      |
| File structure pattern                     | 97-121  | Quick visual reference (compress slightly)                      |
| Anti-patterns checklist                    | 153-198 | Consolidates scattered Claude Code advice into scannable list   |
| Cross-reference patterns                   | 200-232 | Bidirectional root↔subdirectory pattern not in Claude Code docs |
| Domain Requirements (template + 1 example) | 314-353 | Novel — not mentioned in Claude Code docs                       |
| Maintenance notes                          | 303-310 | Brief lifecycle guidance                                        |

## Coordination

- **#112 llm-writing-guide**: Context-files-guide references llm-writing-guide at lines 5, 418. Keep the reference, ensure it points to updated version.
- **#112e architecture-guide**: Agent-visibility note in 112e complements this guide's purpose. Cross-reference.

## Work Log

- 2026-04-11T23:41 Created ticket from context-files-guide audit in parent #112.
