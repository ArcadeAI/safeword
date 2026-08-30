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
