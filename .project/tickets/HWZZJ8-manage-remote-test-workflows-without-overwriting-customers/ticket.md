---
id: HWZZJ8
slug: manage-remote-test-workflows-without-overwriting-customers
type: feature
phase: verify
status: in_progress
scope:
  - Ownership classification, status, explicit first-time setup, and disable for one managed workflow
  - Exact current workflow identity across ordinary checkout line-ending conversion
  - Complete no-clobber publication, fresh pre-mutation checks, and safe retry after interruption
out_of_scope:
  - Historical workflow recognition and replacement (FFXB81)
  - Workflow authority and release admission (GRDXXA)
  - Dispatch and remote-result lifecycle (S2TF4J)
  - Changing local or remote-preferred execution settings
done_when:
  - One no-follow classifier behind an injectable filesystem seam recognizes absence and exact current workflow bytes without subprocesses, customer code, or adoption of customer bytes
  - Customer divergence and unsafe paths are preserved and name one safe action
  - Human and JSON status agree on ownership state, affected path, and next action
  - Setup and disable recheck ownership, are idempotent, and leave execution preference unchanged
  - Failed or interrupted first-time setup leaves absence or the complete current workflow and retry converges safely
parent: X2Z8MN
follow_ups:
  - FFXB81
inspiration_contract: v1
inspiration_contract_scaffold: v1
created: 2026-08-12T03:13:59.777Z
last_modified: 2026-08-12T03:13:59.777Z
---

# Manage remote test workflows without overwriting customers

**Goal:** Let builders inspect and safely manage remote-test workflows without adopting customer-owned bytes or reporting partial work as complete.

**See:** [spec.md](./spec.md) for personas, jobs-to-be-done, and outcomes.

## Work Log

- 2026-08-12T03:13:59.777Z Started: Created ticket HWZZJ8
- 2026-08-12T03:30:00Z Split from X2Z8MN at scenario-gate; inherited its confirmed intent, scope, and ownership/status scenarios.
- 2026-08-14T22:11:36-07:00 Recombined H136BP after plan review proved public mutation cannot be safely completed or released separately from durability, restart recovery, retained-failure handling, and writer serialization.
- 2026-08-15T00:13:13-07:00 Re-split at the plan-implementation checkpoint after current DORA and review guidance showed the read-only classifier/status slice is independently useful and the existing release-contract gate can keep all mutation unreachable until H136BP proves durability.
- 2026-08-15T01:32:00-07:00 Recombined after seven plan reviews proved the proposed split's premortem: status actions were unusable without the writer, public types could not safely freeze before writer integration, and recovery authority crossed the ticket boundary. Retained small internal delivery batches and one public release gate instead of a false implementation seam.
- 2026-08-16T00:00:00-07:00 Simplified after independent review: installation now manages one workflow and never changes execution preference, removing the need for an installed-state sidecar, Git lock, journal, receipt, or custom transaction protocol.
- 2026-08-16T20:50:00-07:00 Plan review defined permanent publication failures, the shared filesystem seam, parent/residue preservation, and the uninstall notice; GRDXXA admission remains the release dependency for provisional workflow bytes.
- 2026-08-16T21:52:00-07:00 Implementation started with retained proofs: `2a1d50257` verifies exclusive same-directory publication preserves a concurrently appearing customer workflow; `fc8cdf160` → `bfc3bb958` records RED/GREEN ownership classification for missing, current LF/CRLF, customer-owned, and symlinked paths. Typecheck, targeted tests, lint, and diff checks pass. Final bundled bytes remain gated on BR373S's trusted pre-check runner and GRDXXA admission; lifecycle work can continue against injected candidate bytes without public wiring.
- 2026-08-16T22:31:00-07:00 Completed the internal lifecycle slice through retained RED/GREEN commits `2e0057dab` → `26b40a457`, `b91ef8561` → `87e725b54`, and `510dea808` → `659dd8ef4`. Setup preserves customer bytes at exclusive publication, lifecycle results report inert private residue without masking the primary result, and disable distinguishes ENOENT convergence from permanent removal failure (`49cb4c1f1`). All 15 focused workflow tests, package typecheck, targeted lint, and diff checks pass. Public schema/template registration and CLI wiring remain intentionally blocked until BR373S supplies the trusted pre-check runner and GRDXXA admits those exact bytes.
- 2026-08-18 Public lifecycle wiring completed for status, setup, and disable. Project configuration now owns an optional stack-neutral remote setup command; personal configuration can override only local versus remote preference. Released-v1 migration is implemented under FFXB81. Focused verification passed (6 files, 115 tests); independent quality re-review is in progress.
