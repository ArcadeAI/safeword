---
id: RYKVR5
slug: architecture-llm-prose-resync
type: feature
phase: intake
status: backlog
created: 2026-06-23T05:11:38.000Z
last_modified: 2026-06-23T05:12:00.000Z
---

# `/architecture` LLM-prose resync skill (deferred from JT852Q)

**Goal:** An on-demand `/architecture` skill that writes the slow-moving
narrative prose into the generated docs' placeholder/`⚠ stale` sections, then
re-stamps each section's `reconciled` fingerprint so the markers clear — the
first LLM capability in the architecture-doc system.

**See:** [spec.md](./spec.md) for personas, jobs-to-be-done, and outcomes.

## Status: BACKLOG — sits on JT852Q (prose persistence)

This is layer **(B)** of the original JT852Q. JT852Q now builds layer **(A)**,
the deterministic prose-persistence engine change (prose survives heals).
Without (A), any prose this skill writes is clobbered at the next heal — so this
ticket is blocked on JT852Q and deliberately deferred.

## Sketch (design at intake)

- Read the generated docs (single-repo doc, or monorepo root index + leaves);
  find sections whose prose is the placeholder or carries a `⚠ stale`/orphan marker.
- Use the LLM to write the narrative ("what this layer is for, how it fits"),
  bounded to the prose block — never the deterministic skeleton/fingerprint/path.
- Re-stamp `reconciled: <current-fingerprint>` so the stale marker clears (the
  "repair step" of epic decision 3 — semantic LLM as repair, not the drift signal).

## Open questions (intake)

- Stamp authority: skill re-runs a CLI affordance to re-stamp vs stamps inline
  (keep the deterministic engine the single source of truth).
- Scope control: resync-all vs only-flagged; cost on large monorepos.
- Quality floor: keep LLM prose honest (cite code refs the skeleton already knows).
- Surface: a SKILL.md (`/architecture`) vs a CLI subcommand vs both.

## Work Log

- 2026-06-23T05:12:00Z Created — split (B) the LLM resync skill out of JT852Q so
  the deterministic prose-persistence foundation (A) ships first. Blocked on JT852Q.
