---
id: 031
type: epic
phase: intake
status: backlog
created: 2026-03-18T15:28:00Z
last_modified: 2026-03-18T15:28:00Z
children: [032, 033, 034, 035, 036, 037, 038, 039]
---

# Modernize Claude Code integration for latest platform features

**Goal:** Align Safeword's hook/skill/command system with the latest Claude Code documentation and platform capabilities.

**Why:** Claude Code has evolved significantly — new hook events (PostCompact, TaskCompleted), prompt/agent-based hooks, skill frontmatter fields (disable-model-invocation, user-invocable, context: fork), and the command/skill merge. Safeword's implementation predates several of these and leaves value on the table.

## Context

Full review conducted 2026-03-18 comparing Safeword's implementation against:

- [Claude Code Hooks Guide](https://code.claude.com/docs/en/hooks-guide)
- [Claude Code Skills Docs](https://code.claude.com/docs/en/slash-commands)
- [Addy Osmani: AI Coding Workflow](https://addyosmani.com/blog/ai-coding-workflow/)
- [CodeScene: Agentic AI Coding Patterns](https://codescene.com/blog/agentic-ai-coding-best-practice-patterns-for-speed-with-quality)

## Children (priority order)

1. **032** — Add PostCompact hook to re-inject ticket context (high impact, low risk)
2. **033** — Check stop_hook_active in stop-quality.ts (safety fix, trivial)
3. **034** — Add skill frontmatter fields (user-invocable, disable-model-invocation)
4. **035** — Deduplicate SAFEWORD.md / AGENTS.md / CLAUDE.md overlap
5. **036** — Convert simple hooks to bash (reduce Bun overhead)
6. **037** — Replace stop-quality.ts transcript parsing with agent-based hook
7. **038** — Convert 4 standalone commands to skills (blocked by --resume bug)

## Completed

- Removed 5 redundant Claude command shims (commit f3160d9)

## Work Log

- 2026-03-18T15:28:00Z Created: Epic with 7 child tickets from review findings
- 2026-03-18T15:00:00Z Complete: Removed 5 shim commands (refs: commit f3160d9)
