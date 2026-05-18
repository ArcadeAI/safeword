---
id: 153
type: feature
phase: intake
status: in_progress
created: 2026-05-18T06:12:00Z
last_modified: 2026-05-18T16:03:00Z
scope:
  - Epic-anchor hook re-injects epic's `## Contracts` section on every UserPromptSubmit and on SessionStart:compact when sub-ticket has `epic:` frontmatter field
  - Replan-on-resume auto-fires before first model turn when `git log <ticket.last_modified>..HEAD` returns > 0 commits
  - Replan output is chat-only; ticket frontmatter/body changes only with explicit user approval
  - Replan completion updates `last_modified` to now so subsequent resumes only see new commits
  - Verify-skill adds a non-blocking soft-prompt for cross-ticket contract promotion
  - New `epic:` frontmatter field on sub-tickets, parsed by existing permissive parser
  - templates/ and .safeword/hooks/ stay byte-identical after changes
out_of_scope:
  - Proactive sibling sweep mechanism (JIT-only per CHI 2025 evidence; per-ticket replan covers cascading invalidation through natural progression)
  - Auto-detection of cross-ticket interfaces from sibling code (research-grade not product-grade in 2026)
  - Hard-gated contract promotion at verify (soft for v1; revisit with real-world data)
  - Scope-path-aware commit filtering (any commit counts in v1)
  - New `kind: contract` ticket subtype (reuse `type: epic`)
  - Opt-out frontmatter (no escape hatch; if gate fires wrongly, fix the gate)
  - Subagent-per-sub-ticket architecture (doesn't fit current interactive model; v2 thinking)
  - New slash commands the user must remember
done_when:
  - A sub-ticket with `epic: <id>` field gets the epic ticket's `## Contracts` section auto-injected on every UserPromptSubmit
  - The same content re-injects on SessionStart:compact
  - Section-only injection respects the 10K-char additionalContext cap; oversized sections fall back to a file-path-and-summary stub
  - Starting any ticket where `git log <last_modified>..HEAD` returns > 0 commits triggers an automatic replan investigation before the first model turn
  - Replan output is chat-only and proposes one of: still good / change scope / cancel / split / merge with rationale
  - When replan detects invalidation, the report appends a one-line cascade hint naming likely-affected sibling tickets in the same epic
  - `last_modified` updates to current time after replan completes (whether or not the user applied changes)
  - /verify includes a non-blocking checklist item prompting promotion of cross-ticket bindings to epic's `## Contracts` section
  - templates/hooks/ and .safeword/hooks/ pass `diff -q` after changes
  - Tests cover: hook injection happens, hook respects 10K cap, replan trigger gate fires/skips correctly on commit count, `last_modified` updates after replan, soft-prompt appears in /verify output for sub-tickets of epics
---

# Boundary Resilience: Epic-Anchor Hook + Replan-on-Resume

**Goal:** Eliminate two failure modes that hit users running long Claude Code sessions through multi-sub-ticket epics: (1) the model forgets cross-ticket contracts established earlier in the conversation, and (2) ticket plans become stale relative to commits that landed since the ticket was written.

**Why:** Reported by Nate in a real Safeword session — built a Coordinator service successfully, then by the time he reached the Engine sub-ticket Claude was making "simplifying and incorrect assumptions" about the cross-service interface. Course-correctable with "the spec is the law," but the underlying cause is structural: Safeword's ticket-scoped phase gates re-read ticket artifacts each turn but never re-read epic-scoped truth, and ticket plans are treated as static once written. Both are addressable with minimal new mechanism — we already have the hook patterns and the verify checklist surface.

## Background

Diagnosis traced two compounding mechanisms:

1. **Truth drift (context rot).** Anthropic's own documentation calls it context rot — performance degrades as a gradient with token count, not a cliff. Opus 4.x effective context for multi-constraint coding work is ~200K despite the 1M nominal window. Cross-component work amplifies it because the model's attention shifts to the new component and the spec drifts out of recency. Auto-compact at default 95% threshold lossy-summarizes early-conversation content — including the epic spec.
2. **Plan staleness.** A ticket written before sibling sub-tickets shipped reflects assumptions that the sibling work has now updated. Today nothing re-validates the plan at resume; the model executes against a stale plan.

Today's Safeword design forces re-reading of **ticket-scoped** artifacts at each phase gate but does not re-read **epic-scoped** artifacts and does not re-validate plans against changed reality.

## Mechanism 1 — Epic-Anchor Hook

**Trigger:** Sub-ticket has `epic: <id>` frontmatter field.

**Behavior:** On every `UserPromptSubmit` and on `SessionStart:compact`, the hook reads the epic ticket's `## Contracts` section from disk and injects it via `hookSpecificOutput.additionalContext`. Section-only (not whole ticket); falls back to a file-path-and-summary stub when the section exceeds the 10K-char cap.

**Why this shape:** Anthropic's [memory docs](https://code.claude.com/docs/en/memory) explicitly route load-bearing facts to hooks. Path-scoped rules vanish on compaction; hook-injected content survives. Safeword already has this pattern wired for ticket.md ([prompt-questions.ts](.safeword/hooks/prompt-questions.ts), [session-compact-context.ts](.safeword/hooks/session-compact-context.ts) — see [ticket 032](.safeword-project/tickets/completed/032-post-compact-context-reinject)). This extension reuses the existing pattern with a new payload, no new mechanism.

## Mechanism 2 — Replan-on-Resume

**Trigger:** At ticket transition (when `quality-state.json` `activeTicket` changes), run `git log <ticket.last_modified>..HEAD --oneline | wc -l`. If > 0, fire replan before the first model turn.

**Behavior:** Auto-invokes an investigation/debate. The agent reads codebase changes since `last_modified`, fetches latest docs for relevant tools (Context7 / web), surfaces relevant recent research. Concludes with a chat-only report proposing one of: still good / change scope / cancel / split / merge — with rationale. If invalidation detected, appends a one-line cascade hint naming likely-affected sibling tickets in the same epic (free signal — context is already loaded).

**No proactive sweep.** Per CHI 2025 Codellaborator evidence ([arXiv 2502.18658](https://arxiv.org/html/2502.18658)) and Task-Decoupled Planning results ([arXiv 2604.11378](https://arxiv.org/html/2604.11378v1)), speculative cross-task replanning is actively disliked and produces no quality win. All shipped agentic coding tools (Cursor, Cline, Aider, Codex, Claude Code Plan Mode) operate strictly JIT. Per-ticket auto-replan provides cascading coverage through natural progression.

**`last_modified` updates after replan completes** regardless of whether the user applied any proposed changes. Without this, every subsequent resume would re-debate the same commits.

## Mechanism 3 — Verify-Skill Soft Promotion

Extend /verify with a non-blocking checklist item:

> "Did this sub-ticket finalize interface decisions that future sub-tickets in `epic-<id>` must honor? If yes, append to the epic ticket's `## Contracts` section before marking verify complete."

Soft, not hard. Real-world data will tell us whether hard-gating is needed; default to trusting Claude's judgment, opt-in escape hatch deliberately omitted.

## Design Rationale (Research-Backed)

- **Hooks over CLAUDE.md** for load-bearing facts — Anthropic's stated guidance. CLAUDE.md is "no guarantee of strict compliance"; hooks execute deterministically.
- **Promote-on-verify over decompose-first** — Spec Kit Agents ([arXiv 2604.05278](https://arxiv.org/html/2604.05278v1)) shows only +1.7% SWE-bench gain from upfront decomposition. Anthropic's [subagent docs](https://code.claude.com/docs/en/sub-agents) explicitly recommend "output files as the handoff mechanism between stages." Tessl/Osmani/Vellum consensus is evolving-spec.
- **JIT-only replan** — CHI 2025 Codellaborator: proactive intervention at task boundaries had 53.3% engagement vs 12.1% disruption (good); speculative proactivity actively disliked. Per-ticket arrival IS a task boundary.
- **Commits-since-last-touched as the universal staleness signal** — directly measures whether the world has moved, subsumes time-based heuristics, dependency-change checks, and sibling-completion signals into one cheap git command.

## Anti-Bloat Scorecard

| New                        | Count                                                         |
| -------------------------- | ------------------------------------------------------------- |
| New frontmatter fields     | 1 (`epic:`)                                                   |
| New hooks                  | 0 (2 extensions to existing hooks)                            |
| New artifact types         | 0 (reuse `type: epic`; new section convention `## Contracts`) |
| New slash commands         | 0                                                             |
| Opt-out flags              | 0                                                             |
| Proactive sweep mechanisms | 0 (JIT-only)                                                  |
| Auto-investigation flows   | 1 (replan)                                                    |
| Approx code change         | ~50 lines hooks + replan flow + tests                         |

## Investigation Needed (Before Implementation)

1. **Verify additionalContext multiple-injection bug ([anthropics/claude-code#14281](https://github.com/anthropics/claude-code/issues/14281)) doesn't double-inject our epic content.** Test in dogfood before shipping.
2. **Confirm `quality-state.json` `activeTicket` transition is the right hook for replan trigger.** Alternatives: SessionStart, UserPromptSubmit with state diffing. Decide based on which actually fires on the resume-a-ticket flow.
3. **Format of the auto-replan prompt template** — needs to instruct Claude to investigate codebase changes (one `git diff` since last_modified), fetch latest docs for relevant tools (Context7), and conclude with a structured proposal. Template needs to be written and tested for output quality.
4. **`## Contracts` section parsing** — markdown heading scan. Need to decide what counts as the section boundary (next `##` heading) and how to handle nested subsections.

## Related Tickets

- [032-post-compact-context-reinject](.safeword-project/tickets/completed/032-post-compact-context-reinject) — predecessor pattern this extends
- [094-cross-session-phase-blocking](.safeword-project/tickets/completed/094-cross-session-phase-blocking) — related context-collapse work
- [110-multi-session-coordination](.safeword-project/tickets/110-multi-session-coordination) — orthogonal multi-session work, may compose
- [133-schema-drift-detection](.safeword-project/tickets/133-schema-drift-detection) — adjacent drift-detection work
- [126-prompt-hook-reminders](.safeword-project/tickets/completed/126-prompt-hook-reminders) — pattern reference for one-shot prompt-hook injections

## Work Log

- 2026-05-18T06:12:00Z Created: feature ticket synthesizing a long design conversation. Diagnosis (truth drift + plan staleness) and design (epic-anchor hook + replan-on-resume + verify soft-prompt) anchored in research dispatched during conversation: Anthropic context-engineering + memory + subagent docs, Spec Kit Agents paper, Martin Fowler SDD survey, CHI 2025 Codellaborator, Task-Decoupled Planning paper, prior art from all shipped agentic coding tools. Anti-bloat scorecard explicit. Awaiting user review before phase transition to define-behavior.
