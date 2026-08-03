# Spec: Activate Safeword upgrades coherently in Codex

<!--
Product-framing spec for a feature ticket. The engineering contract
(scope / out_of_scope / done_when) lives in ticket.md frontmatter; this
file holds the *why and who*. The bdd intake flow authors it before
engineering scope. Fill each section, then delete the
guidance comments.
-->

## Intent

Install the new Safeword release immediately, but report activation only after
Codex restarts and loads one coherent skills-and-hooks catalogue.

## Intake Brief

<!-- The decide-to-build framing for substantial features (advisory — write
`skip: <reason>` on any line that doesn't apply). Intent above is the positive
"why"; this is who asked, the cost of NOT doing it, and how reversible it is.
If cost-of-inaction is low and reversibility is high, ask whether this is a
feature at all, or a leaner task. -->

- **Requested by:** Safeword maintainer preparing the post-v0.70 Codex upgrade path.
- **Cost of inaction:** A new task can combine stale skills with current hooks while Safeword incorrectly reports activation, undermining release verification and hook trust.
- **Reversibility:** Two-way door. User-facing language and installer orchestration can be reverted; the legacy marker remains readable during the transition.

## References

- [OpenAI Plugins](https://learn.chatgpt.com/docs/plugins)
- [OpenAI Codex CLI commands](https://learn.chatgpt.com/docs/developer-commands?surface=cli#cli-codex-plugin)
- [Package a plugin](https://developers.openai.com/plugins/build/package)
- GitHub issue #1755 covers the broader published-artifact upgrade matrix; this feature changes the upgrade contract itself.

## Personas

- Technical Builder (TBU)

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

Affected:

- OpenAI Codex
- Safeword CLI

Unaffected:

- Claude Code — its project-local auto-upgrade lifecycle is unchanged.
- Cursor — its project-local auto-upgrade lifecycle is unchanged.

## Vocabulary

- **Current task:** The already-running Codex task whose plugin inventory and hooks were loaded when the task began.
- **Restart-bound activation:** The installed plugin is active only after a restarted Codex app loads it.

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

### codex-plugin-next-task-upgrades.TBU1 — Upgrade without mixing plugin snapshots

**Persona:** Technical Builder (TBU)

> When a new Safeword plugin version is released while Codex is running, I want
> to install it immediately and know exactly when it takes effect, so I can keep
> working without mixing stale skills and current hooks.

#### codex-plugin-next-task-upgrades.TBU1.R1 — Installation refreshes an existing Git marketplace before selecting the released plugin

#### codex-plugin-next-task-upgrades.TBU1.R2 — Installation status requires a Codex restart and never treats a same-app task as activated

#### codex-plugin-next-task-upgrades.TBU1.R3 — Activation proof belongs to the exact installed release and a restarted Codex app

#### codex-plugin-next-task-upgrades.TBU1.R4 — Invalid legacy markers never manufacture activation proof

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

### codex-plugin-next-task-upgrades — Upgrade with proof

- **Moment:** After restart, status proves the new app instance loaded the exact installation rather than trusting a timestamp.
- **Beats:** A green status that hides stale skills behind current hooks.
- **They'd say:** "Safeword can prove the app actually reloaded the plugin I installed."

## Outcomes

- Fresh installations and upgrades both converge through documented Codex CLI operations.
- Upgrade output distinguishes installation from activation and requires a Codex restart.
- Same-app tasks remain pending; tasks after restart load the newly installed, trusted bundle.
- Profiles with v0.70-era restart markers transition without manual cleanup.

## Open Questions

<!-- Unresolved questions surfaced during intake — the spec's running list of
what we don't know yet (the equivalent of Example Mapping's red "question"
cards). Add one per line as they come up; before advancing to define-behavior,
resolve each (answer it, then delete the line) or record `defer: <reason>` for
a deliberate punt. A long unresolved list means intake isn't done — keep
converging. Delete this comment when you add real questions. -->

None.
