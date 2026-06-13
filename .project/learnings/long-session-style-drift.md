# Long-session style drift: SAFEWORD.md rules lose steering force over time

Covers: claude.md dismissive wrapper, long context attention drift, talking-to-user rules forgotten, style instruction decay, sticky agent style, system-reminder channel, hook channel vs claude.md, recency placement, opus 4.7 long session

## The symptom

After 30-50+ turns of dense work (research outputs, multi-file edits, /verify and /audit passes), the model's user-facing output starts drifting away from SAFEWORD.md's "Talking to the user" rules — replies grow longer, denser, less scannable; the `**Next:**` discipline slips; bold load-bearing-word placement degrades. The rules are still in context but no longer steer the output. Observed empirically during the F14BG2 session.

## The directly-observable mechanism

In a Claude Code session, the CLAUDE.md content is injected into the prompt under a wrapper that explicitly tells the model the content "may or may not be relevant to your tasks. You should not respond to this context unless it is highly relevant to your task." This is directly visible in the model's own context (look for the `claudeMd` block in the session's system prompt). The wrapper text is what produces the discount on CLAUDE.md content — it's a literal instruction the model reads.

By contrast, content injected by hooks arrives in the model's context inside `<system-reminder>` blocks with no equivalent discounting wrapper. This is also directly observable across the same session — every Stop hook, UserPromptSubmit hook, and SessionStart hook output appears as plain system-reminder text.

So when CLAUDE.md @-includes SAFEWORD.md, the SAFEWORD.md rules inherit the relevance-discount. Hook output bypasses it.

## Inferred (not directly verified) mechanism

The reasoning chain from "wrapper exists" to "rules drift over long sessions" is an inference, not a measured finding:

- Plausible chain: the dismissive wrapper down-weights CLAUDE.md content; over a long session, model attention shifts to whatever's most recent in the active reasoning chain; the down-weighted content loses effective influence faster than non-discounted content.
- I don't have a primary Anthropic source or measurement for this chain. Community writeups assert it (dev.to, 32blog) but they're observation-grade, not paper-grade.
- The remedy worked empirically when applied (F14BG2 + 68SRC8 session), which is consistent with — but does not prove — the mechanism.

Treat the chain as a working hypothesis, not a settled fact. If the remedy stops working in some future session, the hypothesis is wrong and the diagnosis needs to be redone.

## Anthropic-sourced guidance that informed the fix

