---
id: CTAZT5
slug: rename-generated-architecture-doc
type: task
phase: implement
status: in_progress
created: 2026-06-21T19:59:00.000Z
last_modified: 2026-06-21T20:03:00.000Z
---

# Rename generated architecture doc to architecture.generated.md

**Goal:** Give the auto-generated architecture state doc a self-describing, machine-owned name (`<namespace-root>/architecture.generated.md`) that can't be confused with a hand-written architecture/ADR doc.

**Why:** Slice 1 wrote the generated doc to `paths.architecture` (default `.project/architecture.md`) — the same config key that points at the hand-curated decision/ADR location. One name, two meanings. The `.generated.` infix signals "do not hand-edit" and decouples the generated state doc from `paths.architecture` (which stays for human-authored decisions).

## Work Log

- 2026-06-21T20:03:00Z Implement: added `resolveGeneratedArchitecturePath` (fixed `<namespace-root>/architecture.generated.md`, not overridable); `selfHeal` now writes there instead of `resolveConfiguredPath(cwd, 'architecture')`. Updated doc/command tests + BDD steps. 26 unit/integration tests + 21 BDD scenarios green; lint/typecheck clean. No migration: the old default `.project/architecture.md` doubled as the ADR-record location, so it must not be auto-deleted; in practice no generated docs exist in the wild (Slice 1 shipped hours ago).
