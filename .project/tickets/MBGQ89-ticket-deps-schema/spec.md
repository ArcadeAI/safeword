# Spec: epic + blocked_on schema and the blocked_on phase gate

## Jobs To Be Done

### ticket-deps-schema.DEV1

**Persona:** Agent-Driven Developer (DEV)

When I'm driving an agent across many tickets that depend on each other, I want the agent stopped from starting work whose prerequisite isn't finished, so I can trust the sequencing without policing every step myself.

#### ticket-deps-schema.DEV1.AC1 — optional canonical fields

`epic` and `blocked_on` are accepted optional frontmatter fields; a ticket carrying neither validates cleanly (no advisory, exit 0).

#### ticket-deps-schema.DEV1.AC2 — relations validation is warn-only

An unresolvable id, a cycle, and a self-cycle each warn (never error, never non-zero exit); a clean corpus is silent. Bare ids only — an unresolvable id is indistinguishable from a typo, so it warns; there is no separate "silent cross-repo" case.

#### ticket-deps-schema.DEV1.AC3 — blocked_on gates phase-advance out of intake

Advancing a ticket's phase out of `intake` is denied while any same-repo `blocked_on` target is not `done`; a target whose status is missing/unreadable fails safe (treated as not done → denied).

#### ticket-deps-schema.DEV1.AC4 — terminal-but-not-done needs a reasoned override

A `cancelled`/`superseded`/`wontfix` blocker does not auto-open the gate; advancing requires a substantive `blocked_on_override` (single reason for the advance), surfaced in the INDEX; a trivial/empty reason is rejected; an override left in place once every blocker is `done` is flagged stale.

#### ticket-deps-schema.DEV1.AC5 — the gate fires only on the intake-exit transition

A `blocked_on` added to a ticket already past intake does not retroactively block (grandfather); a non-phase edit is never blocked; a `blocked_on` cycle short-circuits (surfaced as the block reason) rather than looping.

## Out of scope

See `ticket.md` frontmatter `out_of_scope` — `parent`/`paired_with` + symmetry (no consumer), cross-repo reference syntax, `depends_on` (shipped via AKZJXC), a hard gate on any field but `blocked_on`.
