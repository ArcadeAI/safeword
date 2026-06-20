---
id: MBGQ89
slug: ticket-deps-schema
title: 'Complete the local ticket schema (epic/parent/paired_with/blocked_on)'
type: feature
phase: define-behavior
status: in_progress
epic: ticket-anchor-external-bridge
created: 2026-05-24T15:40:55.511Z
last_modified: 2026-06-20T11:56:00Z
scope:
  - Add four optional frontmatter fields to canonical ticket schema — epic (slug-or-id), parent (id), paired_with (id), blocked_on (array of ids). depends_on already shipped via AKZJXC — out of scope here; this ticket completes the remaining four.
  - Document the four new fields (alongside the existing depends_on) with examples in doc-templates/ticket-template.md.
  - safeword check validates same-repo existence of referenced ids, detects blocked_on cycles, and warns on paired_with asymmetry within the same repo.
  - pre-tool-quality hook gates ticket.md frontmatter edits — refuses to change phase: from intake to any other value while any blocked_on id resolves to a same-repo ticket whose status is not done.
  - Bare ids only for v1 — cross-repo references are accepted as-is but not validated (benign info-level note from safeword check).
  - paired_with violations are warnings, never errors.
  - epic field is singular for v1.
  - Hook grandfathers pre-existing past-intake tickets — only fires on phase transitions, not retroactive re-validation.
out_of_scope:
  - safeword ticket deps/tree/list-blocked-by CLI inspection commands (deferred until human-driven query pattern emerges; current data is grep-readable).
  - Cross-repo reference syntax (registry, prefixed ids, path-relative paths) — bare ids only for now.
  - Linear/GitHub Issues/Jira bridging.
  - Auto-status-propagation (closing parent when all children close).
  - Visualization beyond text.
  - Multi-epic membership (epic accepts a single value only).
  - Migrating existing safeword tickets to use the new fields — adoption is opt-in.
  - Fixing the unrelated pre-existing inconsistency in active-ticket.ts where type === 'epic' filter has no matching tickets in the wild.
done_when:
  - doc-templates/ticket-template.md documents all four new fields with examples and shows them as optional.
  - A test ticket with blocked_on referencing an in_progress ticket cannot have its phase frontmatter edited from intake to any other value — Write tool is blocked by pre-tool-quality.ts with a clear BLOCKED on <id> message.
  - safeword check exits non-zero with a clear error when a ticket references a nonexistent same-repo id in any of the four new fields.
  - safeword check exits non-zero with a clear error when two tickets form a blocked_on cycle.
  - safeword check prints a warning (does not exit non-zero) when paired_with is asymmetric within the same repo.
  - safeword check is silent on cross-repo references that cannot be resolved (treated as opaque, not invalid).
  - All new behaviors are covered by vitest tests in packages/cli/tests/ following the existing patterns in tests/hooks/ and tests/commands/.
---

# First-class cross-ticket dependency/pairing fields in ticket schema

**Goal:** Promote `epic`, `parent`, `paired_with`, and `blocked_on` from ad-hoc free-text frontmatter to canonical fields in the safeword ticket schema, validated by `safeword check` and enforced by the phase-advancement hook. (`depends_on` already landed via [AKZJXC](../AKZJXC-ticket-relations/ticket.md); this completes the remaining four and adds the phase-gating hook.)

> **Parent epic:** [WG3Z2N](../WG3Z2N-ticket-anchor-external-bridge/ticket.md) — this is the LOCAL half of the seam (the execution anchor).

**Why:** Today, anything beyond the documented frontmatter is free-text. Tickets that reference other tickets (epic children, sibling pairs across repos, sequencing dependencies) do so by string — nothing prevents a typo'd ID, a stale reference after a rename, or asymmetric pairing (A says it's paired with B but B never references A). The pattern is recurring across every non-trivial safeword project, and the system has no opinion about it.

**Discovered while:** structuring an epic that needed all five fields simultaneously. The ad-hoc usage worked but exposed the gap.

## Scope

### Frontmatter additions

- `epic: <slug-or-id>` — declares this ticket is a child of the named epic. Nullable. Singular for v1.
- `parent: <id>` — declares a sub-ticket relationship (distinct from epic membership — a child ticket inside a non-epic ticket). Nullable.
- `paired_with: <id>` — declares a sibling ticket whose work moves in lockstep with this one (typically across repos: an upstream change + its downstream adoption). Symmetric — both sides should declare each other.
- `blocked_on: [<id>...]` — hard dependency. The phase-advancement hook refuses to move past `intake` while any listed ticket is not `done`. Array; empty allowed.
- `depends_on: [<id>...]` — soft dependency. **Already shipped via AKZJXC** (field + derived `blocks` + dangling/cycle validation); listed here only for completeness. This ticket adds the phase-gating `blocked_on` sibling, not `depends_on`.

