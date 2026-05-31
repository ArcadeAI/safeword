---
id: 1GGD28
slug: ticket-discovery-index
type: feature
phase: intake
status: backlog
created: 2026-05-31T18:02:49.267Z
last_modified: 2026-05-31T18:02:49.267Z
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
- Include `completed/` tickets in the index (they're accessed by capability search too), even though their folders stay opaque per the closed-tickets decision.

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
