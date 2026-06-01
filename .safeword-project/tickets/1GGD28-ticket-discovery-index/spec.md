# Spec: Generated ticket INDEX.md (safeword sync-tickets) for capability discovery

## Intent

Give the ticket corpus the same capability-searchable surface learnings already
have. With 330 tickets (172 active + 158 completed), 49 of them bare-ID with no
slug, "is there already a ticket for X?" is a 330-folder hunt — and that hunt
already failed once this session (the 7GER0P duplicate of epic 0AWSY8's
children). A generated, never-drifts, epic-grouped index makes the question one
grep instead.

## References

- `sync-learnings` (`packages/cli/src/learning-sync/index.ts`, `src/commands/sync-learnings.ts`) — the proven pattern this mirrors.
- **MBGQ89** — structured cross-ticket pairing (the prevention half; this is the discovery half).
- **FM5EDA** — per-ticket slug renames (complementary; this adds an index, not a rename).
- **7GER0P** (superseded) — the duplicate whose filing motivated this ticket.
- Decision record: `/figure-it-out` on index scope + regen trigger (work log, 2026-06-01).

## Personas

- **Agent-Driven Developer (DEV)** — accumulates a ticket corpus across many sessions and needs to find prior/related work without learning safeword internals. Covers the Safeword Maintainer (SM), who is a DEV in their own dogfood sessions.

## Vocabulary

Uses existing glossary terms: Ticket, Epic (as the `epic:` frontmatter grouping key), Phase, Gate. No new project-wide terms.

## Jobs To Be Done

### ticket-discovery-index.DEV1 — Discover existing tickets by capability

**Persona:** Agent-Driven Developer (DEV)

> When I want to know whether the ticket corpus already covers a capability, I
> want to grep a single generated index instead of scanning hundreds of
> opaque-ID folders, so I can find the owning epic and prior work — and avoid
> filing a duplicate.

#### ticket-discovery-index.DEV1.AC1 — One generated file lists every in-scope ticket with id, title, status, epic, goal, and folder path

#### ticket-discovery-index.DEV1.AC2 — Entries are grouped by epic, so a capability keyword grep lands on the owning epic and its children together

#### ticket-discovery-index.DEV1.AC3 — Regeneration is idempotent and drift-free — re-running reports "already current" when nothing changed, and the file is stamped auto-generated / do-not-edit

#### ticket-discovery-index.DEV1.AC4 — Completed tickets stay discoverable without bloating the active surface — they live in a separate archive index so `grep INDEX*.md` finds shipped prior work while the active index stays scannable

## Outcomes

- `safeword sync-tickets` writes `.safeword-project/tickets/INDEX.md` (active, grouped by epic) and `INDEX-completed.md` (archive).
- Each entry: `**<ID>** — <title> (<status>, epic: <epic-or-—>)` + a Goal one-liner + a folder path.
- Second run with no ticket change reports "already current" and writes nothing.
- A capability grep (`grep -i review .safeword-project/tickets/INDEX*.md`) surfaces the owning epic and its children — the 0AWSY8 case the 7GER0P duplicate missed.
