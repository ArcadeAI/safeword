# Spec: {title}

<!--
Product-framing spec for a feature ticket. The engineering contract
(scope / out_of_scope / done_when) lives in ticket.md frontmatter; this
file holds the *why and who*. The bdd intake flow authors it before
engineering scope. Fill each section, then delete the
guidance comments.
-->

## Intent

<!-- One or two sentences: what this feature is for and why it matters.
This is the single source of truth for motivation — ticket.md drops its
**Why:** line and points here. -->

## Intake Brief

<!-- The decide-to-build framing for substantial features (advisory — write
`skip: <reason>` on any line that doesn't apply). Intent above is the positive
"why"; this is who asked, the cost of NOT doing it, and how reversible it is.
If cost-of-inaction is low and reversibility is high, ask whether this is a
feature at all, or a leaner task. -->

- **Requested by:** <who asked for this — distinct from the persona it serves>
- **Cost of inaction:** <what changes, breaks, or is lost if we don't build it>
- **Reversibility:** <how hard to undo once shipped — one-way or two-way door; cross-cutting changes (data model, public API, migration) count as one-way>

## References

<!-- Related tickets, prior art, designs, external docs. Optional. -->

## Personas

<!-- The personas this feature serves, referenced by name or code from
the configured personas file (e.g., Platform Operator (PLO)). Add new
personas to that file — don't invent them here. -->

## Surfaces

<!-- Optional: supported product, agent, runtime, protocol, client, or
deployment contexts this feature affects. Prefer names from the configured
surfaces file. Use spec-local names only for one-off contexts.

Affected:
- <surface name>

Unaffected:
- <surface name> — <reason>

Each affected surface should be covered by at least one saved scenario tagged
`@surface.<slug>` (OpenAI Codex -> `@surface.openai-codex`) or carry
`skip: <reason>` on the Affected line. -->

## Vocabulary

<!-- Domain terms specific to this feature, consistent with
the configured glossary file. Optional. -->

## Jobs To Be Done

<!--
One persona per JTBD, in the form "When I …, I want …, so I can …". If two
personas share a motivation, write two JTBDs. The heading id is
<slug>.<persona-code><n> (e.g., oauth-flow.PLO1). Add as many as the
feature needs. If there is genuinely no persona-facing job (internal
plumbing), write `skip: <reason>` here instead.

Uncomment and customize:

### oauth-flow.PLO1 — Rotate credentials without a flag day

**Persona:** Platform Operator (PLO)

> When I rotate a server's API key, I want the previous key to keep working
> for a short grace period, so I can roll the change across my fleet without
> coordinated downtime.

Numbered Rules — one testable business invariant per Rule, id <jtbd-id>.R<n>,
stated generally in product language (the invariant a persona relies on), NOT
implementation ("returns 204" belongs in a scenario's Then). Each define-behavior
scenario nests under the Rule it proves. Numbered Rules need a `.feature`
scenario source; the legacy test-definitions.md path stays Acceptance-Criteria-
only. If a JTBD has no user-observable behavior to enumerate, write
`skip: <reason>` under it instead.

Legacy alternative (soft-deprecated): a JTBD may instead declare Acceptance
Criteria — one observable capability per `#### <jtbd-id>.AC<n>`. Still accepted;
one criteria kind per JTBD, never both.

#### oauth-flow.PLO1.R1 — A rotated key's predecessor keeps authenticating for a bounded grace window

#### oauth-flow.PLO1.R2 — Every currently-issued key is visible to the operator as live, grace, or expired
-->

## Rave Moment

<!-- Optional, and only for the highest persona-facing surface in the tree (the
epic if there is one, else this feature). Child features under an epic that
already named one inherit it — skip here; internal/plumbing work skips entirely.
Advisory; never blocks intake exit. The one moment a persona would tell a peer
about: name the moment, the expectation it beats, and the one sentence they'd
repeat. Aim for awe, not "fine." If nothing clears the expectation bar, write
`skip: table-stakes`.

### <slug> — <the moment in a few words>

- **Moment:** <the specific beat they'd screenshot or recount>
- **Beats:** <the dread / status-quo pain / competitor clunk it's measured against>
- **They'd say:** "<the one repeatable, status-conferring sentence>"
-->

## Outcomes

<!-- Observable results that tell us the JTBDs are satisfied — the product
counterpart to ticket.md's done_when. -->

## Open Questions

<!-- Unresolved questions surfaced during intake — the spec's running list of
what we don't know yet (the equivalent of Example Mapping's red "question"
cards). Add one per line as they come up; before advancing to define-behavior,
resolve each (answer it, then delete the line) or record `defer: <reason>` for
a deliberate punt. A long unresolved list means intake isn't done — keep
converging. Delete this comment when you add real questions. -->
