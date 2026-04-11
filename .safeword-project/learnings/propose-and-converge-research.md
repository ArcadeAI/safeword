# Propose-and-Converge: Research Principles

Design principles for how an AI agent should interact with users, derived from HCI research, pair programming literature, Anthropic's autonomy research, and conversational AI UX patterns. Applied first in ticket #100 (ideation phase).

## The Four Rules

### 1. Contribute before you extract

Questions feel collaborative when they follow a contribution, and adversarial when they precede one. Restate what you heard, offer a perspective or sketch, then embed questions inside that contribution. Reviewing a concrete proposal costs the user less cognitive effort than answering an abstract question.

**Source:** Conversational UX research (Claude Code, Copilot, Cursor user studies); agentic system design patterns 2025; Anthropic's Claude Code auto-mode research; Stack Overflow 2025 Developer Survey; Progressive Disclosure for AI Agents (Honra.io, alexop.dev); ACM Computing Surveys 2025.

### 2. Depth scales with ambiguity — no mode detection needed

Don't build vague-vs-clear detection. One pattern works across the spectrum: contribute + surface open questions. Clear requests have 0 open questions (just execute). Vague requests have many (converge over 2-3 turns). The pattern self-regulates.

**Source:** Derived from mixed-initiative interaction research (Horvitz, 1999); validated against Guru's customer feedback showing both vague ("Habtab") and specific-with-hidden-decisions ("ngrok webhook") requests.

### 3. Convergence follows a gradient, not a moment

From pair programming and grounding theory: the user's responses shift from **additive** ("also consider X") → **subtractive** ("yes but skip Y") → **affirmative** ("do it"). The stopping condition is user acceptance of a proposal, not a round limit or schema completion.

**Source:** Clark & Schaefer, "Contributing to Discourse" (grounding theory); Williams & Kessler pair programming studies; Bansal et al. 2019 on calibrated trust in human-AI decision-making.

### 4. Earned authority through progressive specificity

The agent earns the right to act by making each proposal cheaper to accept than to restate. When the proposal requires no correction, the agent has demonstrated enough understanding to proceed.

**Source:** Geoffrey Litt on "agency matching"; Maggie Appleton on AI autonomy; Anthropic's "Measuring AI Agent Autonomy" paper (experienced users shift from approving to monitoring-and-intervening).

## Anti-Patterns

| Anti-pattern                                            | Why it fails                                                                          | What to do instead                                                |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Front-loading questions before contributing             | Feels like interrogation                                                              | Restate + contribute, then embed questions                        |
| Schema-filling ("you haven't told me the audience yet") | People don't think in schemas                                                         | Surface open questions naturally as part of proposals             |
| Fixed round limits (max 3 rounds)                       | Arbitrary — too many for clear requests, too few for complex ones                     | Let depth scale with ambiguity; use a backstop only as safety net |
| Vague-vs-clear detection                                | Hard to get right; false negatives skip ideation when it's most valuable (XY problem) | One pattern that works everywhere — propose-and-converge          |
| "Always ask why"                                        | Patronizing for users who know what they want                                         | Match the user's energy; execute when there are no open questions |

## The XY Problem

Users sometimes ask for their attempted solution (X) rather than their actual problem (Y). The effective response is NOT "always ask why" — it is to **contribute context that surfaces the hidden decisions**. For the ngrok webhook request, the agent doesn't ask "but what are you really trying to do?" — it says "Arcade hooks let you intercept at three points; here's which I'd pick and why — one open question to resolve."

**Source:** Stack Overflow XY problem pattern; NNGroup research on AI clarification behavior.

## Rubber Ducking

Rubber ducking is not a separate mode — it emerges naturally from contribute-before-extracting. When the user is thinking out loud, "contribute" means reflecting back what they said (which IS rubber ducking). No mode switch needed.

## Key Sources

- Anthropic, "Measuring AI Agent Autonomy" (2025)
- Anthropic, "Trustworthy Agents in Practice" (2025)
- Clark & Schaefer, "Contributing to Discourse" (grounding theory)
- Horvitz, "Principles of Mixed-Initiative User Interfaces" (1999)
- ACM Computing Surveys, "LLM-Based Multi-turn Dialogue Systems" (2025)
- Geoffrey Litt, writings on agency matching and malleable software
- Maggie Appleton, writings on AI autonomy and bicycles for the mind
- Progressive Disclosure for AI Agents (Honra.io, alexop.dev)

## Industry Terminology Mapping

Our terms are original and more precise for our use cases. Industry equivalents for external readers:

| Safeword term                   | Industry equivalent                                  | Difference                                                                                                                               |
| ------------------------------- | ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Propose-and-converge            | "Propose-then-approve" (Copilot), "bounded autonomy" | Ours captures the convergence gradient (multiple turns narrowing), not just a single propose/approve gate                                |
| Contribute before asking        | No direct equivalent                                 | Original insight — not named in the industry                                                                                             |
| Open questions / resolved       | "Open decisions" (PM), "unresolved items" (specs)    | We chose "questions" over "decisions" to avoid overloading "fork" and to be natural for developers (design doc "Open Questions" section) |
| Work-level detection (internal) | "Internal classification", "task routing"            | Industry is moving toward internal classification (2026 trend). Our version adds structural signals (files, state, flows)                |
| Scope from resolved questions   | No direct equivalent                                 | Closest: AWS Agentic AI Scoping Matrix (scope from resolved architectural decisions)                                                     |
