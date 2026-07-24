# Verification: Keep cloud-spooled retro filing from bypassing duplicate checks

## Verify Checklist

**Test Suite:** ✓ 41/41 tests pass in the focused carrier suite: generated
Cursor rule, generated Codex plugin skill, filing gate, and real Codex Stop
adapter.

**Gherkin:** ✅ Acceptance lane passes (`bun run test:bdd`).

**Build:** ✅ Success (`bun run --cwd packages/cli build`).

**Lint:** ✅ Clean (`bun run lint`).

**Scenarios:** All 13 scenarios marked complete.

**PR Scope:** ✅ Diff matches #1031 / H1P0D7 scope: canonical spool identity,
runtime-specific filing carriers, generated assets, tests, and their BDD
artifacts only.

**Dep Drift:** ⚠️ Dependency-cruiser has one pre-existing `no-orphans` warning
for `packages/cli/src/codex-plugin/hooks.ts`; it reports no errors and this PR
adds no dependency or lockfile changes.

**Parent Epic:** N/A.

**Reconcile:** ✅ No pattern deviation: the Cursor rule is generated from the
canonical wrapper metadata and Codex uses the plugin skill carrier documented
by current Codex plugin guidance.

**Experience:** ✅ N/A — internal tracker transport. Walked Safeword Maintainer
through an unfiled cloud draft; worst step is the external tracker write, and
new steps versus before = 0.

**Evidence limits:** ⚠️ The aggregate Vitest runner remains long-running in the
local and CI matrix runs after setup, a known runner limitation unrelated to
the focused carrier path. Focused runtime tests, the direct Cucumber lane,
lint, build, format, schema-drift checks, and dependency-cruiser complete.

**Audit:** Audit passed — no architecture, dead-code, wiring, or new dependency
finding in this diff. `bun audit` still reports two pre-existing website/tooling
advisories (`fast-uri` high and Astro moderate); neither is introduced by this
PR.

**Quality Review:** APPROVE — current Codex documentation confirms plugins are
the supported carrier for skills and hooks, while custom subagents remain
separate configuration; the real Stop adapter and generated artifacts have
focused wiring coverage.

**Refactor:** ✅ No structural refactor warranted; the small runtime formatter
split keeps a shared dispatch gate and prevents a Codex-only special case from
leaking into Claude/Cursor behavior.
