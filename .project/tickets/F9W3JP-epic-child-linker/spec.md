# Spec: ticket new --parent links epic and child

## Intent

When a builder decomposes a large piece of work into an epic plus child tickets,
safeword's hierarchy only "works" if the child records `parent:` **and** the
epic's `children:` list names the child — a bidirectional link that today is
hand-wired after every `ticket new`. This feature makes `ticket new --parent
<epicId>` write both ends of that link in one step (and surface the child under
its epic in the index), so epic decomposition is a single command instead of a
create-then-hand-edit ritual.

## Intake Brief

- **Requested by:** Filed as the deferred A2 follow-up to the epic-scaffolding
  work (issue #699); surfaced again by the quality-review of PR #817.
- **Cost of inaction:** Every epic child is hand-linked by editing two files
  (`parent:` on the child, `children:` append on the epic). Miss either end and
  `findNextWork` silently returns `all-done`, skipping the sub-tickets — a
  correctness gap that reads as "the workflow lost my tickets."
- **Reversibility:** Two-way door. Additive CLI flag + one grouping change in a
  generated, always-regenerated index; no data migration, no public API break.

## References

- #699 (`--type=epic` scaffolding — shipped in PR #817); this is its deferred A2 linker.
- `packages/cli/templates/hooks/lib/hierarchy.ts` — `findNextWork` navigation contract (`parent:` ⇄ `children:`).
- `packages/cli/src/ticket-sync/index.ts` — INDEX grouping (currently keyed to `epic:`).
- `/figure-it-out` design record: single source of truth (`parent:`), no duplicate `epic:` field.

## Personas

- Technical Builder (TB)

## Surfaces

Affected:

- The `safeword ticket new` CLI command — behaves identically across every agent
  surface (Claude Code, Codex, Cursor) because they all invoke the same binary.
  `skip: no surface-specific behavior — one code path for all CLI surfaces`

## Vocabulary

- **Epic** — a container ticket (`type: epic`) whose `children:` frontmatter
  lists the ids of the tickets decomposed under it.
- **Child** — a ticket whose `parent:` frontmatter names its epic.
- **Link** — the bidirectional pair: child `parent:` + epic `children[]` entry.

## Jobs To Be Done

### epic-child-linker.TB1 — Wire a child to its epic in one command

**Persona:** Technical Builder (TB)

> When I break an epic into child tickets, I want creating a child to record
> both ends of the epic↔child link, so the workflow can navigate the hierarchy
> and show it in the index without me hand-editing two files.

#### epic-child-linker.TB1.AC1 — Creating a child with `--parent` links it both ways

The child's `parent:` names the epic and the epic's `children:` list gains the
child's id, so `findNextWork` navigates epic → child correctly.

#### epic-child-linker.TB1.AC2 — The linked child appears under its epic in the index

`safeword sync-tickets` / `safeword check` group the child under its epic in
`INDEX.md`, driven by the same `parent:` link — no separate `epic:` field to
drift.

#### epic-child-linker.TB1.AC3 — A bad `--parent` fails loud, creating nothing

`--parent` pointing at a missing ticket, or at a ticket that is not `type:
epic`, exits non-zero with an actionable message and does not create a
half-linked child or mutate any epic.

#### epic-child-linker.TB1.AC4 — Linking is idempotent and never corrupts the epic

Appending the child preserves the epic's existing `children:` entries and adds
the new id at most once; the epic file is written atomically so an interrupted
run can't leave it half-written.

## Rave Moment

skip: table-stakes — this is hierarchy plumbing; the reward is the absence of a
chore, not a moment worth recounting.

## Outcomes

- Creating a child with `--parent <epicId>` yields a child whose `parent:` and
  the epic's `children:` agree, with zero manual edits.
- `INDEX.md` lists the new child under its epic heading.
- A wrong `--parent` value stops with a clear error and leaves the tree unchanged.
