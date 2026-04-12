---
id: 112g
slug: llm-writing-guide-update
status: done
type: task
created: 2026-04-11
parent: '112'
---

# Update llm-writing-guide.md with latest Anthropic research

**Goal:** The most cross-referenced guide (6 inbound links) must be near-perfect. Update with verified 2026 Anthropic research, fix outdated claims, keep what's solid.

## Why this is highest priority

Every other guide references this one. If this guide is wrong, errors cascade. Six guides link to it: architecture-guide, context-files-guide (x2), data-architecture-guide, design-doc-guide, learning-extraction.

## What's solid (keep)

- MECE decision trees — correct pattern, well-explained
- "Explicit over implicit" — still valid
- "Concrete examples over abstract rules" — confirmed by Anthropic's few-shot guidance
- Edge cases must be explicit — correct
- No contradictions between sections — correct
- Anti-patterns section — useful

## What to add (verified against Anthropic 2026 docs)

### 1. XML tag structure

Anthropic explicitly recommends XML tags for prompt structuring: `<instructions>`, `<context>`, `<input>`, `<example>`, `<document>`. "XML tags help Claude parse complex prompts unambiguously."

Source: platform.claude.com/docs prompting best practices (verified)

### 2. Context budget / lean context

Context quality degrades with token count. Keep context lean and high-signal. "Find the smallest set of high-signal tokens that maximize the likelihood of your desired outcome."

Note: "Context rot" is not Anthropic's term — describe the phenomenon without attributing the label. Concept is real, terminology is third-party.

Source: anthropic.com/engineering/effective-context-engineering-for-ai-agents (verified)

### 3. Just-in-time retrieval

Don't pre-load everything. Maintain lightweight identifiers (file paths, URLs), load dynamically when needed. Mirrors human cognition.

Source: anthropic.com/engineering/effective-context-engineering-for-ai-agents (verified)

### 4. Few-shot example guidance

3-5 diverse, canonical examples. Not exhaustive edge cases. Examples should be relevant, diverse, and structured (wrap in `<example>` tags).

Source: platform.claude.com/docs prompting best practices (verified)

### 5. Long-context document placement

Place 20K+ token documents at the top of prompts, queries below. Can improve performance 30% on complex queries.

Source: docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/long-context-tips (verified)

## What to fix

### 1. REMOVE emphasis token recommendation if present

**Outdated for 2026.** Anthropic guidance: "Opus 4.6 and Sonnet 4.6 are more responsive to the system prompt. If your prompts were designed to reduce undertriggering, these models may now overtrigger. Where you might have said 'CRITICAL: You MUST use this tool when...', you can use more normal prompting."

Fix: If the guide recommends "IMPORTANT" or "CRITICAL" emphasis, remove that advice. Use normal, specific language instead.

Source: platform.claude.com/docs prompting best practices — Claude 4.6 model guidance (verified)

### 2. "Recency bias" framing

The guide's position-aware writing guidance references recency bias. Latest models handle long context better — the mechanism has evolved. Position-awareness is still relevant (long-context placement above confirms this), but the framing should shift from "recency bias" to "document placement for optimal comprehension."

### 3. Cross-check against context-files-guide

Context-files-guide (line 453) says "Put critical rules at END (recency bias)" citing this guide. If we fix the framing here, 112f needs to align. The context-files-guide section is being cut anyway (112f), so this is coordination, not a blocker.

## Scope

This is an UPDATE, not a rewrite. The guide is 184 lines and well-structured. Target: ~200 lines (add ~30 lines of new research, fix ~15 lines of outdated claims, net +16 lines).

Touches: `packages/cli/templates/guides/llm-writing-guide.md` only.

Rigor: HIGH — this is the foundation guide. Every claim should have a verified source. No training-data-only assertions about how Claude processes context.

## Work Log

- 2026-04-11T23:43 Created ticket from llm-writing-guide audit in parent #112.
