# Anthropic Research & Engineering: Feb-Apr 2026

Covers: Agent trustworthiness, harness design, auto mode, long-running agents, and model evaluation research relevant to Safeword's enforcement and workflow design.

## Trustworthy Agents in Practice (Apr 9, 2026)

**Key findings for Safeword:**

- **Layered oversight model**: Control at model, harness, tools, and environment — not just model training. "A well-trained model can still be exploited through a poorly configured harness."
- **Two oversight patterns**: Per-action approval (allow/require approval/block per tool) and Plan Mode (approve plans upfront, not individual steps).
- **Agent uncertainty**: Agents should be trained to "raise concerns, seek clarification, or decline to proceed" — not assume intent.
- **Multi-layer defense**: No single defense guarantees protection. Build defenses at several layers.

**Impact on Safeword:** Validates our three-layer model (natural gates + reminders + output validation). The "poorly configured harness" warning applies — our hook system IS the harness.

## Harness Design for Long-Running Apps (Mar 20, 2026)

**Key findings for Safeword:**

- **Three-agent architecture**: Planner (expands prompts to specs) → Generator (executes in focused sprints) → Evaluator (provides critical feedback). Separation of concerns prevents confirmation bias.
- **Context resets over compaction**: "Complete context resets with structured handoffs preserve agent clarity." Context anxiety causes models to prematurely wrap up as they approach perceived limits.
- **Self-evaluation is unreliable**: "Agents evaluating their own work exhibit confirmation bias, praising mediocre outputs. Delegating evaluation to independent agents proves far more tractable."
- **Sprint contracts**: Agreements between generator and evaluator defining testable success criteria BEFORE implementation.
- **Iterative tuning**: "Strip unnecessary complexity when models improve, but maintain scaffolding where tasks exceed baseline capabilities."

**Impact on Safeword:** Strongly validates #111 (Reflexion) and #101/#115 (Claude Code Review as adversarial reviewer instead of self-review). The "self-evaluation is unreliable" finding is exactly why we removed the BDD compliance self-check. Sprint contracts parallel our scenario-before-implementation pattern.

## Claude Code Auto Mode (Mar 25, 2026)

**Key findings:**

- Uses classifiers to automate permission decisions — increasing security while reducing approval fatigue.
- Denied commands show in /permissions → Recent for transparency.
- Runs on Sonnet 4.6 regardless of session model.

**Impact on Safeword:** Our #114 enforcement redesign removes hard blocks in favor of reminders. Auto mode is the native permission layer — our enforcement should complement it, not conflict. Already verified in this session: hooks fire independently of auto mode.

## Building a C Compiler with Parallel Claudes (Feb 5, 2026)

**Key findings:**

- Agent teams can build complex software with minimal human intervention.
- Lessons on autonomous software development and multi-agent coordination.

**Impact on Safeword:** Relevant to #110 (multi-session coordination). Parallel agents working on the same codebase need coordination mechanisms.

## Long-Running Claude for Scientific Computing (Mar 23, 2026)

**Key findings:**

- Multi-day tasks with memory persistence and orchestration patterns.
- Long-running agents need structured memory to maintain coherence.

**Impact on Safeword:** Relevant to #111 (Reflexion failure memory) and session-scoped quality state. Long sessions need explicit state management — the agent can't rely on context alone.
