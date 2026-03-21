# Known Issues

Systemic issues with the hook system, Claude Code bugs, and gaps in enforcement. Distinct from tickets (which track planned work).

---

## Upstream Claude Code Bugs (out of our control)

**#12667 (open):** Stop hooks with `decision: block` + exit 0 show `"hook error:"` label to user AND inject it into Claude's context. Can cause Claude to see accumulated fake errors and prematurely end turns.

**#34713 (open):** All hook executions generate `"hook error"` labels unconditionally regardless of exit code. In heavy-hook sessions, this produces many false error lines, potentially causing Claude to abandon multi-step tasks.

**#10412 (open):** Stop hooks with exit code 2 fail silently when installed via plugin system (`.claude/plugins/`). Our hooks use `.safeword/hooks/` + `.claude/settings.json`, so not currently affected — but relevant if we ever use plugins.

---

## Our System Gaps

**Done-phase Goodhart's Law:** Evidence patterns (`✓ X/X tests pass`, `Audit passed`) match anywhere in Claude's last message text — including prose Claude writes without running the tools. Claude could satisfy the gate without running `/verify` or `/audit`. See research doc for options.

**Soft block is a prompt, not a gate:** The one-shot escape hatch (`stopHookActive` guard) lets Claude stop after one quality review round regardless of depth. This is intentional (loop prevention) but means the soft block functions as friction, not enforcement.

**Refactor skips audit:** The refactor skill mandates running `/audit` at Phase 5 completion, but the stop hook's one-shot escape allows Claude to skip it unless the refactor task is tracked at done phase.

**exit(2) in done-phase hard block:** `hardBlockDone` uses `console.error + process.exit(2)` instead of the canonical `{ decision: 'block' } + exit 0`. Exit 2 had a past reliability regression and fails in plugin contexts. Low risk currently but not the canonical path.

---

## Research Findings

See `.safeword-project/guides/stop-hook-research.md` for full analysis, including:

- What the research says about intrinsic self-review vs. external feedback
- The Goodhart's Law problem with evidence pattern matching
- Community-documented fragility in transcript parsing
- Stronger alternatives (hook runs tests directly, Haiku as judge)
