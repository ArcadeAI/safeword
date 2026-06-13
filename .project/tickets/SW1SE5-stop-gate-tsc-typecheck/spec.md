# Spec: Stop-gate incremental tsc for TS projects

<!--
Product-framing spec for a feature ticket. The engineering contract
(scope / out_of_scope / done_when) lives in ticket.md frontmatter; this
file holds the *why and who*. The bdd Phase 0 flow authors it during
intake, before engineering scope. Fill each section, then delete the
guidance comments.
-->

## Intent

Safeword's quality gates run eslint per-edit (`lib/lint.ts`) and tests at the
stop boundary, but only typecheck at the **done gate** (via `/lint` → `tsc
--noEmit`). For TypeScript projects this means type errors accumulate silently
across a whole ticket's commits and surface late — exactly the failure mode
hit while finishing Y2HCNJ. This feature moves a whole-program `tsc --noEmit`
(incremental) to the stop boundary so type debt is caught at the natural
end-of-work-chunk, not minutes-to-sessions later.

## References

- Investigated via `/figure-it-out` while closing Y2HCNJ (2026-05-28).
- File-local typecheck is incorrect — `tsc` is whole-program; pass the project,
  not staged files ([typescript-eslint / TS docs]).
- `--incremental` keeps repeat runs sub-second; TS7 native `tsgo` (early 2026)
  gives ~10× typecheck speedup, shrinking the cost objection.
- Shipped gate that needs changing: `templates/hooks/stop-quality.ts` (+ a
  TS-detection + incremental-cache helper in `templates/hooks/lib/`).

## Personas

<!-- The personas this feature serves, referenced by name or code from
.safeword-project/personas.md (e.g., Platform Operator (PO)). Add new
personas to that file — don't invent them here. -->

## Vocabulary

<!-- Domain terms specific to this feature, consistent with
.safeword-project/glossary.md. Optional. -->

## Jobs To Be Done

skip: Internal dev-workflow tooling — SW1SE5 is a quality gate for safeword's own development, not a product feature with external personas. The repo's persona model (`.safeword-project/personas.md`) isn't bootstrapped yet, and doing so is a separate concern. (Uses the Y2HCNJ gate's skip valve.)

## Outcomes

- A TS project with a type error gets a stop-gate denial (or surfaced warning)
  at the next stop, not only at the done gate.
- The check is whole-program (`tsc --noEmit` over the project), not file-local.
- Repeat runs are cheap (incremental cache); skipped entirely for non-TS
  projects and when no TS files changed in the session.
- No regression to the existing stop-quality test/scenario gates.

<!-- Personas + Jobs To Be Done to be authored in this ticket's Phase 0 once
.safeword-project/personas.md is populated (no personas declared yet). -->
