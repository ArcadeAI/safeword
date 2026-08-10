---
id: S2TF4J
slug: run-tests-remotely-with-safe-recovery
type: feature
phase: intake
status: in_progress
scope:
  - Eligible GitHub dispatch, exact run correlation, observation, terminal reporting and recovery
  - Local fallback only before remote creation is proven absent
out_of_scope:
  - Workflow installation mechanics and in-run trust checks
depends_on: [S7TZF9, X2Z8MN]
done_when:
  - A valid eligible test request produces one recoverable remote result or a proven-safe local fallback
parent: BBNZ68
created: 2026-08-09T21:20:36.052Z
last_modified: 2026-08-09T21:20:59Z
---

# Run tests remotely with safe recovery

**Goal:** Dispatch an eligible test run to GitHub Actions, preserve durable recovery evidence, and use local fallback only when no remote run was created.

**See:** [spec.md](./spec.md) for personas, jobs-to-be-done, and outcomes.

## Work Log

- 2026-08-09T21:20:36.052Z Started: Created ticket S2TF4J
- 2026-08-09T21:20:59Z Scoped: Depends on contributor preference and managed workflow installation; owns dispatch and recovery evidence.
