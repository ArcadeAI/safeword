# Spec: Re-validate a ticket's premise when it's picked up

<!--
Product-framing spec for a feature ticket. The engineering contract
(scope / out_of_scope / done_when) lives in ticket.md frontmatter; this
file holds the *why and who*. The bdd Phase 0 flow authors it during
intake, before engineering scope. Fill each section, then delete the
guidance comments.
-->

## Intent

A ticket can go stale between when it's filed and when it's picked up: other
work lands, branches merge, the bug gets fixed elsewhere, or a dependency
shifts. Acting on a stale premise wastes effort or makes a wrong change.
Safeword's resume path currently jumps straight back to the ticket's phase
("skip Clarify and resume") with no freshness check. This feature adds a quick
re-validation at pickup so the agent confirms the premise still holds — and
surfaces drift to the user — before doing the work.

## References

- This session demonstrated the value: **9P3VVH** — re-read the live
  `.husky/pre-commit` and re-confirmed the bug still reproduced before fixing;
  **Y2HCNJ** — ran a relevance re-check after an `origin/main` merge (confirmed
  no spec.md/JTBD infra had landed) before resuming.
- Builds on SAFEWORD.md's resume behavior ("If the user references a ticket
  ID/slug or says 'resume'/'continue', skip Clarify and resume at the current
  phase") — this inserts a re-validation step into that path.
- Touches (rough): `SAFEWORD.md` resume text + the `session-start-reentry`
  hook / re-entry brief (already surfaces follow-ups); possibly a DISCOVERY
  sub-step. Exact surfaces decided in this ticket's decomposition.

## Personas

<!-- The personas this feature serves, referenced by name or code from
.safeword-project/personas.md (e.g., Platform Operator (PO)). Add new
personas to that file — don't invent them here. -->

## Vocabulary

<!-- Domain terms specific to this feature, consistent with
.safeword-project/glossary.md. Optional. -->

## Jobs To Be Done

<!--
One persona per JTBD, in the form "When I …, I want …, so I can …". If two
personas share a motivation, write two JTBDs. The heading id is
<slug>.<persona-code><n> (e.g., oauth-flow.PO1). Add as many as the
feature needs. If there is genuinely no persona-facing job (internal
plumbing), write `skip: <reason>` here instead.

Uncomment and customize:

### oauth-flow.PO1 — Rotate credentials without a flag day

**Persona:** Platform Operator (PO)

> When I rotate a server's API key, I want the previous key to keep working
> for a short grace period, so I can roll the change across my fleet without
> coordinated downtime.
-->

## Outcomes

- Picking up or resuming a ticket triggers a concise premise re-validation
  before work begins (not a full re-clarify — a freshness check).
- The check covers: does the problem still reproduce / still apply; is the
  scope still current; are dependencies still met; has it been fixed or
  obsoleted by intervening changes (merges, sibling tickets).
- Detected drift is surfaced to the user with a recommendation (proceed,
  re-scope, or close as obsolete) rather than silently acting on it.
- Cheap by default — proportional to ticket size; doesn't re-run the whole
  intake for a one-line patch.

<!-- Personas + Jobs To Be Done to be authored in this ticket's Phase 0 once
.safeword-project/personas.md is populated (no personas declared yet). -->
