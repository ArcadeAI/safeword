---
id: CXXB3P
slug: ticket-folder-legibility
type: task
phase: verify
status: in_progress
created: 2026-05-25T21:44:16.923Z
last_modified: 2026-05-25T21:44:16.923Z
scope:
  - Mint ticket folders as `{ID}-{slug}/` instead of opaque `{ID}/` so `ls` output is legible
  - Slug-aware ID collision check at mint time (`idsAlreadyTaken()` scans existing folders and splits on the first dash to recover the ID portion)
  - Retrofit open Base32 ticket directories via `git mv` (`0ZKYJD`, `C2Q0RR`, `G2E72G`)
  - Update test expectations in `ticket-writer.test.ts` to match the new folder shape
  - Sync resolver docstring in both dogfood (`.safeword/hooks/lib/active-ticket.ts`) and canonical template (`packages/cli/templates/hooks/lib/active-ticket.ts`) — calling `{id}-{slug}` "legacy" is now misleading
out_of_scope:
  - Auto-renaming directories when `slug:` in frontmatter is edited after creation (flagged as PR open question for follow-up)
  - Retrofitting closed/done tickets (filed under `completed/`) — only open tickets touched
  - Adding new behavior to the hook resolver — `findTicketFolderMatches` already supports `{id}-{anything}` via prefix match
  - CLI/tooling for renaming a ticket's slug
done_when:
  - `safeword ticket new <slug>` creates `.safeword-project/tickets/{ID}-{slug}/` on disk
  - `ticket-writer.test.ts` covers slug-aware collision (`AAAAAA-foo/` exists → minter `AAAAAA` retries) and passes
  - Hook lookup by bare ID (e.g. `G2E72G`) still resolves the renamed folder via prefix match
  - Full vitest suite delta vs. main is zero (only pre-existing `sql-golden-path.test.ts` failures remain)
  - All 3 open Base32 ticket directories renamed and tracked by git as moves (100% similarity)
---

# ticket-folder-legibility

**Goal:** Make ticket folders self-describing on disk so `ls` tells you what each ticket is about without opening `ticket.md`.

**Why:** Crockford Base32 IDs (`G2E72G/`, `C2Q0RR/`) are opaque to humans and agents. Legacy numeric tickets already used `{ID}-{slug}/` (`009-audit-lint-ignore-rules/`) — the new ID scheme regressed that property. Restoring it ends the on-disk format mix.

## Work Log

- 2026-05-25T21:44:16.923Z Started: Created ticket CXXB3P **post-hoc**. The actual implementation landed in commit `cc8658dd` (PR #160) before this ticket existed. Backfilled to close the safeword discipline gap flagged in self-audit.
- 2026-05-25T21:44:16.923Z Honest provenance: TDD cycle was not run. Code + existing test expectations were edited in a single pass. Slug-aware collision behavior had no dedicated RED test — backfilled as a follow-up commit with `skip: backfilled` annotation in test-definitions.md.
