---
id: 037
type: feature
phase: intake
status: pending
parent: 031
created: 2026-03-18T15:28:00Z
last_modified: 2026-03-18T15:28:00Z
---

# Replace stop-quality transcript parsing with agent-based hook

**Goal:** Replace the complex JSONL transcript parsing in stop-quality.ts with a `type: "agent"` hook that uses Claude's judgment to evaluate completion criteria.

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
