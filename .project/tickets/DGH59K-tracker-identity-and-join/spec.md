# Spec: Issue-first ticket identity + tracker-key→local-folder join reader

Child of epic **KKNFZA** (offboard-local-ticketing). Implements the epic's **TB1.AC1**
(issue-first identity, safe degrade) and **SM2.AC6** (tracker-key→folder join reader). Personas,
the Model B decision, and the full JTBD set live in
[../KKNFZA-offboard-local-ticketing/spec.md](../KKNFZA-offboard-local-ticketing/spec.md).

## Intent

Make ticket identity tracker-minted: with a tracker connected, `ticket new` creates/adopts the
issue first and keys the local folder to the issue key — and add the reader that resolves a
ticket's local folder from that key. Identity off-boards; nothing else (status/phase/churn) moves
here.

## Intake Brief

- **Requested by:** alex (via epic KKNFZA).
- **Cost of inaction:** without tracker-minted identity and a key→folder reader, the rest of the
  epic has nothing to hang on — every other child resolves work by local `{ID}-{slug}` prefix and
  can't connect a tracker issue back to its folder.
- **Reversibility:** two-way. `provider:none` keeps today's local-id path untouched; the join
  reader is additive (new reader over the existing `external_issue` field).

## Personas

Inherited from the epic: **Technical Builder (TB)**, **Safeword Maintainer (SM)**.

## Jobs To Be Done

### tracker-identity-and-join.TB1 — one identity, minted by the tracker

**Persona:** Technical Builder (TB)

> When I create a ticket with my tracker connected, I want its identity to come from the tracker
> (the issue key) and my local folder keyed to it, so there's one id for the work and tools can map
> the issue back to its folder — and when the tracker is down, I want a loud failure with no
> half-made ticket rather than a silent orphan.

#### tracker-identity-and-join.TB1.AC1 — issue-first identity (= epic TB1.AC1)

With a tracker connected, `ticket new` creates/adopts the issue first, takes the tracker key as the
canonical id, and keys the local folder to it. `provider:none` is unchanged (local id as today).

#### tracker-identity-and-join.TB1.AC2 — safe degrade (= epic TB1.AC1)

Tracker unreachable/auth-fail at `ticket new` → fail loud, **no** orphan folder. Partial-create
(issue minted, local key-record failed) → the next run reconciles to the existing issue, never
duplicates.

### tracker-identity-and-join.SM1 — resolve a ticket's folder from its tracker key

**Persona:** Safeword Maintainer (SM)

> When a hook needs the local folder for a ticket whose identity is a tracker key, I want one
> reader that resolves it from that key, so colocated evidence stays reachable after identity
> off-boards to the tracker.

#### tracker-identity-and-join.SM1.AC1 — tracker-key → local-folder join reader (= epic SM2.AC6)

A reader resolves "the local folder for this ticket" from a tracker key via a stable mapping over
`external_issue`/key — a clean "not found" when no folder matches, never a crash. (Today nothing
reads `external_issue` back; `resolveTicketDirectory` resolves by local `{ID}-{slug}` prefix only.)

## Vocabulary

- **tracker key** — the issue identifier the tracker mints (e.g. GitHub `#123` / Linear `ENG-45`),
  adopted as the ticket id.
- **partial-create** — the issue was minted but recording its key locally failed; a resumable
  pending state, not a duplicate trigger.

## Outcomes

- A tracker-connected `ticket new` yields a folder whose identity is the issue key.
- No orphan/duplicate under tracker-unreachable or partial-create.
- Any hook can go tracker-key → folder.
- `provider:none` path is byte-for-byte today's behavior (proven by test).

## Open Questions

- resolved (Decision C, 2026-06-28): **partial-create idempotency.** Issue-first creation does NOT
  auto-reconcile a crash between issue-create and recording — there is no local id before the issue,
  so the JS5K5G pending pattern can't key it, and title-search/slug-marker add scope + ambiguity.
  Instead: a successful create records its ref (so `sync-tracker` updates, never double-creates),
  and the rare post-crash orphan (issue minted, recording crashed) is accepted and **surfaced by a
  follow-up ticket** (orphan-tracker-issue detection), not auto-reconciled. The former
  `partial_create_reconciles` scenario was replaced by `successful_create_records_ref`.
- resolved: folder naming under a tracker key is `{key}-{slug}` (e.g. `ENG-45-login-bug`),
  consistent with today's `{ID}-{slug}`; the join reader resolves by that prefix.
