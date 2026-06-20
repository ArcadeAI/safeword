---
id: MBGQ89
slug: ticket-deps-schema
title: 'Local ticket schema: 4 relation fields, warn-only + one blocked_on hard gate'
type: feature
phase: define-behavior
status: in_progress
created: 2026-05-24T15:40:55.511Z
last_modified: 2026-06-20T12:34:00Z
scope:
  - Add four optional frontmatter fields to the canonical ticket schema — epic (slug-or-id), parent (id), paired_with (id), blocked_on (array of ids). depends_on already shipped via AKZJXC; out of scope here.
  - Validation is warn-only (extends AKZJXC's validator) — existence of referenced same-repo ids, blocked_on cycles, and paired_with asymmetry all surface as warnings, never errors. Consistent with every existing relations check.
  - ONE hard gate -> blocked_on only - the pre-tool-quality hook denies a ticket.md edit that advances phase out of intake while any same-repo blocked_on id is NOT in a terminal state.
  - Terminal states that UNBLOCK = done, cancelled, superseded, wontfix (option b). A non-terminal blocker (e.g. in_progress, blocked) blocks the advance.
  - Override escape hatch (option c) - an explicit marker lets the author advance past an unmet block on purpose (defuses the stale-status false positive), logged so the override is visible.
  - Hook fires on phase TRANSITION only and grandfathers tickets already past intake - adding blocked_on to an in-flight ticket does not retroactively block it.
  - Bare ids only - cross-repo references are accepted as-is, unvalidated (benign note from safeword check).
out_of_scope:
  - depends_on (shipped via AKZJXC) and its derived blocks rendering.
  - Cross-repo reference syntax (registry / prefixed / path-relative) - bare ids only; defer the registry design until a real cross-repo validation need appears.
  - A hard gate for any field other than blocked_on - epic/parent/paired_with/depends_on stay warn-only.
  - safeword ticket deps/tree/list-blocked-by CLI inspection commands (data is grep-readable).
  - Linear/GitHub Issues/Jira bridging (that is sync-tracker / JS5K5G).
  - Auto-status-propagation (closing parent/epic when children close).
  - Multi-epic membership (epic is singular for v1).
  - Migrating existing tickets to the new fields - adoption is opt-in.
done_when:
  - doc-templates/ticket-template.md documents the four new fields with examples and shows them as optional.
  - safeword check prints a WARNING (does not exit non-zero) on a dangling same-repo ref, a blocked_on cycle, and an asymmetric paired_with.
  - A test ticket whose blocked_on points at an in_progress ticket cannot have its phase advanced out of intake - the Write is denied by pre-tool-quality.ts with a clear "BLOCKED on <id> (status: <status>)" message.
  - The same advance SUCCEEDS once the blocker reaches any terminal state (done/cancelled/superseded/wontfix).
  - The same advance SUCCEEDS when the author sets the explicit override marker, and the override is logged.
  - Adding blocked_on to a ticket already past intake does NOT block further edits (grandfather / transition-only).
  - All new behaviors covered by vitest tests in packages/cli/tests/ following tests/hooks/ and tests/commands/ patterns.
---

# Local ticket schema: four relation fields, warn-only + one blocked_on hard gate

**Goal:** Promote `epic`, `parent`, `paired_with`, and `blocked_on` from ad-hoc free-text frontmatter to canonical fields, validated **warn-only** by `safeword check` — with exactly **one** hard gate: `blocked_on` denies advancing a ticket's phase out of `intake` while a same-repo dependency isn't in a terminal state. (`depends_on` already landed via [AKZJXC](../AKZJXC-ticket-relations/ticket.md); this adds the four siblings and the gate.)

**Why:** Cross-ticket references live as free-text today — nothing catches a typo'd ID, a stale reference, or asymmetric pairing. Making the fields canonical lets the validator surface those. The one place enforcement (not just a warning) earns its keep is the hard dependency: an agent should not be able to start implementing a ticket whose blocker isn't finished — the exact "build the consumer before the contract exists" trap this session hit with the sync-tracker work.

## Scope

### Frontmatter additions

- `epic: <slug-or-id>` — child of the named epic. Nullable, singular for v1. Warn-only.
- `parent: <id>` — sub-ticket of a non-epic ticket (containment, distinct from epic membership). Nullable. Warn-only.
- `paired_with: <id>` — sibling whose work moves in lockstep (typically a cross-repo upstream/downstream pair). Symmetric. Warn-only.
- `blocked_on: [<id>...]` — **hard dependency.** Gates phase advancement (below). Array; empty allowed.
- `depends_on: [<id>...]` — soft dependency, **already shipped via AKZJXC**; listed for completeness only. Not re-implemented here.

### Validation in `safeword check` (warn-only)

Extends AKZJXC's existing relations validator — same warn-not-error posture for all of:

- **Existence** — a same-repo ref that resolves to no ticket → warning.
- **Cycle** — `A blocked_on B blocked_on A` → warning.
- **Paired symmetry** — `A paired_with B` but B doesn't point back → warning.

No `safeword check` failure exits from relations. Enforcement lives only in the hook, only for `blocked_on`.

### The one hard gate (pre-tool-quality hook)

Joins the existing phase-advancement gates in `pre-tool-quality.ts` (scenario-gate, test-defs-before-code, refactor commit gate):

- On a `ticket.md` edit that moves `phase:` **out of `intake`**, walk `blocked_on`. For each same-repo id whose `status` is **not terminal**, `deny()` with:

  ```text
  BLOCKED on <ID> (status: <status>): <title>
  ```

- **Terminal = `done | cancelled | superseded | wontfix`** (option b) — a cancelled/superseded blocker no longer blocks (avoids the dead-blocker trap).
- **Override (option c):** an explicit marker (e.g. `blocked_on_override: <reason>` in frontmatter, or a documented force token) lets the author advance past an unmet block on purpose; the override is logged so it's visible in review. Defuses the stale-status false positive (blocker done in fact but not yet flipped).
- **Transition-only + grandfather:** fires only on the intake→next transition; a `blocked_on` added to a ticket already past intake does not retroactively block it.
- Cross-repo ids (unresolvable same-repo) are treated as opaque — never block.

## Out of scope

- A hard gate for any field other than `blocked_on` — the rest stay warn-only.
- Cross-repo reference syntax (registry / prefixed / path-relative) — bare ids only; defer the registry.
- CLI inspection commands, Jira/GitHub/Linear bridging (that's [sync-tracker](../JS5K5G-sync-tracker/ticket.md)), auto-status-propagation, multi-epic membership, retroactive migration.

## Open questions (mostly resolved)

- **"Done" definition** — RESOLVED: terminal = done/cancelled/superseded/wontfix (option b), plus an explicit override (option c).
- **Override marker shape** — `blocked_on_override:` frontmatter field vs a one-time force token. Lean: frontmatter field carrying a reason (greppable, reviewable, survives in history).
- **Symmetry strictness** — RESOLVED: warning, never error.
- **Resume behavior** — RESOLVED: grandfather / transition-only.

## Work Log

- 2026-05-24T15:40:55.511Z Started: Created ticket MBGQ89
- 2026-05-24T15:41:00.000Z Drafted: Initial scope with CLI features and arcade pairing
- 2026-05-24T16:50:00.000Z Refactored: Removed epic/paired_with frontmatter to stand alone; dropped CLI commands to out-of-scope (YAGNI); rewrote body to be generic
- 2026-06-20 Motivating case (B6MZ4Z session): an agent filed `5JSH4C` as a duplicate because nothing surfaced similar tickets at `ticket new`; `/quality-review` later cancelled it — justification for a similarity nudge at creation.
- 2026-06-20T11:56:00Z De-duped against AKZJXC: dropped `depends_on` (already shipped), narrowing to the remaining four fields + a phase-gating hook on `blocked_on`.
- 2026-06-20T12:34:00Z Re-scoped post-collapse (epic WG3Z2N deleted; removed epic membership). Made all validation **warn-only** (consistent with AKZJXC) and kept exactly ONE hard gate on `blocked_on`. Set the gate semantics per user: terminal states done/cancelled/superseded/wontfix unblock (b) + explicit logged override (c); transition-only + grandfather. Dropped cross-repo syntax to out-of-scope. Confirmed the gate joins the existing pre-tool-quality phase-gate family (scenario-gate, test-defs-before-code, refactor commit gate) — not a lone exception.
