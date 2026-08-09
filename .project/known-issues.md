# Known Issues

Systemic issues with the hook system, Claude Code bugs, and gaps in enforcement. Distinct from tickets (which track planned work).

---

## Upstream Claude Code Bugs (out of our control)

**#12667 (closed as stale, not fixed):** Stop hooks with `decision: block` + exit 0 show `"hook error:"` label to user AND inject it into Claude's context. Closed by GitHub inactivity auto-close — underlying problem unfixed.

**#34713 (open, confirmed 2026-03-21):** All hook executions generate `"hook error"` labels unconditionally regardless of exit code. Duplicate of #10936, #10463, #27886 — none produced a fix. False error lines accumulate in Claude's context and can cause it to abandon multi-step tasks.

**`suppressOutput: true` does NOT fix these.** The field suppresses stdout from verbose mode only. Label generation is separate logic — adding `suppressOutput` has no effect on Claude's context pollution.

**#10412 (open):** Stop hooks with exit code 2 fail silently when installed via plugin system (`.claude/plugins/`). Our hooks use `.safeword/hooks/` + `.claude/settings.json`, so not currently affected — but relevant if we ever use plugins.

---

## Upstream Codex Bugs (out of our control)

Our Codex hooks ship as a plugin: `.codex-plugin/plugin.json` declares `"hooks": "./hooks.json"` at the plugin root, and that `hooks.json` registers SessionStart, PreToolUse, PostToolUse, UserPromptSubmit, and Stop. Three open upstream issues describe Codex failing to fire hooks in ways that could touch this path:

**openai/codex#16430 (open, unconfirmed):** Claims the plugin manifest parser doesn't recognize a `hooks` key at all — only `~/.codex/hooks.json` (global, not plugin-scoped) actually runs, per source lines the reporter cites in `codex-rs/core/src/plugins/manifest.rs` and `codex-rs/hooks/src/engine/discovery.rs`. **Contradicted by our own evidence:** ARCHITECTURE.md's Codex plugin decisions record live rc.1 verification of profile-local SessionStart proof bound to the exact hook-manifest digest — that proof can only exist if our plugin-declared SessionStart hook actually ran. Likely doesn't reproduce against the Codex version/install path we target, but worth a quick recheck if a future Codex upgrade makes `safeword codex status` stop reporting fresh SessionStart proof.

**openai/codex#17532 (open, unconfirmed):** `codex_hooks` configured via repo-local `.codex/config.toml` (a `hooks = "<path>"` key, separate from the plugin system) don't fire in interactive sessions. Doesn't apply to us — our installed `.codex/config.toml` carries no `hooks` key; hooks come from the plugin only.

**openai/codex#35306 (open, unconfirmed):** No trust prompt is shown for project-level hooks, so they're silently skipped until a user explicitly reviews them. This matches behavior we already document and design around: README's Codex section notes "Codex visibly skips unreviewed or changed plugin hooks and directs the builder to `/hooks`," and `safeword codex status` exists partly to surface exactly this gap.

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
