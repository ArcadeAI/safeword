---
id: QSNKBB
slug: prompt-brevity-cut
type: task
phase: done
status: done
created: 2026-05-27T04:31:41.643Z
last_modified: 2026-05-27T04:40:00.000Z
parent: F14BG2-stop-hook-verdict-shape
scope: |
  Cut the duplicated philosophy preamble from UNIVERSAL_HEADER in
  `packages/cli/templates/hooks/lib/quality.ts`. The hook re-injects four
  rules every Stop fires; three are covered better and more durably in
  SAFEWORD.md. Repeating them every turn dilutes attention on the
  load-bearing instructions (verdict shape, BLOCKED distinction) and
  trains the model toward verbose-philosophy outputs by style mismatch.

  Cut entirely (covered by SAFEWORD.md "Authority: docs and research,
  not memory" section, lines 146-158):
    - "On uncertainty or contested choice: investigate primary sources,
      enumerate options, debate against correctness/elegance/no-bloat,
      recommend." (Duplicates /figure-it-out reference in SAFEWORD.md.)
    - "Match research depth to claim weight — code/docs for syntax and
      usage; primary literature (peer-reviewed papers, lab tech reports,
      credible preprints) for design choices, novel approaches, or
      empirical claims. Blog posts, tweets, and marketing don't count."
      (Verbatim in SAFEWORD.md.)

  Compress to one line (diffuse but real elsewhere — Verify phase, Code
  Philosophy, /figure-it-out trigger):
    - "Think about evidence before declaring. Apply universal critical
      review: verify correctness, simplicity, and alignment with latest
      docs/research." → cut to a single short imperative or fold into
      the verdict-framing line.

  Keep as one-liners (load-bearing, not articulated elsewhere):
    - "BLOCKED is for spec/scope/value decisions; implementation calls
      are yours." (Distinguishes terminal states. Without it the model
      BLOCKs too eagerly.)
    - "Multiple unknowns: resolve the small ones, BLOCK on the largest."
      (Prevents over-BLOCKing. Not covered elsewhere.)

  Re-sync `.safeword/hooks/lib/quality.ts` from the canonical template
  per the project's template-is-canonical rule.

  Coordinate with F14BG2 — both touch UNIVERSAL_HEADER. Either rebase
  this PR on top of F14BG2 if F14BG2 ships first, or land them together
  as one PR if they haven't yet shipped.
out_of_scope: |
  - Touching PHASE_EVIDENCE strings, TDD_STEP_EVIDENCE strings,
    `getDisqualificationMessage`, or `QUALITY_REVIEW_MESSAGE` export.
    All unchanged.
  - The verdict template shape itself (Decided/Rejected/Open/Next
    labels, blank-line-separated bold-led paragraphs, bolded verdict
    tokens) — that's F14BG2's scope.
  - Removing the BLOCKED-scope distinction or the multiple-unknowns
    rule. Both load-bearing.
  - Moving content into SAFEWORD.md that isn't already there. The cut
    rules are already covered; this ticket removes duplication, doesn't
    add anything.
  - Updating CLAUDE.md to absorb the cut rules. Already covered by
    SAFEWORD.md (which CLAUDE.md transitively loads).
  - Cursor parity changes. `cursor/stop.ts` consumes
    `QUALITY_REVIEW_MESSAGE` which keeps the implement/default form;
    that form gets the same preamble cut.
done_when: |
  - UNIVERSAL_HEADER in `packages/cli/templates/hooks/lib/quality.ts`
    has the two duplicated rules (research-depth-scaling block,
    on-uncertainty-investigate block) removed entirely.
  - The "Think about evidence / apply critical review" rule compressed
    to one short line or merged into the verdict-framing line.
  - The two kept rules (BLOCKED-is-for-spec/scope/value, multiple-
    unknowns) appear as standalone one-liners.
  - `.safeword/hooks/lib/quality.ts` re-synced from the template
    (string-identical).
  - Net prose preamble shrinks materially (target: ~7 lines of
    philosophical prose cut from the previous ~10-line preamble).
  - `packages/cli/tests/quality.test.ts` updated to drop the assertions
    that locked the cut prose in place: "Think about evidence" assertion,
    the `Rule: Universal critical review applies at every phase` describe
    block (correctness/simplicity/docs-research + investigate-primary-
    sources + correctness/elegance/no-bloat), the `Rule: Research depth
    matches claim weight` describe block (research-depth/claim-weight +
    primary-literature/peer-reviewed + blog-posts/tweets/marketing), and
    the corresponding substring lines in the regression-guard `it.each`.
    Contract tests preserved (verdict tokens, sub-fields, per-phase
    evidence, BLOCKED-spec-vs-implementation, parallel-action,
    falsifiable-answer, disqualification).
  - `npx vitest run tests/quality.test.ts` from `packages/cli/` passes.
  - Cursor stop hook output (which uses `QUALITY_REVIEW_MESSAGE` / the
    default implement form) keeps the same two load-bearing rules.
  - A turn-by-turn comparison on a real Stop-hook fire shows: model's
    verdict still cites evidence and research where appropriate (the
    behavior the cut rules were trying to enforce hasn't degraded —
    because the rules still live in SAFEWORD.md which loads every
    conversation).
---

# Stop-hook UNIVERSAL_HEADER: cut duplicated preamble

**Goal:** Cut ~7 lines of philosophical preamble from the Stop-hook UNIVERSAL*HEADER. Every cut line is already covered (verbatim or better) in SAFEWORD.md, which loads every conversation. Keep only rules that are about the \_terminal verdict* itself and the _spec-vs-implementation distinction_ that the rest of the project doesn't sharply articulate.

