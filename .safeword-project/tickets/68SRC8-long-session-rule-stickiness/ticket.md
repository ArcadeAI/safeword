---
id: 68SRC8
slug: long-session-rule-stickiness
type: task
phase: done
status: done
created: 2026-05-27T18:08:26.939Z
last_modified: 2026-05-27T18:09:00.000Z
parent: F14BG2-stop-hook-verdict-shape
scope: |
  Make the SAFEWORD.md "Talking to the user" rules stick across long sessions
  by combining two complementary mechanisms (research-backed; see Research
  evidence below):

  D — Restructure SAFEWORD.md so the "Talking to the user" section moves from
  mid-document to the LAST content section. Anthropic's long-context
  prompt-engineering guide recommends placing load-bearing instructions at
  the end for recency-weighted recall. Style/tone rules drift fastest, so
  they get the recency slot. Other sections (Workflow, Code Philosophy,
  Anti-Patterns, Authority, Guides, Standing Rules, Enforcement) keep their
  current relative order.

  E — Add a one-line pointer in the Stop-hook UNIVERSAL_HEADER that
  re-anchors the rules each Stop fire. Hook output arrives as a clean
  `<system-reminder>` block — the channel Anthropic itself uses for
  `long_conversation_reminder` — which bypasses the dismissive CLAUDE.md
  wrapper ("may or may not be relevant to your tasks"). Pointer, not
  duplication: ~30 tokens, references the section by name, doesn't
  re-state its content.

  Learning file — Write `.safeword-project/learnings/long-session-style-drift.md`
  documenting the channel-vs-content pattern: dismissive-wrapper mechanism,
  drift-prone-vs-static rule distinction, hook-channel pattern (Stop +
  UserPromptSubmit + SessionStart all bypass the wrapper), recency-placement
  guidance, when to apply (empirical drift only), when NOT to apply (no
  preemptive wrapping — preamble inflation is its own problem). Includes
  a `Covers:` line on line 3 so `safeword sync-learnings` picks it up.

  Test — Add one positive-assertion to `quality.test.ts` confirming the
  pointer line is present in the universal header.

  Sync — Re-sync runtime copies for both `SAFEWORD.md` (template at
  `packages/cli/templates/SAFEWORD.md`, runtime at `.safeword/SAFEWORD.md`)
  and `quality.ts` (already-known sync pair).
out_of_scope: |
  - Restructuring sections other than "Talking to the user." The audit
    found only one section is clearly drift-prone with no existing hook
    reinforcement; Code Philosophy and Standing Rules are borderline but
    have indirect surfacing through lint/audit/quality-review skills.
  - Moving SAFEWORD.md content into a SessionStart hook (Option C from
    /figure-it-out). Premature architectural shift without empirical drift
    evidence on rules other than Talking-to-user.
  - Per-skill output enforcement (Option D from /figure-it-out). Skill
    outputs aren't system reminders, so they don't bypass the dismissive
    wrapper anyway; high maintenance burden across 10+ skill files.
  - Per-turn UserPromptSubmit nudge (Option A from /figure-it-out). 50×
    the token cost of E for no extra steering benefit; risks the same
    preamble inflation QSNKBB just cut.
  - Adding pointers for Code Philosophy, Standing Rules, or any other
    section. The pattern is opportunistic — apply only when a rule shows
    empirical drift (user says "you forgot to X").
  - Cursor parity changes. The Stop-hook UNIVERSAL_HEADER also drives
    `QUALITY_REVIEW_MESSAGE` which cursor consumes — the pointer line will
    appear in both surfaces, which is the correct behavior (Cursor sessions
    drift too).
done_when: |
  - `packages/cli/templates/SAFEWORD.md` "Talking to the user" section sits
    as the LAST content section (after Enforcement); section ordering of
    Workflow → Code Philosophy → Anti-Patterns → Authority → Guides →
    Standing Rules → Enforcement → Talking-to-user.
  - `.safeword/SAFEWORD.md` re-synced from template (string-identical via
    `diff -q`).
  - `packages/cli/templates/hooks/lib/quality.ts` UNIVERSAL_HEADER contains
    a one-line pointer to SAFEWORD.md "Talking to the user" rules (~30
    tokens; not a content duplication).
  - `.safeword/hooks/lib/quality.ts` re-synced from template.
  - `packages/cli/tests/quality.test.ts` has a new positive-assertion
    confirming the pointer line is present.
  - `.safeword-project/learnings/long-session-style-drift.md` exists with
    a `Covers:` line on line 3.
  - `npx vitest run tests/quality.test.ts` and the broader 10-file
    quality.ts set pass.
  - Cursor stop hook still imports `QUALITY_REVIEW_MESSAGE` unchanged
    (parity preserved; pointer line appears in the shared message).
---

# Long-session stickiness for drift-prone user-comm rules

**Goal:** Make the "Talking to the user" rules stick across long sessions by combining a recency-aware SAFEWORD.md restructure (D) with a one-line Stop-hook pointer that re-anchors per turn (E), plus a learning file documenting the pattern.