[Anthropic — Prompt engineering for Claude's long context window](https://www.anthropic.com/news/prompting-long-context) recommends placing load-bearing instructions at the END of the prompt for recency-weighted recall. This is Anthropic primary documentation. Whatever the underlying mechanism, the recency-placement recommendation is the authority for our SAFEWORD.md restructure.

## The pattern: channel choice matters

This is my synthesis of the observable facts above, not a sourced claim. When deciding where a rule lives, pick the channel by how drift-prone the rule is:

- **Drift-prone rules** — style, tone, communication. These belong in **hook channels** (Stop hook re-injection, UserPromptSubmit nudge, SessionStart system-reminder) because hook output bypasses the CLAUDE.md relevance-discount wrapper.
- **Static rules** — workflow phases, code philosophy, anti-patterns, file structure, domain knowledge. These don't need re-asserting; they're not subject to mid-task rationalization. SAFEWORD.md (via CLAUDE.md @-include) is fine for these.

The lookup question when adding or moving a rule: "if the model goes 50 turns without seeing this, will it still apply it correctly?" If no → hook channel. If yes → SAFEWORD.md.

## Two complementary mechanisms safeword uses

**Recency placement in SAFEWORD.md.** Following Anthropic's long-context guidance, "Talking to the user" lives at the last content section in SAFEWORD.md. Other sections (Workflow, Code Philosophy, Anti-Patterns, etc.) stay in their natural reading order.

**Stop-hook pointer.** UNIVERSAL_HEADER in `packages/cli/templates/hooks/lib/quality.ts` carries a one-line pointer that re-anchors the rules each Stop fire: "Apply SAFEWORD.md 'Talking to the user' rules to your reply: scan-not-read, lead with the answer, named structure only when it carries weight, end with **Next:**." Pointer, not duplication — ~30 tokens that reference the section by name.

## When to apply this pattern

- Apply when a rule shows **empirical drift** — the user says "you forgot to X" or you notice your own output ignoring rule X after many turns.
- Apply only the **smallest** mechanism that fixes the drift. Pointer + recency-placement was sufficient for Talking-to-user; a full SessionStart hook injection of all SAFEWORD.md would be premature.

## When NOT to apply

- **Don't preemptively wrap every rule.** Preamble inflation is its own problem — see ticket QSNKBB-prompt-brevity-cut where 7 lines of philosophical preamble were cut precisely because they were re-injecting content already in SAFEWORD.md.
- **Don't add per-turn UserPromptSubmit re-injection** for rules that have natural Stop-fire cadence. 50× the token cost of a Stop-hook pointer for no extra steering benefit.
- **Don't add pointers to every skill output template.** Skill outputs aren't system reminders, so they don't bypass the dismissive wrapper anyway. High maintenance burden, no actual fix.

## Tickets where this pattern was established

- F14BG2-stop-hook-verdict-shape — reshaped the Stop-hook verdict to a scannable decision brief.
- QSNKBB-prompt-brevity-cut — cut SAFEWORD.md-duplicated preamble from the same hook.
- 68SRC8-long-session-rule-stickiness — applied the pattern (recency placement + hook pointer) and wrote this learning file.

## Provenance of the claims here

- Recency-placement guidance: Anthropic primary docs (cited above).
- CLAUDE.md relevance-discount wrapper: directly observable in any Claude Code session's `claudeMd` system-prompt block; also documented in the public Claude Code issue tracker as [anthropics/claude-code#22309](https://github.com/anthropics/claude-code/issues/22309).
- Broader long-context instruction-following degradation: confirmed by primary research — [LIFBench (arXiv:2411.07037)](https://arxiv.org/pdf/2411.07037) measures instruction-following stability across long-context scenarios; [Long Context, Less Focus (arXiv:2602.15028)](https://arxiv.org/pdf/2602.15028) shows degradation scales with context length. Neither paper specifically categorizes style/tone vs other instruction types — that ordering remains a working hypothesis.
- `<system-reminder>` hook channel characteristics: directly observable across the same session.
- "Style/tone rules drift fastest" + "the down-weighting causes the observed drift" + "Opus 4.7 uses re-injection internally": community-sourced or inference. Treat as working hypotheses; revise if the remedy stops working.

## Sources

- [Anthropic — Prompt engineering for Claude's long context window](https://www.anthropic.com/news/prompting-long-context) (primary — quotes "putting the instructions at the end of the prompt, as we want Claude's recall of them to be as high as possible")
- [anthropics/claude-code#22309 — CLAUDE.md wrapped in "may or may not be relevant" disclaimer](https://github.com/anthropics/claude-code/issues/22309) (Claude Code public issue tracker — corroborates Claim 1)
- [LIFBench: Evaluating Instruction Following Performance and Stability of LLMs in Long-Context Scenarios (arXiv:2411.07037)](https://arxiv.org/pdf/2411.07037) (primary research — confirms long-context instruction-following degradation is measurable)
- [Long Context, Less Focus — degradation scaling (arXiv:2602.15028)](https://arxiv.org/pdf/2602.15028) (primary research)
- [Your CLAUDE.md Instructions Are Being Ignored — dev.to](https://dev.to/albert_nahas_cdc8469a6ae8/your-claudemd-instructions-are-being-ignored-heres-why-and-how-to-fix-it-23p6) (community)
- [Why Claude Code Forgets and How to Fix It — 32blog](https://32blog.com/en/claude-code/claude-code-memory-management-long-session-guide) (community)
- [How to Prompt Claude Opus 4.7 — MindStudio](https://www.mindstudio.ai/blog/how-to-prompt-claude-opus-4-7) (third-party guide)
- [Opus 4.7 system prompt leak — github.com/asgeirtj/system_prompts_leaks](https://github.com/asgeirtj/system_prompts_leaks/blob/main/Anthropic/claude-opus-4.7.md) (leaked, unverified)
