---
id: X2Z8MN
slug: install-remote-test-workflows-safely
type: feature
phase: intake
status: in_progress
scope:
  - Managed workflow and identity installation, upgrade, disable and conflict handling
  - Reconciliation durability and customer-change preservation
out_of_scope:
  - Contributor preference parsing and GitHub dispatch lifecycle
done_when:
  - Setup can safely converge or refuse the managed remote-test workflow without overwriting customer work
parent: BBNZ68
created: 2026-08-09T21:20:30.052Z
last_modified: 2026-08-09T21:20:59Z
---

# Install remote test workflows without overwriting customer changes

**Goal:** Let projects opt in to the managed GitHub Actions workflow through safe setup, upgrade, disable, and conflict recovery.

**See:** [spec.md](./spec.md) for personas, jobs-to-be-done, and outcomes.

## Work Log

- 2026-08-09T21:20:30.052Z Started: Created ticket X2Z8MN
- 2026-08-09T21:20:59Z Scoped: Owns only the managed workflow lifecycle required by later remote execution.
