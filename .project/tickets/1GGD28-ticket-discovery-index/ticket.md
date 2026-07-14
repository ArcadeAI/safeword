---
id: 1GGD28
slug: ticket-discovery-index
type: feature
phase: done
status: done
epic: workflow-gate-hygiene
created: 2026-05-31T18:02:49.267Z
last_modified: 2026-06-01T00:30:24.713Z
scope:
  - New `safeword sync-tickets` command + `ticket-sync` pure module mirroring `sync-learnings` / `learning-sync`.
  - Emit `.safeword-project/tickets/INDEX.md` (active tickets, grouped by epic) and `INDEX-completed.md` (completed/ archive).
  - Entry shape `**<ID>** — <title> (<status>, epic: <epic-or-—>)` + Goal one-liner + folder path; tolerant frontmatter parsing (Crockford or numeric id, optional title/epic).
  - Idempotent regen with auto-generated / do-not-edit header; "already current" when unchanged.
  - Regen wiring: standalone command + `safeword check` step + regen on `ticket new`.
out_of_scope:
  - Per-edit PostToolUse on-save hook — wrong cost profile for append-heavy ticket edits (rejected in /figure-it-out).
  - Mass slug-rename of the 49 bare-ID folders — FM5EDA's job.
  - Lexical dedup nudge at `ticket new` — MBGQ89's structured-pairing territory.
done_when:
  - `safeword sync-tickets` writes both index files; entries carry id/title/status/epic/goal/path, grouped by epic.
  - Second run with no ticket change reports "already current" and writes nothing.
  - `grep -i <kw> .safeword-project/tickets/INDEX*.md` surfaces the owning epic and its children (the 0AWSY8 case).
  - `safeword check` and `ticket new` regenerate the index; tests cover parse / group / idempotency / scope-split.
---

# Generated ticket INDEX.md (safeword sync-tickets) for capability discovery

**Goal:** Give the ticket corpus the same capability-searchable surface learnings already have — a generated `.safeword-project/tickets/INDEX.md` (`ID — title (status, epic) — one-liner → path`, grouped by epic) so "is there already a ticket for X?" is one grep, not a 134-folder hunt.

**See:** [spec.md](./spec.md) for personas, jobs-to-be-done, and outcomes (run intake when picked up).

## Why

Filed after a concrete miss this session: a DXFX02 functionality-loss audit concluded arcade's `/review-spec` depth was unhomed and filed ticket 7GER0P — a **duplicate**. Epic 0AWSY8 already owned that work across five children (9FSPM8/XBY5QR/73CKG4/R09T59/F2QZB4), but their Crockford-Base32 IDs carry no meaning and there's no topic index, so the audit didn't find them. 7GER0P was then superseded — wasted churn a discovery surface would have prevented.

The corpus is **134 ticket folders, 49 of them bare-ID (no slug)** — `ls` and quick scans reveal nothing. Learnings already solved the analogous problem: `safeword sync-learnings` generates `learnings/INDEX.md`, a never-drifts, grep-one-file topic index. Tickets have no equivalent.

## Scope (sketch — refine at intake)

