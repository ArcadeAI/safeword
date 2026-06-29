---
id: CBTDK8
slug: portable-tracker-transport
type: feature
phase: intake
status: in_progress
epic: offboard-local-ticketing
parent: KKNFZA
scope:
out_of_scope:
done_when:
created: 2026-06-29T02:29:45.594Z
last_modified: 2026-06-29T02:29:45.594Z
---

# Environment-portable tracker transport (plan + pluggable executor)

**Goal:** Make `sync-tracker` work in any environment by computing a network-free sync **plan** and letting a pluggable **executor** (agent via MCP, CI via token+REST, dev via `gh`) apply it — instead of hard-wiring the `gh` binary.

**See:** [spec.md](./spec.md) for personas, jobs-to-be-done, and outcomes.

## Work Log

- 2026-06-29T02:29:45.594Z Started: Created ticket CBTDK8
