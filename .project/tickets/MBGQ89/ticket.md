---
id: MBGQ89
slug: ticket-deps-schema
title: 'Local ticket schema: epic + blocked_on, warn-only + one blocked_on hard gate'
type: feature
phase: define-behavior
status: in_progress
created: 2026-05-24T15:40:55.511Z
last_modified: 2026-06-20T16:18:00Z
scope:
  - Add TWO optional frontmatter fields to the canonical ticket schema — epic (slug-or-id, already used informally + rendered in INDEX) and blocked_on (array of ids, the gated dependency). depends_on already shipped via AKZJXC. parent + paired_with deferred (no consumer yet).
  - Validation is warn-only (extends AKZJXC's validator) — existence of referenced same-repo ids and blocked_on cycles surface as warnings, never errors. Consistent with every existing relations check.
  - ONE hard gate -> blocked_on only - the pre-tool-quality hook denies a ticket.md edit that advances phase out of intake while any same-repo blocked_on id is NOT done.
  - Only `done` is a clean auto-unblock (it means the awaited work exists). cancelled/superseded/wontfix are terminal-but-abandoned — they do NOT auto-open the gate; advancing past them requires the override (below). Mirrors GitHub Actions `!cancelled()`: succeeded and cancelled are different signals.
  - Override is the single mechanism for every non-done case: a `blocked_on_override: <reason>` frontmatter field opens the gate. Reason is required and non-trivial (empty / "proceeding" / "n/a" rejected); it lands in the ticket (greppable, commit-visible, surfaced in INDEX) so the deliberate bypass is reviewable — an agent cannot silently free-pass.
  - Stale-override hygiene: if the gate would now pass cleanly (every blocker is `done`) while an override is still present, safeword check WARNS to remove it.
  - Hook fires on phase TRANSITION only and grandfathers tickets already past intake. KNOWN GAP (acknowledged): a blocked_on added after intake has no enforcement teeth until the next transition — accepted to avoid surprise regressions on resume.
  - Cycle short-circuit: if the hook detects a blocked_on cycle while walking, it stops and surfaces the cycle as the block reason rather than walking a cyclic graph.
  - Bare ids only - cross-repo references are accepted as-is, unvalidated (benign note from safeword check).
out_of_scope:
  - parent + paired_with fields and the paired_with symmetry check - deferred until something consumes them (no current reader; YAGNI).
  - depends_on (shipped via AKZJXC) and its derived blocks rendering.
  - Cross-repo reference syntax (registry / prefixed / path-relative) - bare ids only; defer the registry design until a real cross-repo validation need appears.
  - A hard gate for any field other than blocked_on - epic/depends_on stay warn-only.
  - safeword ticket deps/tree/list-blocked-by CLI inspection commands (data is grep-readable).
  - Linear/GitHub Issues/Jira bridging (that is sync-tracker / JS5K5G).
  - Auto-status-propagation (closing parent/epic when children close).
  - Multi-epic membership (epic is singular for v1).
  - Migrating existing tickets to the new fields - adoption is opt-in.
done_when:
  - doc-templates/ticket-template.md documents the two new fields (epic, blocked_on) with examples and shows them as optional.
  - safeword check prints a WARNING (does not exit non-zero) on a dangling same-repo ref and a blocked_on cycle.
  - A test ticket whose blocked_on points at an in_progress ticket cannot have its phase advanced out of intake - the Write is denied by pre-tool-quality.ts with a clear "BLOCKED on <id> (status: <status>)" message.
  - The same advance SUCCEEDS once the blocker reaches `done` (the only clean auto-unblock).
  - With the blocker at cancelled/superseded/wontfix, the advance is STILL denied until a non-trivial `blocked_on_override: <reason>` is set; then it succeeds and the override is visible in the ticket + INDEX.
  - An override with an empty / trivial reason ("proceeding", "n/a") is rejected.
  - safeword check WARNS when an override is present but every blocker is already `done` (stale override to clean up).
  - The hook surfaces a blocked_on cycle as the block reason instead of walking the cyclic graph.
  - Adding blocked_on to a ticket already past intake does NOT block further edits (grandfather / transition-only).
  - All new behaviors covered by vitest tests in packages/cli/tests/ following tests/hooks/ and tests/commands/ patterns.
---

# Local ticket schema: epic + blocked_on, warn-only + one blocked_on hard gate

**Goal:** Promote `epic` and `blocked_on` from ad-hoc free-text frontmatter to canonical fields, validated **warn-only** by `safeword check` — with exactly **one** hard gate: `blocked_on` denies advancing a ticket's phase out of `intake` while a same-repo dependency isn't `done` (other terminal states need a reasoned override). (`depends_on` already landed via [AKZJXC](../AKZJXC-ticket-relations/ticket.md); `parent`/`paired_with` are deferred — no consumer yet.)

**Why:** Cross-ticket references live as free-text today — nothing catches a typo'd ID or a stale reference. Making the two load-bearing fields canonical lets the validator surface those. The one place enforcement (not just a warning) earns its keep is the hard dependency: an agent should not be able to start implementing a ticket whose blocker isn't finished — the exact "build the consumer before the contract exists" trap this session hit with the sync-tracker work.

## Scope

### Frontmatter additions

- `epic: <slug-or-id>` — child of the named epic. Nullable, singular for v1. Warn-only. (Already used informally and rendered in the INDEX — this canonicalizes it.)
- `blocked_on: [<id>...]` — **hard dependency.** Gates phase advancement (below). Array; empty allowed.
- `depends_on: [<id>...]` — soft dependency, **already shipped via AKZJXC**; listed for completeness only. Not re-implemented here.
- **Deferred:** `parent` (sub-ticket containment) and `paired_with` (cross-repo lockstep sibling, + its symmetry check) — added when a real consumer appears, not speculatively.

### Validation in `safeword check` (warn-only)

Extends AKZJXC's existing relations validator — same warn-not-error posture for:

- **Existence** — a same-repo ref that resolves to no ticket → warning.
- **Cycle** — `A blocked_on B blocked_on A` → warning.

No `safeword check` failure exits from relations. Enforcement lives only in the hook, only for `blocked_on`.

### The one hard gate (pre-tool-quality hook)

Joins the existing phase-advancement gates in `pre-tool-quality.ts` (scenario-gate, test-defs-before-code, refactor commit gate):

- On a `ticket.md` edit that moves `phase:` **out of `intake`**, walk `blocked_on`. For each same-repo id whose `status` is **not `done`**, `deny()` with:

  ```text
  BLOCKED on <ID> (status: <status>): <title>
  ```

- **`done` is the only clean auto-unblock** (`figure-it-out` 2026-06-20). It's the one status meaning "the awaited work now exists." `cancelled`/`superseded`/`wontfix` are terminal-but-**abandoned** — the work will never exist as specified, which is exactly when a human should confirm the dependent is still valid. They do not auto-open the gate. Mirrors GitHub Actions `if: !cancelled()` — succeeded and cancelled are distinct signals, not one green light.
- **Override** is the single mechanism for every non-`done` case: `blocked_on_override: <reason>` in frontmatter opens the gate. The reason is **required and non-trivial** (empty / "proceeding" / "n/a" → rejected); it lives in the ticket (greppable, commit-visible, surfaced in INDEX) so the deliberate bypass is reviewable. An autonomous agent cannot silently free-pass — it must write a real reason, which a human sees.
- **Stale-override hygiene:** if every blocker is now `done` but an override is still present, `safeword check` warns to remove it. (Because only `done` auto-opens, the common path needs no override — so overrides are rare and their persistence is meaningful, not noise.)
- **Transition-only + grandfather:** fires only on the intake→next transition. **Known gap (accepted):** a `blocked_on` added _after_ intake has no enforcement teeth until the next transition — traded to avoid surprise regressions on resume.
- **Cycle short-circuit:** on detecting a `blocked_on` cycle while walking, stop and surface the cycle as the block reason rather than traversing a cyclic graph.
- Cross-repo ids (unresolvable same-repo) are treated as opaque — never block.

## Out of scope

- A hard gate for any field other than `blocked_on` — the rest stay warn-only.
- Cross-repo reference syntax (registry / prefixed / path-relative) — bare ids only; defer the registry.
- CLI inspection commands, Jira/GitHub/Linear bridging (that's [sync-tracker](../JS5K5G-sync-tracker/ticket.md)), auto-status-propagation, multi-epic membership, retroactive migration.

## Open questions (resolved)

- **"Done" definition** — RESOLVED (`figure-it-out` 2026-06-20): only `done` auto-unblocks; cancelled/superseded/wontfix require the reasoned override. Cite GitHub Actions `!cancelled()`.
- **Override marker shape** — RESOLVED: `blocked_on_override: <reason>` frontmatter field, non-trivial reason required, surfaced in INDEX.
- **Symmetry strictness** — RESOLVED: warning, never error.
- **Resume behavior** — RESOLVED: grandfather / transition-only (gap acknowledged).
- **Cycle in the hook** — RESOLVED: short-circuit and surface, don't walk the graph.

## Work Log

- 2026-05-24T15:40:55.511Z Started: Created ticket MBGQ89
- 2026-05-24T15:41:00.000Z Drafted: Initial scope with CLI features and arcade pairing
- 2026-05-24T16:50:00.000Z Refactored: Removed epic/paired_with frontmatter to stand alone; dropped CLI commands to out-of-scope (YAGNI); rewrote body to be generic
- 2026-06-20 Motivating case (B6MZ4Z session): an agent filed `5JSH4C` as a duplicate because nothing surfaced similar tickets at `ticket new`; `/quality-review` later cancelled it — justification for a similarity nudge at creation.
- 2026-06-20T11:56:00Z De-duped against AKZJXC: dropped `depends_on` (already shipped), narrowing to the remaining four fields + a phase-gating hook on `blocked_on`.
- 2026-06-20T12:34:00Z Re-scoped post-collapse (epic WG3Z2N deleted; removed epic membership). Made all validation **warn-only** (consistent with AKZJXC) and kept exactly ONE hard gate on `blocked_on`. Dropped cross-repo syntax to out-of-scope. Confirmed the gate joins the existing pre-tool-quality phase-gate family — not a lone exception.
- 2026-06-20T16:10:00Z Refined gate semantics via `/figure-it-out` (quality-review surfaced the issues). **Only `done` auto-unblocks**; cancelled/superseded/wontfix require the reasoned override (GitHub Actions `!cancelled()` precedent — abandoned ≠ finished). Override now the single non-`done` mechanism: non-trivial reason required, commit-visible, INDEX-surfaced (closes the "agent self-grants" hole). Added stale-override warning (closes the "sticky override" bug — quality-review #9), cycle short-circuit in the hook (#12), and an explicit grandfather-gap acknowledgement (#10).
- 2026-06-20T16:18:00Z De-bloated (bloat check): cut from four fields to **two** — `epic` (load-bearing: already INDEX-rendered) + `blocked_on` (the gated dependency). Deferred `parent` + `paired_with` + the paired_with symmetry check to "when a consumer appears" (YAGNI — nothing reads them today). Validation drops to existence + cycle.
