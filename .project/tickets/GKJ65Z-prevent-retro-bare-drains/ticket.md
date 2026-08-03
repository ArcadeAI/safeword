---
id: GKJ65Z
slug: prevent-retro-bare-drains
type: patch
phase: verify
status: in_progress
external_issue: https://github.com/ArcadeAI/safeword/issues/1805
created: 2026-08-03T00:41:21.124Z
last_modified: 2026-08-03T00:41:21.124Z
---

# Prevent retro findings from draining without acknowledgements

**Goal:** Ensure every CLI-filed retro draft is acknowledged with its destination issue before the spool is drained.

**Why:** A bare drain can lose captured findings while the user-facing nudge still claims they are queued.

## Work Log

- 2026-08-03T00:41:21.124Z Started: Created ticket GKJ65Z
- 2026-08-03T00:45:00Z Found: The CLI runRetro path drains triage.result.filedSignatures without writing the per-signature acknowledgement required by GH644A. The agent filing reference path writes acknowledgements, but silently drains even if that write fails.
- 2026-08-03T00:45:00Z Plan: Add destination issue numbers to the triage result, persist each acknowledgement before draining, and retain any draft whose acknowledgement cannot be written.
- 2026-08-03T01:03:55Z Implemented: Triage now reports destination issue numbers; both CLI and agent filing persist destination-bound acknowledgements and drain only acknowledged signatures.
- 2026-08-03T01:03:55Z Verified: 6,245 unit/integration tests passed (5 skipped); root BDD passed 768/768 runnable scenarios (3 skipped); package BDD passed 278/278; build, typecheck, ESLint, and dependency audit passed.
- 2026-08-03T01:35:00Z Quality review: Found that the production filer prompts did not require confirming the acknowledgement write, invalid destinations could serialize into reader-rejected records, and the nudge claimed later queue state it had not re-read.
- 2026-08-03T01:42:00Z Hardened: Every shipped filer surface now re-reads and exact-checks acknowledgements before removal; invalid destinations are rejected; the nudge describes only the state observed at its boundary and directs filing to re-read current state.
- 2026-08-03T02:20:00Z Deep review: Reproduced an append-success/read-failure permission state that still authorized a drain and found the agent path relied on prose for the irreversible rewrite.
- 2026-08-03T02:30:00Z Hardened: Ack success now requires an exact post-write read; both code-owned filing paths retain drafts when readback fails. Shipped agents drain only through a code-owned helper that removes reader-visible acknowledged drafts, and the remaining unrestricted-filesystem limitation is explicit.
