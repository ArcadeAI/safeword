# Spec: Always-fresh point-in-time architecture docs

**Scope of this spec:** Slice 1 only (see ticket → Delivery Slices) — single-repo deterministic extractor + skeleton + shape-fingerprint + per-node `purpose` floor + SessionStart self-heal that writes staleness markers. No enforcement gates (Slice 2), no monorepo hierarchy (Slice 3), no `/architecture` resync skill or guide split (Slice 4).

## Intent

Give every safeword project an `architecture.md` that describes the system _as it is now_ and cannot silently lie: its structural facts self-heal deterministically (even after out-of-band human edits), and any prose that has fallen behind the structure is visibly flagged rather than quietly wrong. Stale architecture context poisons agent output; this makes freshness a property of the doc, not a chore for the human.

## References

- Ticket QD5DTT (decisions 1–6, delivery slices, evidence base)
- Existing reuse: `boundaries.ts` (`DetectedArchitecture`), `depcruise-config.ts` — layer detection the extractor builds on
- Distinct from the ADR/decision-log machinery (`architectureReviewGate`, reconcile records) — additive, not a replacement

## Personas

- **Non-Technical Builder (NTB)** — directs the agent but can't read diffs/source to orient.
- **Technical Builder (TB)** — drives the agent across many sessions; harmed when stale context degrades agent output.

## Vocabulary

Feature-local terms (not yet in `.project/glossary.md`; promote if they recur across tickets):

- **Architecture state doc** — `.project/architecture.md` describing the system _as it is now_ (vs. the ADR log, which records _why_).
- **Skeleton** — deterministically-extracted structural facts (top-level `src/` layout, deps, dependency-cruiser boundary config, schema files) with code references. Zero LLM.
- **Shape-fingerprint** — a hash of architecture-relevant _shape_ (not bytes), stored in doc frontmatter; live-hash vs recorded = drift.
- **`purpose` floor** — every skeleton node carries a one-line purpose; mechanically presence- and orphan-checkable, so it gets the full freshness guarantee.
- **Self-heal** — deterministic (LLM-free) re-extraction of the skeleton on SessionStart when the fingerprint moved.
- **Staleness marker** — a per-section `⚠ stale` annotation written by self-heal when a prose section's `reconciled` stamp no longer matches the live skeleton fingerprint, or the section is orphaned.

## Jobs To Be Done

### architecture-state-docs.NTB1 — Understand my project's current shape without reading code

**Persona:** Non-Technical Builder (NTB)

> When I open my project to plan or direct the agent, I want an accurate,
> up-to-date map of what the system actually is right now — never silently
> wrong — so I can orient myself and make decisions without reading the diff
> or the source.

#### architecture-state-docs.NTB1.AC1 — Structural facts in the doc match the real project

The skeleton (modules, dependencies, boundaries, schema) reflects the actual tree, with code references — not a hand-written description that may be wrong.

#### architecture-state-docs.NTB1.AC2 — Prose that has fallen behind the structure is visibly flagged

Where narrative no longer matches the structure (or describes something deleted), the doc carries a visible `⚠ stale` marker on that section, so the reader is never silently misled — the doc may be incomplete, never quietly wrong.

### architecture-state-docs.TB1 — Keep the agent's architectural context current without hand-maintaining a doc

**Persona:** Technical Builder (TB)

> When I drive the agent across many sessions, I want the architecture doc it
> loads to stay factually current on its own — including after I change things
> by hand outside any agent session — so stale context never silently poisons
> the agent's output and I never have to babysit the doc.

#### architecture-state-docs.TB1.AC1 — Structural facts self-heal at session start, with no human action

When the project's shape has changed since the doc was last synced, the next session re-extracts the skeleton deterministically (LLM-free), so the facts the agent loads are current.

#### architecture-state-docs.TB1.AC2 — Out-of-band human changes are caught, not missed

A structural change committed outside any agent session is detected at the next session start (the fingerprint moved), and the skeleton is re-synced and/or the affected prose flagged — drift isn't dependent on the agent having made the change.

## Outcomes

- Opening a fresh single-repo TS project yields a `.project/architecture.md` whose skeleton matches the real tree, with a frontmatter fingerprint and a one-line `purpose` per node.
- A structural change made with no agent in the loop is reflected (skeleton re-synced) and/or flagged (`⚠ stale` on lagging prose) at the next session start.
- The drift signal and self-heal are LLM-free; warn-only at this slice (no blocking gate yet) but a stale doc is never _silently_ wrong.

## Open Questions

- defer: exact shape-fingerprint contents per input (src dirs / deps / dependency-cruiser config / schema — in or out of the hash). Resolved as the first define-behavior scenario (ticket → First scenarios to write).
