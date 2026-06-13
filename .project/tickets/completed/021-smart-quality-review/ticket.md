---
id: 021
type: feature
phase: done
status: wontfix
created: 2026-01-11T16:50:00Z
last_modified: 2026-01-11T16:50:00Z
---

# Smart Quality Review (Prompt-Based)

**User Story:** When I run `/bdd` and the agent drifts from my scenarios or creates code without tests, I want intelligent detection so I catch context-aware issues that simple thresholds miss.

**Goal:** Use LLM evaluation for deeper quality analysis beyond simple thresholds.

**Origin:** Moved from 017d. Core problem solved by 017a/017b (LOC enforcement + phase gates). This is an optional enhancement.

## Why This Is Separate

| Approach        | Pros                         | Cons                       |
| --------------- | ---------------------------- | -------------------------- |
| Threshold-based | Fast, deterministic, free    | Doesn't understand context |
| Prompt-based    | Understands context, smarter | Adds latency, costs money  |

017a/017b provide deterministic enforcement. This ticket adds context-aware intelligence for teams wanting deeper analysis.

## How It Works

Use Claude Code's prompt-based hook with Haiku for evaluation:

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write|NotebookEdit",
        "hooks": [
          {
            "type": "prompt",
            "prompt": "Analyze recent changes for quality issues..."
          }
        ]
      }
    ]
  }
}
```

## Evaluation Prompt

```text
Analyze recent session activity for quality signals.

Check:
1. Drift from ticket scenarios (if .safeword-project/tickets/ exists)
2. Test coverage gaps (new code without corresponding tests)
3. Accumulating complexity (files growing too large)
4. Repeated similar changes (possible refactor opportunity)
5. Error patterns (similar errors recurring)

If concerning patterns found:
  Return {"ok": false, "reason": "Brief explanation", "severity": "soft|hard"}

If session looks healthy:
  Return {"ok": true}

Be conservative - only flag clear issues.
```

## Cost Analysis

Claude 3.5 Haiku pricing:

- Input: $1/M tokens
- Output: $5/M tokens

**Per quality check** (~2K input + 100 output tokens): **~$0.0025** (0.25 cents)

| Usage  | Checks/Day | Monthly Cost |
| ------ | ---------- | ------------ |
| Light  | 10         | $0.75        |
| Normal | 50         | $3.75        |
| Heavy  | 200        | $15.00       |

Cost is negligible but adds ~500ms latency per check.

## Opt-In Configuration

Enable via environment variable:

```bash
export SAFEWORD_SMART_QUALITY=true
```

Or in `.safeword-project/config.json`:

```json
{
  "smartQuality": {
    "enabled": true,
    "checkFrequency": "every_100_loc",
    "severityThreshold": "soft"
  }
}
```

## When Smart Review Adds Value

1. **Drift detection** - "You're implementing feature X but scenarios describe Y"
2. **Pattern recognition** - "You've made 5 similar changes, consider refactor"
3. **Coverage gaps** - "New auth module has no tests"
4. **Complexity warnings** - "This file is now 500+ lines, consider splitting"

## Limitations

1. **Latency** - Adds ~500ms per check
2. **Cost** - Small but non-zero
3. **False positives** - LLM may flag non-issues
4. **Cursor support** - Prompt-based hooks are Claude Code only
5. **Context rot** - Adds to context length (research shows this degrades performance)

## Dependencies

- 017a/017b should be implemented first (core enforcement)
- May integrate with 017a's LOC tracking for frequency control

## Acceptance Criteria

- [ ] Prompt-based hook evaluates session health
- [ ] Opt-in via SAFEWORD_SMART_QUALITY env var
- [ ] Config file option for fine-tuning
- [ ] Returns soft/hard severity
- [ ] Latency under 1s per check
- [ ] Clear documentation of costs
- [ ] Graceful degradation if API unavailable

## Future Considerations

- **Batch analysis** - Analyze multiple edits together (reduce API calls)
- **Local model** - Use local LLM to eliminate API cost/latency
- **Learning** - Track false positives to improve prompt

## Work Log

---

- 2026-01-11T16:50:00Z Created: Moved from 017d as separate enhancement
- 2026-01-10T20:23:00Z Original: Created as 017d

---
