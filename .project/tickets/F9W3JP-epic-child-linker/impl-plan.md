# Impl Plan: ticket new --parent links epic and child

**Status:** implemented

## Approach

**Riskiest assumption:** that grouping `INDEX.md` by `parent:` (AC2) won't regress
the index for tickets that don't participate — the change touches `index.ts` for
*every* ticket, not just linked children. Cheapest proof: scenario 3
(`AC2.index_groups_child_under_epic`) plus keeping the existing `ticket-sync` /
index test suite green. Sequence that slice **last**, after linking works, so a
wrong grouping choice fails a cheap, isolated slice rather than the whole feature.

The second load-bearing slice is the append itself: mutating the epic's varied
existing `children:` formats without corruption. Proven by the AC4 pair.

**Proof plan (per scenario, highest practical scope):**

| Scenario | Primary proof | Why enough / supporting |
| --- | --- | --- |
| AC1 `linking_records_parent_and_appends_to_epic` (S1) | command (`runCli` in temp dir) | asserts child `parent:` + epic `children[]` — the observable both-ways contract; supported by a unit test of the `linkChildToEpic` helper |
| AC1 `navigation_from_epic_reaches_child` (S2) | integration | **proof-plan constraint (gate strengthen):** the `Given` builds the link through the real `ticket new --parent` command, then calls `findNextWork` — so it exercises the new feature, not pre-existing navigation |
| AC2 `index_groups_child_under_epic` (S3) | command (`sync-tickets`) | create epic+child via `--parent`, regenerate `INDEX.md`, assert child under the epic heading |
| AC3 `missing_parent_rejected` (S4) | command | `runCli --parent ZZZZZZ` → exit≠0, message names missing epic, no child folder |
| AC3 `non_epic_parent_rejected` (S5) | command | `--parent` on a task → exit≠0, "not an epic" message, target frontmatter unchanged, no child folder |
| AC4 `second_child_preserves_first` (S6) | unit + command | append a second id, assert both present (order-insensitive) |
| AC4 `linking_twice_adds_at_most_once` (S7) | unit | call `linkChildToEpic` twice with the same id from an unlisted start → id present exactly once |
| no-`--parent` regression (no AC) | command (`tests/commands/ticket-new.test.ts`) | **gate strengthen:** `ticket new` without `--parent` produces a ticket with **no `parent:` key** and touches **no other ticket/epic file** — proves `--parent` logic doesn't leak into the default create path |

Atomic tmp+rename write (AC4) is asserted at the **unit** layer only — an
interrupted mid-write can't be induced deterministically via `runCli`; a
behavioral scenario would be flaky or white-box (gate confirmed this deferral).

**Build order (load-bearing sequencing):**

1. `linkChildToEpic(childId, epicId)` helper — validate epic exists & is `type: epic`, append-if-absent, atomic write-then-rename. Unit tests S6, S7. *(load-bearing append)*
2. Wire `--parent` into `ticket new` — write child `parent:`, call the helper, surface validation errors. Command tests S1, S4, S5 + regression test.
3. Navigation proof S2 (integration) once wiring is green.
4. INDEX grouping-by-`parent:` in `ticket-sync/index.ts` — S3. *(riskiest, biggest blast radius, last)*

## Decisions

| Decision | Choice | Alternatives considered | Rejected because |
| -------- | ------ | ----------------------- | ---------------- |
| Relationship representation | single `parent:` on child + epic `children[]` | dual-write `parent:` + `epic:` on child | two fields for one relationship drift; existing corpus never maintains `epic:` |
| CLI surface | `--parent` flag on `ticket new` | standalone `ticket link <child> <epic>` command | primary use is create-time; a link verb is more surface for the rarer retro-link path — deferred, both would share the helper |
| Epic file mutation | read → inline-parse → append-if-absent → tmp-write + `renameSync` | in-place regex substitution | regex can't safely handle the varied `children:` formats (flow array, bare string); atomic write prevents half-written epics |
| INDEX grouping source | resolve group from `parent:`, falling back to legacy `epic:` if present | keep grouping on `epic:` only | single source of truth; `epic:` is unset in practice so children never group today |

## Arch alignment

Honors **ARCHITECTURE.md → "Hierarchy Navigation on Ticket Completion"** (§468):
the `parent:` ⇄ `children:` bidirectional contract that `findNextWork` walks, and
the **zero-dependency inline `parseFrontmatter`** rule (hooks/CLI run where the
`yaml` package isn't installed). `linkChildToEpic` reuses `hierarchy.ts`'s
existing inline parser + the `updateTicketStatus` write-then-rename pattern
rather than adding a YAML dependency.

## Known deviations

The INDEX grouping key moves from `epic:` to `parent:` — a deliberate
reconciliation of two competing relationship representations toward the single
source of truth. Kept backward-compatible: a legacy `epic:` value is used as a
fallback when `parent:` is absent, and tickets with neither still group under
`(no epic)`.

**Reconciliation (what actually shipped vs. plan):** the plan implied all 7
scenarios would run in the Gherkin acceptance lane. In practice the two internal
contracts with no CLI surface — findNextWork navigation (S2) and append
idempotency (S7) — were removed from the black-box `.feature` and kept as
vitest-only proofs (integration + unit, already green), because the cucumber
lane drives the built CLI and neither behavior is reachable through it. The
`.feature` documents this in place of the removed scenarios; AC1 and AC4 each
still carry a tagged acceptance scenario (S1, S6). Decisions and Arch alignment
above held as written — no change.

## Assessment triggers

Revisit these choices if: nested / multi-level epic hierarchies are introduced;
a standalone re-parent or unlink command is added (would promote the shared
helper to a first-class command); or the `children:` frontmatter format is ever
normalized (the append helper's format-tolerance could then simplify).
