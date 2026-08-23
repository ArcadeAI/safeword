---
id: GRDXXA
slug: install-only-trusted-remote-test-workflows
type: feature
phase: plan-implementation
status: in_progress
scope:
  - Release admission of the exact bundled GitHub Actions workflow
  - Manual trigger, least privilege, immutable dependencies, credential, and secret constraints
out_of_scope:
  - Workflow lifecycle reconciliation, identity conflict reporting, and status (HWZZJ8)
  - First-publication recovery (HWZZJ8) and future historical replacement (FFXB81)
  - Runtime validation of remote inputs and results (BR373S)
done_when:
  - Only the exact useful manual-dispatch workflow with contents-read authority enters ownership history
  - Every remote dependency is pinned to a full lowercase commit SHA and checkout credentials are not persisted
  - A compact guard-sensitive regression set rejects secrets, ambiguous YAML, excess permissions, mutable references, and packaged-byte drift
parent: X2Z8MN
depends_on:
  - HWZZJ8
inspiration_contract: v1
inspiration_contract_scaffold: v1
created: 2026-08-12T03:14:00.046Z
last_modified: 2026-08-12T03:14:00.046Z
---

# Install only trusted remote test workflows

**Goal:** Admit and install only useful, manual, least-privilege remote-test workflow bytes.

**See:** [spec.md](./spec.md) for personas, jobs-to-be-done, and outcomes.

## Work Log

- 2026-08-12T03:14:00.046Z Started: Created ticket GRDXXA
- 2026-08-12T03:30:00Z Split from X2Z8MN at scenario-gate; inherited its confirmed workflow-admission and least-authority contract.
- 2026-08-16T00:00:00-07:00 Simplified admission to release-time validation of the exact shipped workflow; removed the proposed general runtime policy engine and 85-case production registry.
