---
id: '117'
title: Review Anthropic research for Safeword-relevant design insights
type: task
phase: intake
status: cancelled
created: 2026-04-11
related: '116'
---

## Goal

Periodically review Anthropic's published research for findings that should influence Safeword's enforcement design, hook behavior, or evaluation approach. Establish a lightweight process for staying current.

## Context

Safeword's design is grounded in agent behavior research — the enforcement model, "physics not policy" principle, and quality gates all draw from findings about how LLM agents actually behave. If Anthropic publishes new research on tool use patterns, agent self-correction, alignment techniques, or eval methodology, it could validate, challenge, or extend our current approach.

Unlike the Claude Code changelog (#116), there's no single diffable artifact. Research is published across multiple channels with no structured API. This ticket is about establishing a review cadence and a way to record what we've absorbed.

## Sources to check

| Source             | URL                                   | Format                    |
| ------------------ | ------------------------------------- | ------------------------- |
| Research blog      | anthropic.com/research                | Blog posts, papers        |
| News/announcements | anthropic.com/news                    | Announcements             |
| arxiv              | arxiv.org (search: Anthropic authors) | Papers                    |
| Claude docs        | docs.anthropic.com                    | Docs updates              |
| GitHub             | github.com/anthropics                 | Research artifacts, tools |

## Relevance filter

Flag research that touches:

- **Agent behavior** — tool use patterns, planning, multi-step reasoning, self-correction, task completion rates. Directly shapes enforcement design.
- **Alignment / safety** — constitutional AI updates, RLHF findings, jailbreak research, refusal calibration. We're building guardrails — upstream safety research is load-bearing context.
- **Evaluation methodology** — how Anthropic measures agent success, SWE-bench results, new benchmarks. Could inform how we evaluate Safeword's own effectiveness.
- **Prompt engineering** — system prompt behavior, instruction following, prompt hierarchy. Our hooks are structured prompts — new findings change what's possible.
- **Tool use / function calling** — changes to how Claude handles tools, new patterns, failure modes. Hooks are tools.
- **Model capabilities** — reasoning improvements, context window changes, new modalities. Capability shifts may make some enforcement patterns unnecessary or enable new ones.

## Steps

### 1. Initial review

- Survey each source for publications since ~March 2026 (rough Safeword v0.27 timeframe)
- Collect titles + one-line summaries of anything potentially relevant
- Deep-read the relevant ones

### 2. Triage and record findings

For each relevant publication, record:

- **What**: title, date, source link
- **Relevance**: which Safeword component or principle it affects
- **Impact**: one of:
  - **Validates** — confirms our current approach
  - **Challenges** — suggests our approach may be wrong or suboptimal
  - **Extends** — suggests a new capability or pattern we could adopt
  - **Watch** — interesting but no action now

### 3. File action items

- For "Challenges" items: file a ticket or add to an existing ticket
- For "Extends" items: note as future opportunity, file ticket if high-value
- For "Validates" items: reference in relevant learnings files (useful for justifying design decisions)

### 4. Record review checkpoint

Store a "last reviewed" date so the next review knows where to start. Co-locate with the Claude Code version baseline from #116 — same problem, same solution pattern.

## Acceptance criteria

- [ ] All sources surveyed for the baseline period
- [ ] Relevant publications identified and triaged
- [ ] Findings recorded in `.safeword-project/learnings/` (update existing files or create new ones)
- [ ] Action items filed where needed
- [ ] Review checkpoint date recorded
- [ ] Existing learnings validated or updated (especially `agent-behavior-research.md`)

## Known starting points (from quality review scan, 2026-04-11)

### "Trustworthy agents in practice" (Apr 9, 2026)

Source: anthropic.com/research — published 2 days before this ticket was created.

**Impact: Validates** Safeword's architecture. Key alignment points:

- **4-layer safety model** (model / harness / tools / environment) — Safeword operates at the harness layer, which Anthropic identifies as one of four required layers. Confirms our scope is correct and that we shouldn't try to be all four layers.
- **"Physics not policy" resonance** — the paper emphasizes that no single defense mechanism suffices and that multi-layer structural enforcement beats relying on model compliance alone. Directly validates our enforcement philosophy.
- **Progressive oversight via Plan Mode** — Anthropic's approach to human control (strategy-level review, not per-action approval) aligns with Safeword's phase-gated model where oversight intensity scales with phase.
- **Uncertainty recognition** — Claude's check-in rate roughly doubles on complex tasks. Relevant to how we calibrate stop hook frequency and quality review triggers.

**Action:** Reference in `agent-behavior-research.md` learnings file. Consider whether the 4-layer model should inform how we describe Safeword's scope in docs.

### Other potentially relevant (not yet deep-read)

- "Emotion concepts and their function in a large language model" (Apr 2, 2026) — interpretability; **Watch**
- "Long-running Claude for scientific computing" (Mar 23, 2026) — may have findings about agent behavior in extended sessions; **Watch**, worth a skim

### Confirmed: no RSS feed

anthropic.com/research has a searchable publication listing with dates and categories but no RSS feed or structured API. The automation path would be scraping or periodic manual review.

## Open questions

- **Cadence**: Monthly? Per-release? The changelog review (#116) is per-release — research review might benefit from a different cadence since papers don't align with our release cycle.
- **Depth vs. breadth**: Should we skim everything or deep-read selectively? Leaning toward: skim all, deep-read only items classified as "Challenges" or high-value "Extends."
- **Automation potential**: Unlike #116, this is harder to automate — no single structured feed. An RSS reader on anthropic.com/research + arxiv alerts for Anthropic authors might be the lightweight version.
