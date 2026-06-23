---
id: JT852Q
slug: architecture-resync-skill
type: feature
phase: intake
status: backlog
created: 2026-06-23T03:46:29.788Z
last_modified: 2026-06-23T03:47:00.000Z
---

# `/architecture` on-demand LLM-prose resync skill (deferred from Slice 4)

**Goal:** An on-demand `/architecture` skill that fills in / refreshes the
slow-moving narrative prose of the generated architecture docs — the layer the
deterministic engine deliberately leaves as `PURPOSE_PLACEHOLDER` / flags
`⚠ stale` — then re-stamps each section's `reconciled` fingerprint so the
markers clear.

**See:** [spec.md](./spec.md) for personas, jobs-to-be-done, and outcomes.

## Status: BACKLOG — deferred from Slice 4

Slice 4 (epic QD5DTT line 103) bundled this skill with the guide split. Split out
deliberately: this is the **first LLM-prose capability** in the architecture-doc
system (Slices 1–3 are strictly deterministic / LLM-free), so it warrants its own
design pass rather than riding a docs change. The guide split + polyglot
enforcement reconcile ship first as ticket **8JMV3Q**.

## Sketch (to design at intake)

- Reads the generated docs (root + leaves), finds sections whose prose is a
  placeholder or carries a `⚠ stale` / orphan marker.
- Uses the LLM to write the narrative ("what this layer is for, how it fits"),
  bounded to the slow-moving prose — never the deterministic skeleton/fingerprint.
- Re-runs the deterministic stamp so `reconciled: <fingerprint>` matches the live
  shape and the markers clear (the "repair step" of epic decision 3 — semantic
  LLM as repair, never the primary drift signal).
- Monorepo-aware (Slice 3): resync the root index overview + each leaf.

## Open questions (intake)

- Stamp authority: does the skill re-run `safeword architecture` to re-stamp, or
  stamp inline? (Keep the deterministic engine the single source of truth.)
- Scope control: resync-all vs only-flagged sections; cost on large monorepos.
- Quality floor: how to keep LLM prose honest (cite code refs the skeleton knows).

## Work Log

- 2026-06-23T03:46:29Z Started: Created ticket JT852Q.
- 2026-06-23T03:47:00Z Deferred to backlog — split from Slice 4 so the guide
  ships now (8JMV3Q) and the first LLM-prose capability gets its own design.