- New `safeword sync-tickets` command mirroring `sync-learnings` (`src/commands/sync-learnings.ts` is the template): scan `.safeword-project/tickets/*/ticket.md`, emit `.safeword-project/tickets/INDEX.md`, idempotent ("already current" when unchanged), `<!-- Auto-generated … do not edit -->` header.
- Entry shape: `**<ID>** — <title> (<status>, epic: <epic-or-—>) → path`, **grouped by epic** so a capability grep ("review", "adversarial", "signals") lands on the owning epic + its children. (Epic grouping is what would have surfaced 0AWSY8.)
- Regeneration trigger: decide at intake — a standalone command, a `safeword check` step, and/or a post-commit/Stop hook (like learnings' on-save regen).
- **Open question for intake — index scope:** all tickets (incl. `completed/`) or active-only? Completed tickets are searched by capability too, but with 134 folders an all-inclusive index risks growing too big to scan — reintroducing the discovery problem it solves. Options: (a) one index, active grouped first + a collapsed completed section; (b) two files (`INDEX.md` active, `INDEX-completed.md` archive); (c) active-only, accept that closed work is found by grep. Decide before building.

## Out of scope

- **Mass slug-rename of the 49 bare-ID folders** — a prior `/figure-it-out` already rejected this (see learning below); per-ticket rename is FM5EDA's job. This ticket adds an index, not a rename.
- **Dedup-at-filing / "similar ticket exists?" nudge at `ticket new`** — the signal that would catch a _semantic_ duplicate (shared arcade pair / epic) is structured-pairing queryability, chartered by MBGQ89. Don't build a lexical nudge here; it wouldn't have caught 7GER0P (no shared title tokens with 0AWSY8's children).

## Related

- **MBGQ89** (cross-ticket dependency/pairing schema fields) — the prevention half: once `paired_with`/`epic` are queryable + validated, "which safeword tickets pair to arcade `/review-spec`?" becomes answerable. This index is the discovery half; MBGQ89 is the prevention half.
- **FM5EDA** (ticket-slug-rename) — owns per-ticket slug renames; complementary, not overlapping.
- **Learning [closed-tickets-stay-opaque](../../learnings/closed-tickets-stay-opaque.md)** — records the prior decision NOT to mass-rename; this index is the alternative that respects it.
- **`sync-learnings`** (`src/commands/sync-learnings.ts`) — the proven pattern to mirror.
- **7GER0P** (superseded) — the duplicate whose filing motivated this ticket.

## Work Log

- 2026-05-31T18:02:49.267Z Started: Created ticket 1GGD28
- 2026-05-31T18:02:49.267Z Filed (backlog): chosen via `/figure-it-out` over a mass slug-rename (decided against in the closed-tickets learning) and a lexical dedup-nudge (wouldn't catch semantic dupes; that's MBGQ89's structured-pairing territory). Scope: a generated, epic-grouped ticket INDEX mirroring `sync-learnings`. Motivated by the 7GER0P duplicate this session.
- 2026-06-01T00:30:24.713Z Complete: intake — `/figure-it-out` resolved the two open questions: index scope → **two files** (active INDEX.md grouped by epic + INDEX-completed.md archive; one-file trends toward "too big to scan" as completed/ grows, active-only loses shipped-work discovery), regen trigger → **command + `safeword check` step + regen on `ticket new`, no per-edit hook** (ticket.md is append-heavy via work logs; an on-save hook would be near-all no-op rescans). Entry detail → title + Goal one-liner. spec.md (JTBD TB1 + AC1–AC4) and scope/out_of_scope/done_when written.
- 2026-06-01T00:30:24.713Z Complete: define-behavior — 15 scenarios across 4 rules (AC1 fields/parse, AC2 epic grouping, AC3 idempotency/drift, AC4 active/completed split), lineage-tagged. dimensions.md derived from learning-sync's known frontmatter edge cases.
- 2026-06-01T00:30:24.713Z Complete: scenario-gate — AODI clean; adversarial pass folded 3 robustness gaps (no-ticket.md dirs ignored, both index files self-excluded, completed grouped by epic) into the build. Decomposition skipped — direct mirror of `learning-sync`. → implement.
- 2026-06-01T01:00:00.000Z RED 99bc0aae → GREEN 0b7d835c: `ticket-sync` module (parse/read/group/build/sync) + `safeword sync-tickets` command + `safeword check` regen step. 16/16 module scenarios pass; generated real indexes (172 active / 157 completed); `grep INDEX*.md` surfaces 0AWSY8 + the workflow-gate-hygiene epic group. Two pre-existing tickets (085-bump-golangci-lint, 014-bdd-guides-consolidation) surfaced as skipped (missing `id:` frontmatter) — real data finding, out of scope.
- 2026-06-01T01:00:00.000Z Regression caught + fixed: full suite (2332 pass, 9 fail in 2 files) flagged that an initial `ticket new` regen wrote INDEX.md into the tickets dir — breaking the cross-branch clean-merge invariant (committed on both branches → conflict) and the "tickets dir = ticket folders" invariant (`readdirSync` length). **Scope refinement to the /figure-it-out trigger decision:** dropped the `ticket new` regen; index freshness is now command + `safeword check` only. Targeted re-run green (28/28: cross-branch-tickets + ticket-new + ticket-sync). Filed the 792s suite runtime into CQJBSN (test-suite-parallelism) as its timing evidence.
- 2026-06-01T01:00:00.000Z → verify: all scenarios RED/GREEN checked with SHAs, cross-scenario refactor assessed (skip — premature to share an abstraction with learning-sync).
- 2026-06-01T01:30:00.000Z Refactor pass: inlined a redundant epic ternary (a374a3d6); un-exported `parseTicket` after audit flagged it as exported-but-internal (30b3405d). Both behavior-preserving (targeted 16/16 + typecheck).
- 2026-06-01T01:30:00.000Z Complete: verify + audit — full suite 2341/2341 (1 skipped), build/lint clean, 15/15 scenarios, jscpd 0 clones vs learning-sync, dep-drift clean. verify.md written. → done.
