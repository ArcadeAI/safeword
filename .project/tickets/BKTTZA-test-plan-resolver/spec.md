# Spec: safeword test-plan — one resolver for multi-language test/build plans

## Intent

A single pure resolver, exposed as `safeword test-plan`, that emits the correct test/build commands for **every** language present in a repo — the foundation that lets consumers (5FF0ZD) stop duplicating language logic and keeps a polyglot done-gate honest.

## References

- Epic [Q4FX8Y](../Q4FX8Y-extract-shared-test-runner/ticket.md) — full design, decisions, revalidation notes.
- Sibling [5FF0ZD](../5FF0ZD-migrate-consumers-to-test-plan/ticket.md) — consumes this resolver.

## Personas

- Technical Builder (TB)
- Safeword Maintainer (SM)

## Jobs To Be Done

### test-plan-resolver.DEV1 — trustworthy done-gate across languages

**Persona:** Technical Builder (TB)

> When my agent finishes work in a Python/Go/Rust or polyglot repo, I want the gate to run my real suite(s), so "done" means verified — not a silent pass.

#### test-plan-resolver.DEV1.AC1 — every detected language gets a plan entry (no first-match)

A repo with N languages present yields N test entries; adding a second language never hides the first.

#### test-plan-resolver.DEV1.AC2 — the command reflects the detected runner, not a hardcode

Python resolves tox / pytest / unittest (PM-aware); Rust resolves nextest vs `cargo test --workspace`; Go honors `go.work`; JS uses the project's own script (PM-aware).

#### test-plan-resolver.DEV1.AC3 — a missing toolchain is visible, never dropped

An entry whose tool isn't installed is returned with `available:false` (so a consumer skips loudly), not silently omitted.

#### test-plan-resolver.DEV1.AC4 — nested/sub-package manifests are discovered

A manifest in a sub-directory (no root manifest) still produces an entry; vendored/generated dirs are excluded.

#### test-plan-resolver.DEV1.AC5 — `--kind build` emits native build commands

Build plan yields `<pm> run build` (JS), `go build` (Go), `cargo build --workspace` (Rust); Python has no build entry.

### test-plan-resolver.SM1 — one CLI surface as the single definition

**Persona:** Safeword Maintainer (SM)

> When I add or change a language's test/build command, I want a single source of truth, so verify/audit/test-runner can't drift.

#### test-plan-resolver.SM1.AC1 — the resolver is reachable as one CLI surface

`safeword test-plan [--kind test|build] [--json]` emits the plan as machine-readable JSON — the single definition consumers call.

## Outcomes

- `safeword test-plan --kind test --json` on a polyglot fixture lists an entry per detected language.
- Each command reflects the detected runner; absent toolchains show `available:false`.
- Nested sub-dir manifests are discovered; no first-match drops a language.

## Open Questions

_None — epic-level decisions resolved (Q4FX8Y → Resolved build decisions). Fast-follows (PM-recursive JS, cross-language fast-subset) are out of scope here._
