# Work Log: Keep Codex reviews reliable without package bootstrap

**Anchored to:** .project/tickets/GVT6GE-reliable-codex-review-dispatch/ticket.md

---

## Session: 2026-08-30

- [08:39] Reproduced from the affected Codex task: `.safeword/hooks/record-skill-invocation.ts` was absent, then `bunx --bun safeword@0.82.2` failed because its temporary `commander` directory was incomplete.
- [08:41] Confirmed v0.82.2 fixed only `REVIEW_PENDING` status recovery by emitting the current runtime and CLI entrypoint.
- [08:42] Researched Codex plugin storage and Bun package execution. Chose a versioned bundled runtime to remove network and shared package installation from initial dispatch.
- [09:08] Generated a standalone Codex plugin CLI runtime and package identity, then routed all native hooks and review helpers through the versioned plugin cache path.
- [09:09] Added release-contract checks for runtime parity, package identity, exact hook commands, absence of package bootstraps, and execution with an empty Bun cache and no project dependencies.
- [09:10] Passed typecheck, 74 focused unit/parity tests, the targeted Codex hook BDD scenarios, and direct empty-cache runtime smoke checks. Final release-contract tests are waiting on the repository-wide single-Vitest lock.
- [14:25] Completed the full refactor pass: shared bundle normalization/building, removed the unused public helper surface, and kept generator-only code outside the shipped CLI graph.
- [14:25] Independent quality review found stale-runtime, event-binding, and real-cache-path proof gaps. Added deterministic Codex `--check`, per-event hook validation, shipped marketplace identity binding, and a real isolated `codex plugin add` release contract; the follow-up review approved with no release-relevant finding.
- [14:25] Full verification passed: 8,727 CLI tests, 292 relay/collector tests, 1,485 BDD scenarios, 42 release tests, 37 BDD proof tests, lint, formatting, typechecks, builds, and CLI contract.
- [14:25] Repository audit completed. No new dependency-boundary errors or orphan warnings remain from this change; repository-wide baseline debt was kept separate.
