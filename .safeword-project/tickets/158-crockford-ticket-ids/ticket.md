---
id: 158
type: feature
phase: verify
status: in_progress
created: 2026-05-20T05:28:00Z
last_modified: 2026-05-20T05:28:00Z
supersedes: 080
scope:
  - Move new tickets to 6-char Crockford Base32 IDs (alphabet `0123456789ABCDEFGHJKMNPQRSTVWXYZ` — no I/L/O/U), uppercase canonical, case-insensitive on lookup
  - Folder layout for new tickets: `.safeword-project/tickets/{ID}/ticket.md` (folder name is the ID alone; slug moves to frontmatter)
  - Add a real CLI command `safeword ticket new <slug> [--title=...] [--type=patch|task|feature]` that mints the ID, creates the folder with `mkdir` (retry on EEXIST as belt-and-suspenders for intra-filesystem races), and writes ticket.md from the existing template
  - Update the `ticket-system` skill prompt to call the CLI instead of "find highest ID and increment"
  - Update active-ticket lookup ([active-ticket.ts:43](packages/cli/src/utils/active-ticket.ts:43)) to resolve both legacy `{numeric-id}-{slug}/` folders AND new `{crockford-id}/` folders by reading frontmatter
  - Add a guard (pre-commit hook AND CI step) that walks `.safeword-project/tickets/**/ticket.md`, parses `id:` frontmatter, fails loud on any duplicate
  - Documentation: update SAFEWORD.md ticket-folder example and any guides that reference the `001-slug` pattern
out_of_scope:
  - Renaming the 51 existing `001`–`158` ticket folders (grandfather them; legacy lookup handles old IDs forever)
  - Date-prefixed IDs (`0520-7k9m`) — pure 6-char ID, ordering comes from frontmatter `created`
  - UUIDv7 / ULID adoption — 122 bits of entropy is overkill at this scale
  - A `safeword ls` formatter — useful but separate ticket
  - Changing how `completed/` archival works
  - Changing work-log naming (`.safeword/logs/ticket-{id}-{slug}.md`) — naming stays compatible; new tickets just use the Crockford ID in the slot
  - Auto-migrating commit message references (old `ticket 080` strings in history stay as-is)
done_when:
  - Two parallel Claude sessions running `safeword ticket new` simultaneously produce two distinct IDs with zero collisions across a 1000-iteration stress test
  - Two git branches each creating a ticket from the same parent merge to `main` with either distinct IDs (overwhelmingly likely) OR a hard git merge conflict on the folder (vanishingly rare; explicitly surfaced, never silent)
  - The duplicate-ID guard fails CI when fed a synthetic repo state containing two tickets with the same `id:` frontmatter, and passes on the real repo
  - Legacy `080-ticket-id-collision/` style folders remain readable by the CLI and skill — `safeword ticket` commands resolve old IDs without modification
  - The `ticket-system` skill prompt no longer contains "find the highest existing ID and increment" guidance
  - `bun run lint` green at repo root; full vitest green from `packages/cli/`
  - Pair-parity holds across hook files touched
---

# Crockford Base32 ticket IDs, folder-name-equals-ID

**Goal:** Eliminate ticket-ID collisions between parallel sessions AND across git branches by minting uncoordinated 6-char Crockford Base32 IDs and making the folder name the ID alone, so any ID collision becomes a real git merge conflict instead of silent corruption.

**Why:** [Ticket 080](.safeword-project/tickets/080-ticket-id-collision/ticket.md) caught the intra-filesystem race ("readdir → max+1 → mkdir") but explicitly scoped out the format question, picking atomic-mkdir-with-retry. That's correct for one filesystem and wrong for git branches — `mkdir` is a coordination primitive that branches don't share. Branch A's `158-foo/` and branch B's `158-bar/` merge cleanly because the _folder names_ differ; the shared `id: '158'` in frontmatter is silent. Three collisions in one session (073, 076, 077) and the existing `102a/102b/102c` scars confirm the system needs uncoordinated IDs, not better locking.

## Design context (locked in Clarify)

- **Why 6-char Crockford and not UUIDv7 / ULID.** UUIDv7 (RFC 9562, May 2024) is the textbook "modern" answer — 122 bits of entropy, lexicographically sortable, no coordinator. Right principle, wrong sizing for ~thousands of tickets and human-verbal references. Crockford Base32 at 6 chars gives ~10⁹ space (birthday collision around 58K items), reads aloud cleanly ("seven-kay-nine-em-three-pee"), and survives commit-message use ("fix(7K9M3P): ..."). Crockford specifically strips I/L/O/U from the alphabet to kill ambiguity with 1/1/0/V, and is case-insensitive — the standard choice when humans type or speak the IDs.
- **Why folder = just-ID.** This is the load-bearing structural choice, more important than the ID format. With slug-in-path (`{id}-{slug}/`), two branches that collide on the random ID with different slugs still merge cleanly — same silent-collision shape, just rarer. Folder = ID alone makes every duplicate ID a forced merge conflict that git refuses to silently combine. Slug moves to frontmatter; display formatting is a CLI concern.
- **Why grandfather, not rename.** Lookup branching for two formats is ~10 lines. Renaming the 51 existing folders would churn git history, invalidate every cross-reference in old commit messages, and produce zero benefit — old IDs stay unique among themselves forever, and new IDs draw from a non-overlapping space.
- **Why a real CLI, not a smarter prompt.** Atomicity in a prompt is a contradiction — the LLM can read the dir, decide, and write, but those steps are not a single transaction. Moving ID assignment into `safeword ticket new` makes the mkdir-retry-on-EEXIST loop actual code with actual tests, and the skill prompt shrinks from "find max, increment, mkdir" to "run the CLI."
- **Why a duplicate-ID guard despite the collision math.** Defense in depth. A 10⁻⁶ event per ticket creation is small, not zero; over a project lifetime that includes mistakes, manual edits, copy-paste, the guard makes the failure mode loud regardless of how the collision happened.

