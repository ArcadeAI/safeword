---
id: F14BG2
slug: stop-hook-verdict-shape
type: task
phase: done
status: done
created: 2026-05-27T03:42:02.464Z
last_modified: 2026-05-27T04:40:00.000Z
parent: 143-stop-hook-binary-terminal
scope: |
  Replace UNIVERSAL_HEADER in `packages/cli/templates/hooks/lib/quality.ts` so
  the Stop-hook verdict block becomes a self-contained decision brief the user
  can act on under time pressure — not just a calibrated token plus a citation.

  Structural changes:
    - Drop the "End with a single verdict — not a list" line (root cause of the
      prose-blob misread).
    - Replace with "End with one verdict as its own scannable decision brief"
      framing that names the reader: someone choosing whether to continue,
      redirect, or intervene, with this block as their only context.
    - Add explicit "Reproduce the shape below exactly" instruction (Opus 4.7
      literalism).
    - Verdict line first; sub-fields rendered as blank-line-separated
      bold-led paragraphs (e.g. `**Decided:**`, `**Open:**`, `**Next:**`)
      so each renders on its own line in Claude Code. Indent and
      single-newline separation are CommonMark soft-breaks (collapse to
      spaces) — use blank lines, not indent, to get visible vertical
      separation. **Next:** bold markdown last.

  Content changes (the new shape under **CONFIDENT**):
    - Verdict tokens themselves are bold: `**CONFIDENT**` and `**BLOCKED**`.
      Stronger left-edge scan anchor than bare CONFIDENT/BLOCKED. Safe — no
      downstream parser regexes the verdict (verified during F14BG2 research).
    - `**Decided:**` — 1-2 sentences naming the actual choice in plain English.
    - `**Rejected:**` — alternatives considered with a one-line reason each.
      Omit the paragraph entirely when no real alternatives were on the table
      (don't render an empty label).
    - `**Open:**` — must terminate as one of: `resolved this turn` /
      `deferred to <ticket-or-follow-up>` / `none`. No punts.
    - `**Next:**` — one concrete imperative.

  Each sub-field is its own paragraph (blank line above and below) so they
  render as stacked short paragraphs in Claude Code rather than collapsing
  into one line.

  **BLOCKED** structure (`**Tried:**` / `**Need:**` / optional parallel
  action) — sub-fields also rendered as blank-line-separated bold-led
  paragraphs for consistency with CONFIDENT. Token bolded. Semantics
  unchanged.

  Plain-English guard: no jargon the reader hasn't seen this turn.
  Bullet-sprawl guard: bullets only when items are genuinely parallel
  (3+ of the same shape); otherwise prose inside the labeled sub-field.

  Re-sync `.safeword/hooks/lib/quality.ts` from the canonical template per
  the project's template-is-canonical rule.
out_of_scope: |
  - Per-phase Decided/Rejected/Open content templates. Each phase has different
    decisions to recap; keep the labels universal and let phase-specific
    PHASE_EVIDENCE strings suggest content inside each label. Per-phase
    decision-brief variants are a separate ticket if they're needed at all.
  - Auto-generating `Rejected:` content from session history or tool-use logs.
    The hook can't see the model's deliberation; only the model can write what
    it considered. The template prompts for it; the model authors it.
  - Per-phase worked examples (few-shot per PHASE_EVIDENCE entry). Anthropic's
    recipe recommends few-shot but it touches all 6 PHASE_EVIDENCE + 3
    TDD_STEP_EVIDENCE strings. Separate ticket.
  - XML-wrapping the verdict (`<verdict>…</verdict>`). Rejected: no downstream
    parser, tags would clutter the rendered turn.
  - Adding a third tier (UNCERTAIN). Rejected: 2026 UQ-Agents research shows
    verbalized-confidence inflates and miscalibrates with context length;
    binary stays.
  - Cursor parity changes. QUALITY_REVIEW_MESSAGE export stays unchanged so
    `cursor/stop.ts` keeps working.
  - `getDisqualificationMessage` logic. Unchanged.
  - Per-phase PHASE_EVIDENCE strings. Content unchanged; they concatenate onto
    the new header unchanged.
done_when: |
  - `packages/cli/templates/hooks/lib/quality.ts` UNIVERSAL_HEADER matches the
    new shape: bolded verdict token (`**CONFIDENT**` or `**BLOCKED**`), then
    blank-line-separated bold-led paragraphs `**Decided:**`, optional
    `**Rejected:**`, `**Open:**` (constrained to resolved/deferred/none),
    `**Next:**` under CONFIDENT, and `**Tried:**` / `**Need:**` under BLOCKED.
    Source uses blank lines (not indent) between sub-fields.
  - Rendered output in Claude Code shows visible vertical gaps between
    sub-fields — verdict block is a stacked column of short paragraphs,
    not collapsed into a single line. Verified by eyeball on a real
    Stop-hook fire.
  - The "End with a single verdict — not a list" line is gone; the
    "scannable decision brief" framing and "Reproduce the shape below exactly"
    instruction are present.
  - `.safeword/hooks/lib/quality.ts` re-synced from the template
    (string-identical to the template version).
  - Eyeball check on a real Stop-hook fire: scanning down the left edge of the
    verdict block reveals the choice / alternatives (if any) / open-question
    state / next action without reading any one sentence in full.
  - A reader landing on the final turn with no prior context can act on the
    verdict block alone — no scroll-up required.
  - `packages/cli/tests/quality.test.ts` updated to match the new contract:
    deleted assertions for removed preamble prose ("Think about evidence
    before declaring", "not a list", `Rule: Universal critical review
    applies at every phase` describe block); regression-guard `it.each`
    updated to drop methodology/research-depth substring assertions and
    add new shape assertions (bolded verdict tokens, **Decided:**,
    **Open:**, **Next:**, **Tried:**, **Need:** bolded labels).
    Contract tests preserved (CONFIDENT, BLOCKED, Tried:, Need:, Next:,
    per-phase evidence, BddPhase enum, fallback, falsifiable-answer,
    parallel-action, spec-vs-implementation, disqualification).
  - `npx vitest run tests/quality.test.ts` from `packages/cli/` passes
    with all assertions green.
  - `cursor/stop.ts` still imports `QUALITY_REVIEW_MESSAGE` without modification.
---

# Stop-hook verdict template: scannable decision brief

**Goal:** Reshape the Stop-hook verdict block from a calibrated-token-plus-citation into a self-contained, beginner-friendly, left-edge-scannable decision brief — what was decided, what was rejected and why, what's open, what's next — so the user can act under time pressure without scrolling up.

**Why:** The verdict block is the _user's_ decision surface, not just the model's calibration artifact. Today it produces dense single-paragraph blobs that bury both the verdict token and the `**Next:**` call. The original fix (indent + line breaks) was necessary but not sufficient — a structurally-improved verdict whose Evidence remains a single dense sentence still fails the actual need. The user reads this paragraph to decide: continue, redirect, or intervene. It has to stand alone.

## Parent

[completed/143-stop-hook-binary-terminal](../completed/143-stop-hook-binary-terminal/ticket.md) — established the binary CONFIDENT/BLOCKED contract. This ticket is a shape-and-content refinement; the binary contract is unchanged.

## Research evidence

- **Anthropic Prompting best practices, 2026** ([docs](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices)) — Opus 4.7 interprets prompts literally; recipe is match-prompt-style-to-output-style + literal template + optional few-shot. Indented multi-line template with literal labels is what 4.7's literalism is good at.
- **Anthropic hooks-guide** ([docs](https://code.claude.com/docs/en/hooks-guide)) — Stop hooks inject steering text via `{"decision":"block","reason":"..."}` (not `additionalContext`, which is for other event types); the `reason` is fed back to the model so it keeps working and is NOT itself rendered in the user-visible UI. The model's reply is what renders; Claude Code renders markdown there, so bold `**Next:**` in the template is reproduced literally by Opus 4.7 and renders bold.
- **UQ in LLM Agents, 2026** ([arXiv:2602.05073](https://arxiv.org/html/2602.05073v2)) — verbalized-confidence tokens become "increasingly inflated and unreliable" with dynamically-expanding agent context and noisy observations. Paper calls existing final-answer-correctness evaluation insufficient for agentic settings and calls for new metrics. Supports keeping the binary CONFIDENT/BLOCKED token (no viable verbalized-score replacement is proposed in the literature for this setting).
- **NeurIPS 2025 — Revisiting Uncertainty Estimation and Calibration of LLMs** ([arXiv:2505.23854](https://arxiv.org/abs/2505.23854)) — 80-model study on MMLU-Pro finds linguistic-verbal uncertainty (LVU) outperforms token-probability (TPU) and numerical-verbal (NVU) on calibration and discrimination. Lateral evidence only — MMLU-Pro is Q&A, not agent workflows; agent-workflow generalization is untested. Doesn't directly support binary verdicts, but rules out NVU as a drop-in upgrade.
- **BLUF / ADR / aviation-checklist design** — time-pressed readers scan the left edge for labeled anchors and drop into the named section. Putting the answer first (BLUF), then 2-4 labeled sub-fields (Decided/Rejected/Open/Next) matches the scan pattern; bullet sprawl fights it.
- **SAFEWORD.md "Talking to the user"** — the design constraint the new shape conforms to: lead with the answer, end with `**Next:**`, scan not read, structure only when it carries weight, no bullet sprawl.

## Open decisions (revisitable)

- **`Rejected:` is omit-when-empty** rather than always-render. My lean. Always-render would force the model to either name alternatives or explicitly say "no alternatives considered" — sometimes a useful flag that the option space wasn't actually explored. If we find scope-creep happening because models skip the line, flip this default.
- **`Open:` is constrained to three terminal states** (resolved / deferred / none). This is the strongest content constraint in the template — it makes "open questions" a forced terminal commitment rather than a punt. Revisit if it produces awkward outputs.

## Work Log

- 2026-05-27T03:42:02Z Started: Created ticket F14BG2.
- 2026-05-27T03:46:00Z Filled: scope/out_of_scope/done_when frontmatter, parent link, research evidence. Phase stays intake.
- 2026-05-27T04:21:00Z Expanded scope after user feedback: "this section needs to give me a self-contained explanation of everything I need to know to make a decision … explain it like I'm an idiot … scannable since I'm in a rush." Original scope was shape-only (indent + line breaks + bold); insufficient because Evidence prose could still be dense. Reframed as a decision-brief: Decided/Rejected/Open/**Next:** labeled sub-fields. Two new out_of_scope items added (per-phase Decided content templates; auto-generating Rejected from session history). Sizing stays patch — one string in one file; design discovery happened in conversation, not code. `Rejected:` optional + `Open:` constrained-to-three-states flagged as revisitable design choices.
- 2026-05-27T04:25:00Z Rendering mechanism locked: blank-line-separated bold-led paragraphs (option A from a three-way weigh: A=blank-lines-stacked-paragraphs, B=hard-breaks-via-trailing-spaces, C=bullet-list). Root cause traced: CommonMark soft-breaks (single newline) collapse to spaces; indent inside a paragraph does nothing. Picked A because robust to formatters (B's trailing whitespace is fragile, C optically reads as bullet sprawl). Scope clause updated to specify blank lines (not indent); done_when item added requiring eyeball-check of visible vertical gaps in rendered output. Whitespace cost accepted as right tradeoff for time-pressed scanability.
- 2026-05-27T04:34:00Z Verdict tokens bolded: `**CONFIDENT**` and `**BLOCKED**` instead of bare CONFIDENT/BLOCKED. Stronger left-edge scan anchor. Safe because no downstream parser regexes the token (verified during the earlier research pass). BLOCKED sub-fields also bolded (`**Tried:**`, `**Need:**`) for consistency. Also: split out a follow-up ticket [QSNKBB-prompt-brevity-cut](../QSNKBB-prompt-brevity-cut/ticket.md) for the preamble brevity work that the user flagged as out-of-scope for F14BG2 — same string, different concern.
- 2026-05-27T04:40:00Z Sizing bumped patch→task; phase advanced intake→implement. Discovered at start-of-implement: `packages/cli/tests/quality.test.ts` heavily locks in the exact preamble prose F14BG2+QSNKBB are removing. The test file (286 lines) has explicit assertions for every cut line ("Think about evidence", "not a list", "investigate primary sources", "blog posts/tweets/marketing", "research depth", "correctness/elegance/no-bloat") plus a regression-guard `it.each` that asserts the same substrings across every phase. So `do it` requires test updates as part of the implementation, not separately. Test-update scope added to done*when. Also caught a spec slip in my prior draft template: dropped "human input" from the BLOCKED-scope line which the existing test correctly enforces — restoring, because it signals BLOCKED needs a \_human* to unblock (not just any external action). Coordinating with QSNKBB to land together as one PR (same string, same test file).
- 2026-05-27T04:50:00Z Implemented. Edited [packages/cli/templates/hooks/lib/quality.ts](../../../packages/cli/templates/hooks/lib/quality.ts) UNIVERSAL_HEADER + file-header comment block. Synced runtime [.safeword/hooks/lib/quality.ts](../../../.safeword/hooks/lib/quality.ts) (string-identical to template). Rewrote [packages/cli/tests/quality.test.ts](../../../packages/cli/tests/quality.test.ts): deleted "Think about evidence" + "not a list" + `Rule: Universal critical review` describe block + `Rule: Research depth matches claim weight` describe block; added `Rule: CONFIDENT carries a decision brief`, `Rule: Decision-brief framing (F14BG2)`, `Rule: Brevity discipline (QSNKBB) — no duplication of SAFEWORD.md` describe blocks; updated regression-guard `it.each` to assert new bolded labels and to negative-assert the cut prose. Caught two more integration tests with prose-dependent assertions (`hooks.test.ts:1003,1047` and `stop-hook-transcript-format.test.ts:218,230` both asserted `'critical review'`/`'evidence before declaring'`); updated to assert `'CONFIDENT'` / `/\*\*CONFIDENT\*\*|decision brief/i` instead (verdict-token contract is stable, prose isn't). Test run: 10 files / 216 tests / 216 pass.
- 2026-05-27T04:56:00Z Cross-scenario /refactor pass. Two candidates surfaced; one fixed, one rejected with rationale: (1) FIXED — [packages/cli/templates/skills/quality-review/SKILL.md:84](../../../packages/cli/templates/skills/quality-review/SKILL.md) described the hook as "checks correctness/elegance/bloat" — that's the line we removed. Updated to "Hook prompts for the decision-brief verdict and per-phase evidence; you verify versions, primary-literature claims, and ecosystem context the hook can't see." Synced runtime copy at [.claude/skills/quality-review/SKILL.md](../../../.claude/skills/quality-review/SKILL.md). (2) REJECTED — the negative-substring assertions appear in both `Rule: Brevity discipline` (exhaustive single-check) and the regression-guard `it.each` (sampled per-phase check). Could extract to `const CUT_PHRASES = [...]`. Left as-is because the two sites have intentionally different purposes (rule = design contract; guard = per-phase regression sample) and extracting would conflate them. Re-ran tests: 3 files / 99 tests / 99 pass.
- 2026-05-27T05:02:00Z /quality-review applied. Four ticket-evidence corrections (code/tests unchanged): (1) hooks-guide URL: dropped `.md` suffix (the canonical page is at the bare path). (2) Hooks-guide bullet: rewrote to name the actual Stop-hook mechanism — `{"decision":"block","reason":"..."}`, NOT `additionalContext` (which is for UserPromptSubmit/PreToolUse/SessionStart event types only). Substance unchanged (steering not display); only the mechanism name was wrong. The code at [stop-quality.ts:510](../../../.safeword/hooks/stop-quality.ts) already uses `softBlock(...)` which emits the correct payload. (3) UQ-Agents 2026 bullet: softened "no SOTA replacement for binary terminal verdicts" to match what the paper actually says (final-answer-correctness insufficient for agentic settings; calls for new metrics) — supports keeping binary because no viable verbalized-score replacement is proposed, but stops short of an absolute no-replacement claim. (4) NeurIPS 2025 citation: corrected arXiv ID (2505.23854, not the unstated one) and rewrote the finding — paper is on MMLU-Pro Q&A across 80 models, finds LVU outperforms TPU/NVU on calibration, NOT a null result and NOT an agent-success study. Re-labelled as lateral evidence only. All four issues were ticket-documentation errors, not implementation errors — verified by parallel web-research agents fetching the actual docs/papers this session.