### Validation in `safeword check`

- **Existence check** — every referenced ID resolves to an existing ticket (within the same repo, or via cross-repo reference syntax once decided).
- **Cycle detection** — reject `A blocked_on B blocked_on A` at write time (i.e., `safeword check` errors).
- **Paired symmetry** — if A says `paired_with: B`, B should say `paired_with: A`. Asymmetry surfaces as a warning (not an error — cross-repo updates are inherently racey).
- **Epic-child consistency** — if A says `epic: X`, the epic ticket X's body should reference A. Optional; warn-level.

### Hook integration

- Phase-advancement hook: when a ticket transitions out of `intake`, walk `blocked_on`; if any listed ticket has `status != done`, refuse the transition with a clear message:

  ```text
  BLOCKED on <ID> (status: <status>): <title>
  ```

- No hook behavior for `depends_on` — it's documentation, not enforcement.

### Cross-repo references

Tickets that pair across repos (one project's adoption ticket pairing to an upstream change in another project) need a syntax for naming the other side. Options:

- **Bare ID** (current ad-hoc usage) — works if IDs are globally unique enough, but offers no way for tooling to find the other side's file.
- **Prefixed** — `<repo-alias>:<id>` (e.g., `safeword:MBGQ89`) with a per-project registry in `.safeword-project/repo-aliases.json` mapping alias → checkout path.
- **Path-relative** — direct filesystem path. Unambiguous but brittle to moves.

Decide in this ticket's design phase. Affects validation and any future tooling.

## Out of scope

- CLI inspection commands (`safeword ticket deps`, `tree`, `list --blocked-by`). The minimum useful system is schema + validation + hook gating; reading the data is already possible with grep/yaml parsers and agent access. Add CLI commands later only if a real human-driven query pattern emerges.
- Linear / GitHub Issues / Jira integration. Local schema only.
- Auto-status-propagation (close epic when all children close; close blocked tickets when blocker is cancelled). Could be a separate ticket if useful.
- Visualization beyond text (no graphviz, no web UI).
- Multi-epic membership (`epic: [X, Y]`). Keep singular for v1; revisit if a real use case appears.

## Done when

- Schema documented in `ticket-template.md` (the four new fields with examples).
- `safeword check` enforces existence, cycle detection, and paired-symmetry (warning) checks.
- Phase-advancement hook refuses out-of-`intake` transition when `blocked_on` is unmet.
- Cross-repo reference syntax decided and documented in `ticket-template.md`.
- A test ticket with intentional violations (missing ref, cycle, asymmetric pair, unmet block) demonstrates each check fires correctly.

## Open questions

- **Cross-repo reference syntax** — prefixed-with-registry vs path-relative vs bare-ID. Driver leans prefixed-with-registry (unambiguous, decoupled from filesystem layout).
- **Symmetry enforcement strictness for `paired_with`** — warning or error? Driver leans warning (cross-repo updates are racey; an error would block legitimate work mid-update).
- **Singular vs plural `epic`** — keep singular for v1. Defer plural until a real two-epic ticket appears.
- **Hook behavior on resume** — if a ticket was already past `intake` before its `blocked_on` was added, does the hook retroactively block it back to `intake`, or grandfather the existing phase? Driver leans grandfather (avoid surprise regressions).

## Work Log

- 2026-05-24T15:40:55.511Z Started: Created ticket MBGQ89
- 2026-05-24T15:41:00.000Z Drafted: Initial scope with CLI features and arcade pairing
- 2026-05-24T16:50:00.000Z Refactored: Removed epic/paired_with frontmatter to stand alone; dropped CLI commands to out-of-scope (YAGNI); rewrote body to be generic (not tied to any specific epic or repo)
- 2026-06-20 Motivating case (from the B6MZ4Z session): an agent filed `5JSH4C` as a duplicate of QPGEWD/G8PBE6/X6EFPN because nothing surfaced similar tickets at `ticket new` — `/quality-review` later cancelled it. The lexical dedup-nudge `1GGD28` routed here would have caught it; concrete justification for extending this ticket's pairing surface with a similarity nudge at creation.
- 2026-06-20T11:56:00Z Re-scoped under epic WG3Z2N (LOCAL half of the local-vs-external seam). De-duped against AKZJXC: dropped `depends_on` (already shipped — field + derived `blocks` + dangling/cycle validation), narrowing this ticket to the remaining four fields (epic/parent/paired_with/blocked_on) plus the phase-gating hook on `blocked_on`. Added `parent: WG3Z2N`.
