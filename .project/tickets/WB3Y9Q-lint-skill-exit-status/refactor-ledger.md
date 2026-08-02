# Refactor Ledger

Scope: #1701 optional Go lint sections across the canonical templates and their
shipped copies.

- [x] Scout completed: no source abstraction is appropriate because the
  commands and skill are separate canonical templates, while dogfood and Codex
  plugin copies are generated distribution artifacts.
- [x] Keep the five-surface process contract explicit: it proves consumers
  receive the same executable behavior and fails if any copy drifts.
- [x] Keep the two fixture cases separate: a JavaScript-only project proves the
  absent-manifest success path, while a Go project proves the existing commands
  still run.

No findings were deferred.
