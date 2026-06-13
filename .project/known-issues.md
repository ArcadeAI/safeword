# Known Issues

Systemic issues with the hook system, Claude Code bugs, and gaps in enforcement. Distinct from tickets (which track planned work).

---

## Upstream Claude Code Bugs (out of our control)

**#12667 (closed as stale, not fixed):** Stop hooks with `decision: block` + exit 0 show `"hook error:"` label to user AND inject it into Claude's context. Closed by GitHub inactivity auto-close — underlying problem unfixed.

**#34713 (open, confirmed 2026-03-21):** All hook executions generate `"hook error"` labels unconditionally regardless of exit code. Duplicate of #10936, #10463, #27886 — none produced a fix. False error lines accumulate in Claude's context and can cause it to abandon multi-step tasks.

**`suppressOutput: true` does NOT fix these.** The field suppresses stdout from verbose mode only. Label generation is separate logic — adding `suppressOutput` has no effect on Claude's context pollution.

**#10412 (open):** Stop hooks with exit code 2 fail silently when installed via plugin system (`.claude/plugins/`). Our hooks use `.safeword/hooks/` + `.claude/settings.json`, so not currently affected — but relevant if we ever use plugins.

---

## Our System Gaps

**Done-phase Goodhart's Law:** Evidence patterns (`✓ X/X tests pass`, `Audit passed`) match anywhere in Claude's last message text — including prose Claude writes without running the tools. Tracked in 049c (scope to Bash output) and 049d (hook runs tests directly).

**Soft block is a prompt, not a gate:** The one-shot escape hatch (`stopHookActive` guard) lets Claude stop after one quality review round regardless of depth. This is intentional (loop prevention) but means the soft block functions as friction, not enforcement. Tracked in 049f (Haiku as judge).

**Refactor skips audit:** The refactor skill mandates running `/audit` at Phase 5 completion, but the stop hook's one-shot escape allows Claude to skip it unless the refactor task is tracked at done phase. Addressed by 049d.

---

## Research Findings

See `.safeword-project/guides/stop-hook-research.md` for full analysis, including:

- What the research says about intrinsic self-review vs. external feedback
- The Goodhart's Law problem with evidence pattern matching
- Community-documented fragility in transcript parsing
- Stronger alternatives (hook runs tests directly, Haiku as judge)
