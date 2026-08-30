---
id: V2AH4B
slug: codex-self-contained-scripts
type: task
phase: done
status: done
parent: 2C1E82
created: 2026-08-18T16:58:46.360Z
last_modified: 2026-08-30T08:00:00.000Z
---

# Let Codex skills run without project-local .safeword scripts

**Goal:** Rewrite Codex's skill-invoked scripts (run-review.ts, resolve-project-knowledge.ts, closeout-cleanup.ts, drain-retro-spool.ts, cleanup-zombies.sh, record-skill-invocation.ts, etc.) to shell out via bunx --bun safeword@<version> <subcommand>, the same self-contained pattern Codex's lifecycle hooks (hooks.json) already use, instead of bun .safeword/hooks/<script>.ts / .safeword/scripts/<script>

**Why:** Codex's lifecycle hooks are already self-contained via bunx, but its skill playbooks (verify, audit, review-spec, self-review, closeout, cleanup-zombies, retro-filer, explain) still shell out directly to project-local .safeword/hooks/*.ts and .safeword/scripts/*, so Codex-only projects still need those files installed and kept in sync with no auto-upgrade path — same root problem as Claude's dependency, just via a different mechanism (direct file path vs missing env wiring)

## Work Log

- 2026-08-18T16:58:46.360Z Started: Created ticket V2AH4B
- 2026-08-19T21:56:00.000Z Shipped a scoped-down first slice: `catalogue.ts` now rewrites `bun .safeword/hooks/run-review.ts ...` to `bunx --bun safeword@<version> review run ...` at generation time, across all 5 skill occurrences (bdd/SKILL.md, quality-review/SKILL.md, review-spec/SKILL.md, bdd/TDD.md, bdd/PLAN_IMPLEMENTATION.md). Independent Codex review (`review run quality-review`) confirmed the change itself is sound; it also surfaced 3 pre-existing, unrelated catalogue bugs (exact-match validation only checks `.md` files, unsafe global-replace reference rewriting, Markdown table alignment/trailing-pipe loss) — spun off as a separate background task rather than fixed inline, to avoid scope creep. Committed as d12172b4d. The other 10 project-local scripts (write-review-stamp.ts, record-skill-invocation.ts, closeout-cleanup.ts, cleanup-zombies.sh, lib/audit-scope.sh, resolve-project-knowledge.ts, resolve-namespace-root.ts, resolve-verify-ticket.ts, audit-principle-trace.ts, lib/drain-retro-spool.ts) remain out of scope for this slice — each needs either a new public CLI subcommand built or carries session-identity-bridging risk via codex-hook.ts's literal string matching on `write-review-stamp.ts`/`record-skill-invocation.ts` invocation text. Follow-up tickets for those not yet drafted.
- 2026-08-30T08:00:00.000Z Completed by epic 2C1E82: every remaining Codex skill helper resolves through a version-pinned packaged CLI entry point, and release validation rejects project-runtime references.
