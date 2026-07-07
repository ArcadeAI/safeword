---
id: G19QG7
slug: retro-filing-provenance
type: feature
phase: implement
phase_anchors:
  - define-behavior: 38cb72b
  - scenario-gate: e3ba3b5
  - implement: 8e21f97
status: in_progress
scope:
  - environment-aware provenance captured per encounter (dogfood repo → safeword short HEAD SHA + capture time; customer install → installed safeword version), recorded in the code-assembled ledger comment on both create and bump paths
  - ledger schema extension with safe coercion — pre-provenance ledgers parse unchanged
  - reconcile sweep as a CLI mode that lists open retro-labeled issues, normalizes each issue's newest provenance to a code-state date (SHA → capture time; version → release-tag date), flags possibly-resolved via an idempotent comment + label, and bounds its API operations per run (actions/stale precedent)
out_of_scope:
  - CI wiring of the reconcile sweep (one-line follow-up outside this ticket)
  - in-session staleness deferral (separate design with Stop-timing tradeoffs)
  - auto-closing issues — reconcile only flags
  - reconciling process/<slug>-surfaced or pre-provenance issues (left untouched)
done_when:
  - a newly filed or bumped retro issue's ledger shows the newest encounter's provenance — SHA in a dogfood session, version in a customer install — and never any customer repo identifier
  - reconcile flags exactly the open issues whose surface was touched on the default branch after their newest code-state date, and a re-run against unchanged state adds no new comments or labels
created: 2026-07-05T23:05:32.609Z
last_modified: 2026-07-05T23:05:32.609Z
---

# Retro records filing-time provenance for reconciliation against merged state

**Goal:** Record what code state each retro finding was captured against and flag open issues whose surface has changed since, so stale retro issues stop needing git-log archaeology.

**See:** [spec.md](./spec.md) for personas, jobs-to-be-done, and outcomes.

## Work Log

- 2026-07-05T23:05:32.609Z Started: Created ticket G19QG7
- 2026-07-06T00:34:00Z figure-it-out: environment-aware provenance (dogfood SHA vs customer version), date-based reconcile — spec.md "Environment split"
- 2026-07-06T00:42:00Z JTBD + Rules gates confirmed by user; engineering scope drafted, pending scope gate
- 2026-07-06T00:55:00Z Complete: intake - scope gate confirmed, open questions resolved (SM2.R4 broadened to cover process-surface skip)
- 2026-07-07T14:37:58.238Z Phase: define-behavior → scenario-gate
- 2026-07-07T14:46:20.359Z Phase: scenario-gate → implement
