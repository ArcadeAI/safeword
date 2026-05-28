---
id: 037
type: feature
phase: intake
status: pending
parent: 031
created: 2026-03-18T15:28:00Z
last_modified: 2026-05-28T05:18:00Z
---

# Replace stop-quality transcript parsing with agent-based hook

**Goal:** Replace the complex JSONL transcript parsing in stop-quality.ts with a `type: "agent"` hook that uses Claude's judgment to evaluate completion criteria.

## Re-evaluation (2026-05-28) — stays pending, with a concrete revisit trigger

Reconsidered during the F14BG2/QSNKBB/68SRC8 session via `/figure-it-out`. Two findings:

1. **`type: "agent"` hooks are confirmed to exist** (Claude Code, May 2026) — five hook types now (command/http/mcp_tool/prompt/agent), agent default 60s timeout, fast model by default. So the original technical premise holds.

2. **But the motivation shifted and the cost/benefit no longer favors building.** The original framing was "transcript parsing is fragile." That premise weakened — the parsing hasn't regressed. The new framing that came up is "self-evaluation by the main model is biased (declares CONFIDENT on its own work)." The decisive counter: **CI is already the independent, deterministic evaluator** for anything that ships — every PR re-runs lint + full test suite on a clean checkout, with no shared context to rationalize. An agent-hook would largely duplicate CI for the shipping path while adding a per-Stop LLM call plus the judge-LLM failure modes documented in the research (hallucinated evidence — MIRAGE-Bench arXiv:2507.21017; stalemate / miscalibration without anchoring — arXiv:2508.02994). Anthropic's own evals guidance is hybrid: deterministic checks first, LLM-judge only for what determinism can't cover.

**Revisit trigger:** a done-phase verdict that was falsely CONFIDENT, _also passed CI_, and still broke in real use. That's the concrete evidence that CI has a coverage hole the verdict should have caught — and it surfaces automatically as a post-merge bug (no human monitoring required, which matters because the verdict isn't watched closely). Until then: CI is the evaluator; the stop-hook verdict is a local pre-check, not the authority. If the trigger fires, scope a new ticket (likely supersedes this one) narrowly to whatever CI missed, per the hybrid pattern — not a full agent-hook replacement.

**Why:** The current stop-quality.ts (~200 lines) parses the conversation transcript JSONL to detect JSON summaries and edit tool usage. This is fragile — it depends on internal transcript format which could change. Claude Code now supports `type: "agent"` hooks that spawn a subagent with tool access to verify conditions. This is exactly what the stop hook needs: read the ticket, check test evidence, evaluate whether criteria are met.

## Scope

**In scope:**

- Replace transcript parsing logic with agent-based hook
- Preserve all existing behavior: phase-aware quality review, done-phase hard block, evidence validation
- Keep hierarchy navigation (findNextWork) — it's solid

**Out of scope:**

- Changing quality gate thresholds or criteria
- Changing the LOC/refactor/phase gates (those are PreToolUse/PostToolUse, not Stop)

## Risks

- Agent hooks have a default 60s timeout (configurable) — may not be enough for complex evaluations
- Agent hooks use LLM calls which cost tokens
- Need to verify agent hooks have access to file system (to read tickets, quality-state.json)

## Acceptance Criteria

- [ ] stop-quality.ts replaced with agent-based hook configuration
- [ ] Done-phase hard block still works (exit 2 on missing evidence)
- [ ] Phase-aware quality messages preserved
- [ ] Hierarchy navigation preserved
- [ ] No JSONL transcript parsing remaining
- [ ] Tests pass