**Why:** After ~50 turns of dense research and code edits in the F14BG2/QSNKBB session, the user flagged that the user-comm rules felt like they were "getting lost in all the context." Research (see below) confirmed: style/tone rules drift fastest in long sessions because CLAUDE.md content is loaded under a dismissive wrapper ("may or may not be relevant…"), and the discount compounds. The fix uses two complementary mechanisms that target the _channel_ the rules live in, not the rules themselves.

## Parent

[F14BG2-stop-hook-verdict-shape](../F14BG2-stop-hook-verdict-shape/ticket.md) — established the new verdict shape that this ticket pointer-references. The "Talking to the user" rules are what F14BG2's decision-brief shape was designed to follow.

## Research evidence

- **Anthropic Prompt engineering for long context** ([docs](https://www.anthropic.com/news/prompting-long-context)) — recommends placing load-bearing instructions at the END of the prompt for recency-weighted recall.
- **Opus 4.7 `long_conversation_reminder` mechanism** ([prompting guide](https://www.mindstudio.ai/blog/how-to-prompt-claude-opus-4-7); [system prompt leak](https://github.com/asgeirtj/system_prompts_leaks/blob/main/Anthropic/claude-opus-4.7.md)) — Anthropic itself re-injects sticky rules in long sessions via system-reminder channel. Validates the hook-pointer pattern.
- **CLAUDE.md dismissive wrapper** ([dev.to writeup](https://dev.to/albert_nahas_cdc8469a6ae8/your-claudemd-instructions-are-being-ignored-heres-why-and-how-to-fix-it-23p6); [32blog memory-management guide](https://32blog.com/en/claude-code/claude-code-memory-management-long-session-guide)) — CLAUDE.md content is loaded with "may or may not be relevant" framing that deliberately discounts it; hook output via `<system-reminder>` bypasses this.
- **Needle-in-haystack findings transfer to style rules** — style/tone rules drift fastest because they're easily rationalized away mid-task ("the user wants the answer, formatting can wait"). Retrieval facts are anchored to a query; style rules float.

## Audit of SAFEWORD.md sections (one-time evidence)

Performed during /figure-it-out before scoping this ticket:

- **Workflow** — not drift-prone (phase-gate hooks re-inject every turn).
- **Talking to the user** — drift-prone; no hook reinforcement → this ticket fixes.
- **Code Philosophy** — borderline; surfaced by lint + /audit + /quality-review.
- **Anti-Patterns** — not drift-prone (quality hooks catch directly).
- **Authority: docs and research** — not drift-prone (/figure-it-out re-asserts).
- **Guides** — not drift-prone (trigger-based).
- **Standing Rules** — borderline; already triggered by their own conditions.
- **Enforcement** — not drift-prone (hard-blocked by gates).

Only Talking-to-user is clearly drift-prone with no hook reinforcement today.

## Open decisions (revisitable)

- **Exact pointer wording.** Initial draft: "Apply SAFEWORD.md 'Talking to the user' rules to your reply: scan-not-read, named structure when it carries weight, end with **Next:**." Short and references the section by name. Revisit if the model still drifts after this ships.
- **Whether Code Philosophy should get the same treatment.** Borderline drift-prone but currently surfaced indirectly. Wait for empirical evidence before extending.

## Work Log

- 2026-05-27T18:08:26Z Started: Created ticket 68SRC8. Sized task — 4 files (SAFEWORD.md, quality.ts, quality.test.ts, learning file) plus runtime syncs. Scope bounded; out_of_scope explicitly rejects three alternative options weighed in /figure-it-out (A: per-turn nudge; C: SessionStart restructure; D: per-skill enforcement).
- 2026-05-27T18:14:00Z Implemented end-to-end. (D) Moved "Talking to the user" section in `packages/cli/templates/SAFEWORD.md` from mid-document (between Workflow and Code Philosophy) to the LAST content section (after Enforcement) for recency-weighted recall per Anthropic's long-context guide. Synced runtime `.safeword/SAFEWORD.md`. (E) Added a one-line pointer at the top of UNIVERSAL_HEADER in `packages/cli/templates/hooks/lib/quality.ts`: `Apply SAFEWORD.md "Talking to the user" rules to your reply: scan-not-read, lead with the answer, named structure only when it carries weight, end with **Next:**.` Synced runtime `.safeword/hooks/lib/quality.ts`. Wrote `.safeword-project/learnings/long-session-style-drift.md` documenting the channel-vs-content pattern (Covers: line on line 3). Added two positive-assertions to `packages/cli/tests/quality.test.ts` under a new `Rule: SAFEWORD.md "Talking to the user" pointer (68SRC8)` describe block. Targeted run: 10 files / 218 tests / 218 pass (was 216 pre-change; +2 for the new rule). Caught one self-inflicted bug during impl — my first Edit lost the `const UNIVERSAL_HEADER = \`` prefix; tests immediately failed with a TS syntax error, fixed by restoring the prefix.
