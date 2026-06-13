# LLM Integration Guide

How to call LLMs effectively: API patterns, structured outputs, caching, context management, and testing.

**Related:** For writing documentation that LLMs will read, see [LLM Writing Guide](../../.safeword/guides/llm-writing-guide.md)

---

## Structured Outputs

Use JSON mode for predictable LLM responses. Define explicit schemas with validation. Return structured data, not prose.

```typescript
// ❌ BAD - Prose output
"The user wants to create a campaign named 'Shadows' with 4 players"

// ✅ GOOD - Structured JSON
{ "intent": "create_campaign", "name": "Shadows", "playerCount": 4 }
```

---

## Cost Optimization

**Prompt Caching (Critical for AI Agents):**

- Static rules → System prompt with cache_control: ephemeral (caches for ~5 min, auto-expires)
- Dynamic data (character state, user input) → User message (no caching)
- Example: 468-line prompt costs $0.10 without caching, $0.01 with (90% reduction)
- Cache invalidation: ANY change to cached blocks breaks ALL caches
- Rule: Change system prompts sparingly; accept one-time cache rebuild cost

**Message Architecture:**

```typescript
// ✅ GOOD - Cacheable system prompt
systemPrompt: [
  { text: STATIC_RULES, cache_control: { type: 'ephemeral' } },
  { text: STATIC_EXAMPLES, cache_control: { type: 'ephemeral' } },
];
userMessage: `Character: ${dynamicState}\nAction: ${userInput}`;

// ❌ BAD - Uncacheable (character state in system prompt)
systemPrompt: `Rules + Character: ${dynamicState}`;
```

---

## Context Management

**Context Window Limits:**

- Stay at 70-80% of context window capacity
- Performance degrades 20-50% approaching limits

**Observation Masking:**

- Prefer masking over summarization—halves cost with equal performance
- Hide old tool outputs while preserving action/reasoning history
- Summarize only when masking is insufficient
- Reference artifacts by path, don't inline full content

**Per-Phase Loading:**

- Load only phase-relevant artifacts at each step
- Work logs: Summarize previous sessions, don't replay verbatim
- Test definitions: Load current slice, not all scenarios

**Sub-Agent Pattern:**

- Return condensed summaries (1-2k tokens) not full execution traces
- Main agent coordinates, subagents handle focused tasks

---

## Testing AI Outputs

**LLM-as-Judge Pattern:**

- Use LLM to evaluate nuanced qualities (narrative tone, reasoning quality)
- Avoid brittle keyword matching for creative outputs
- Define rubrics: EXCELLENT / ACCEPTABLE / POOR with criteria
- Example: "Does the GM's response show collaborative tone?" vs checking for specific words

**Evaluation Framework:**

- Unit tests: Pure functions (parsing, validation)
- Integration tests: Agent + real LLM calls (schema compliance)
- LLM Evals: Judgment quality (position/effect reasoning, atmosphere)
- Cost awareness: 30 scenarios ≈ $0.15-0.30 per run with caching

---

## Key Takeaways

- Use structured JSON outputs, not prose
- Cache static content, keep dynamic content in user messages
- Stay at 70-80% of context window; prefer masking over summarization
- Use LLM-as-judge for nuanced quality evaluation
