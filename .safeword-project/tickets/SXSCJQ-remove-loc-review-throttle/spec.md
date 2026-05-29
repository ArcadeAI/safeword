# Spec: Per-step / per-phase quality reviews (retire the LOC review throttle)

## Intent

Safeword's stop-quality hook fires one quality review per turn, and during the
implement phase it suppresses that review unless >50 LOC changed since the last
review (`LOC_REVIEW_THRESHOLD`). Two failure modes follow. First, LOC is a poor
proxy for "worth reviewing" — a 5-line change can introduce a real bug while a
60-line rename is noise. Second, and deeper: Stop fires once per turn with the
_final_ state, so a turn that flips RED→GREEN→REFACTOR only reviews the last
step, and a long **autonomous run never hits Stop at all** — so step/phase
reviews silently vanish exactly when no human is watching.

This feature moves the trigger to **PostToolUse edit-detection**: each
`[ ]→[x]` RED/GREEN/REFACTOR flip in test-definitions.md and each `phase:`
change in ticket.md surfaces the matching review live, via
`hookSpecificOutput.additionalContext`. The Stop hook keeps firing (de-throttled)
as a **deduped backstop** for boundaries crossed by a non-edit path. Each
boundary is reviewed exactly once across the two triggers via new
`lastReviewedStep` / `lastReviewedPhase` session-state markers.

## References

- Surfaced by SW1SE5's `/figure-it-out` (2026-05-29) while shipping the stop-gate tsc check, which already runs _before_ the throttle for the same reason.
- Hook output semantics verified against code.claude.com/docs/en/hooks (2026-05-29): PostToolUse supports both `additionalContext` (next to tool result) and `decision:block`; Stop supports `decision:block` only.
- Reuses existing engines: `collectNewTransitions` (`templates/hooks/pre-tool-quality.ts`) for flip-detection, `getQualityMessage` (`templates/hooks/lib/quality.ts`) for review content, `deriveTddStep` (`templates/hooks/lib/active-ticket.ts`).
- Surface flipped from `decision:block` to `additionalContext` via steelman (matches the post-tool-lint advisory precedent; honest "soft" framing).

## Personas

<!-- None declared — `.safeword-project/personas.md` is not bootstrapped. -->

## Vocabulary

<!-- See ticket frontmatter; no new project-wide glossary terms. -->

## Jobs To Be Done

skip: Internal dev-workflow tooling — SXSCJQ tunes safeword's own quality-review
cadence, not a product feature with external personas. The repo's persona model
(`.safeword-project/personas.md`) isn't bootstrapped, and doing so is a separate
concern. (Uses the Y2HCNJ gate's skip valve, as SW1SE5 did.)