**Why:** The hook re-teaches project philosophy every Stop fires. Three of the four preamble rules are duplicates of better-stated versions in SAFEWORD.md (the `/figure-it-out` reference and the "Authority: docs and research" section). Repeating them every turn (a) dilutes attention on the load-bearing instructions next to them — system-message repetition fatigue is a known dilution effect per Anthropic's late-2025 prompt-engineering guidance; (b) trains verbose-philosophy verdicts via the match-prompt-style-to-output-style principle; (c) wastes tokens and reader attention every turn for zero marginal information.

## Parent

[F14BG2-stop-hook-verdict-shape](../F14BG2-stop-hook-verdict-shape/ticket.md) — the verdict-shape ticket. Both touch UNIVERSAL_HEADER. Coordinate: rebase QSNKBB onto F14BG2 if F14BG2 ships first, or land both as one PR if they ship together.

## Coverage check (one-time evidence, not a recurring criterion)

Verified against `.safeword/SAFEWORD.md` at intake:

- **"Match research depth to claim weight"** + the peer-reviewed/lab/marketing list → SAFEWORD.md:146-158 ("Authority: docs and research, not memory"). The "Blog posts, tweets, marketing… don't count" line is verbatim.
- **"On uncertainty or contested choice: investigate primary sources, enumerate options, debate"** → SAFEWORD.md:156 ("Design choices … call `/figure-it-out`. Its iron law: no recommendation without current evidence. It enumerates research domains, fetches live docs, and weighs options before committing.")
- **"Think about evidence before declaring; apply universal critical review"** → diffuse coverage: Verify phase + Code Philosophy ("Optimize for Clarity → Simplicity → Correctness") + /figure-it-out trigger. Not one verbatim line. Compress, don't cut outright.
- **"Implementation choices are yours; BLOCKED is for spec/scope/value"** → not articulated elsewhere. Keep.
- **"Multiple unknowns: resolve the small ones, BLOCK on the largest"** → not elsewhere. Keep.

## Research evidence

- **Anthropic Prompting best practices, 2026** ([docs](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices)) — directly supports: "tell Claude what to do instead of what not to do," match prompt style to output style, and dial down emphatic instruction phrasing (the doc gives the example of replacing "CRITICAL: You MUST..." with "Use this tool when..."). Our design principle that repeating the same rule across multiple loaded contexts down-weights newer instructions is an _inference_ from these guidelines, not a direct citation — labelling it as such.
- **Information theory of duplication (design principle, not Anthropic-sourced)** — when the same rule lives in SAFEWORD.md + CLAUDE.md + every Stop hook, marginal information value of each repeat trends to zero while token and attention cost climb monotonically.

## Open decisions (revisitable)

- **Whether to fold the compressed critical-review one-liner into the verdict-framing sentence** ("End with one verdict as its own scannable decision brief, grounded in evidence …") **or keep it as its own sentence.** My lean: fold, for maximum brevity. Revisit if the verdict-framing line gets unwieldy.

## Work Log

- 2026-05-27T04:32:00Z Started: Created ticket QSNKBB. Split out from F14BG2 per user direction. Coverage check completed inline against SAFEWORD.md:146-158; three of four preamble rules confirmed duplicated, one (critical-review) confirmed diffuse-but-real elsewhere, two kept rules confirmed not elsewhere. Sized as patch — one string in one file. Sequenced after (or merged with) F14BG2.
- 2026-05-27T04:40:00Z Sizing bumped patch→task; phase advanced intake→implement. Same discovery as F14BG2: `quality.test.ts` locks in the cut prose via two whole describe blocks (`Rule: Universal critical review applies at every phase`, `Rule: Research depth matches claim weight`) plus substring assertions inside the regression-guard `it.each`. Test-update scope added to done_when. Landing together with F14BG2 as one PR — same string, same test file.
- 2026-05-27T04:50:00Z Implemented (shared edit with F14BG2). Preamble cut: dropped two SAFEWORD.md-duplicated blocks ("Match research depth to claim weight" + peer-reviewed/blog-posts list; "On uncertainty… investigate primary sources… debate"). Compressed the diffuse "Apply universal critical review" rule into the new verdict-framing sentence's "scannable decision brief" + "plain English" wording (folded per the revisitable design choice — my lean was fold, no pushback received). Kept the two load-bearing one-liners as their own paragraph ("Implementation choices are yours. BLOCKED is for spec/scope/value decisions that need human input. Multiple unknowns: resolve the small ones, BLOCK on the largest."). File-header comment block also rewritten to remove duplicated philosophy and add a "Style discipline: this prompt is reinjected every Stop — keep it terse" note for future maintainers. Net preamble: ~10 lines of philosophical prose → 1 line of framing + 1 line of two kept rules. Quality.test.ts updated with `Rule: Brevity discipline (QSNKBB) — no duplication of SAFEWORD.md` describe block that negative-asserts the cut prose lives nowhere in the header anymore. 10 files / 216 tests / 216 pass.
- 2026-05-27T05:02:00Z /quality-review applied. One ticket-evidence correction (code/tests unchanged): "repeated content dilutes newer instructions" was framed as Anthropic-sourced; the docs actually support tone-down ("use more normal prompting" instead of "CRITICAL: You MUST...") but don't make the literal dilution claim. Re-labelled the dilution argument as a design principle ("Information theory of duplication — design principle, not Anthropic-sourced") and noted that the Anthropic-sourced part is the dial-back guidance plus match-prompt-style-to-output-style. The brevity-cut decision still holds — the actual Anthropic guidance supports it (tell-what-to-do, dial-back emphatic phrasing, style-match), the dilution framing was my gloss not a direct citation. Verified by web-research agent fetching the actual prompt-engineering best practices page this session.