## References

- [Ticket 080](.safeword-project/tickets/080-ticket-id-collision/ticket.md) — original intra-filesystem race, this ticket supersedes
- [active-ticket.ts:43](packages/cli/src/utils/active-ticket.ts:43) — current lookup, `f.startsWith('${ticketId}-')`, needs dual-format handling
- [ticket-system/SKILL.md](packages/cli/templates/skills/ticket-system/SKILL.md) — skill prompt currently embeds the find-max-and-increment logic
- RFC 9562 (May 2024) — UUIDv7 spec; considered and rejected for this use case (overkill sizing)
- [Crockford Base32](https://www.crockford.com/base32.html) — alphabet and case-insensitivity rules

## Decomposition (Phase 5)

Outside-in TDD slices. Each row is one task; each task is one or more commits ending in green. Test layer favors the highest scope that covers the behavior with acceptable feedback speed.

| #   | Slice                                           | Scenarios                      | Test layer                | Depends on |
| --- | ----------------------------------------------- | ------------------------------ | ------------------------- | ---------- |
| 1   | `safeword ticket new <slug>` happy path         | Rule 1 (all 5), Rule 3 (all 3) | integration (CLI + fs)    | —          |
| 2   | EEXIST retry + fresh-install                    | Rule 2 (all 4)                 | integration (RNG-stubbed) | 1          |
| 3   | Slug normalization at CLI boundary              | Rule 4 (all 3)                 | integration (CLI + fs)    | 1          |
| 4   | Dual-format active-ticket lookup                | Rule 5 (all 6)                 | integration (fs + YAML)   | 1          |
| 5   | Duplicate-ID guard (detector + pre-commit + CI) | Rule 6 (all 6)                 | integration + hook test   | 1          |
| 6   | Skill prompt rewrite + template-sync regression | Rule 7 (all 4)                 | content assertion (file)  | 1          |
| 7   | Cross-process + cross-branch integration        | Rule 8 (all 4)                 | integration (real git)    | 1, 2, 5    |

**Why this order:** Slice 1 is the smallest user-visible behavior that forces every internal piece into existence (the `IdMinter`, the slug normalizer, the frontmatter writer, the folder creator). Slices 2–6 are largely independent enhancements on top of 1 and can land in any order — I'll sequence 2 → 3 → 4 → 5 → 6 because retry-and-fresh-install (2) is the most adjacent to slice 1's plumbing. Slice 7 is the integration capstone — it asserts the load-bearing claim of the whole feature (no silent collisions in main) and needs 5 (guard) and 2 (retry) to be meaningful.

**Implementation choices owned at decomposition time:**

- `IdMinter` is a small injected interface, not a global. Tests pass a deterministic stub; production wires a `crypto.randomInt`-backed implementation. Locks the determinism story for Rules 1, 2, 8.
- The new CLI command lives at `packages/cli/src/commands/ticket-new.ts`, registered alongside existing commands. No new top-level subcommand group — keeps the surface flat.
- The duplicate-ID detector is a single pure function `findDuplicateIds(ticketsDir): Duplicate[]` reused by the pre-commit hook AND the CI script. One source of truth.
- Template sync: any change to `packages/cli/templates/skills/ticket-system/SKILL.md` is mirrored to `.claude/skills/ticket-system/SKILL.md` in the same commit (per `feedback_template_sync.md` in MEMORY.md). The regression scenario in Rule 7 greps both paths.
- Pair-parity hook output stays consistent — no `SAFEWORD:` branding on any new hook output (per `feedback_no_branding_hooks.md`).

## Work Log

- 2026-05-20T05:28:00Z Started: Created ticket 158 (last legacy numeric ID before format change). Used `mkdir` atomically — folder claim succeeded, no race.
- 2026-05-20T05:28:00Z Locked: Crockford-6 over UUIDv7 (user pick: readability). Grandfather old tickets over rename (user pick: lower churn).
- 2026-05-20T05:32:00Z Phase 3 (define-behavior): wrote dimensions.md (16 dimensions) and test-definitions.md (initial 7 rules / 30 scenarios).
- 2026-05-20T05:37:00Z Phase 4 (scenario-gate): AODI + adversarial pass surfaced 6 fixable issues (probabilistic test, factual error in lookup target, host-state dependency, atomicity split, fuzzy phrasing, two missing edge cases). All fixed in-line; test-definitions.md now 8 rules / 31 scenarios. Changelog appended at file bottom.
- 2026-05-20T05:38:00Z Phase 5 (decomposition): 7 slices, dependency graph: slice 1 underpins 2-6, slice 7 is the capstone. Transitioning to `implement`.
