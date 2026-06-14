---
id: 3BTGMW
slug: configure-audit-doc-sources
type: feature
phase: verify
status: in_progress
created: 2026-06-14T12:23:42.955Z
last_modified: 2026-06-14T12:56:53Z
scope:
  - Add top-level `docs.sources` support to `.safeword/config.json` parsing, separate from `paths.*`.
  - Support local documentation sources in this slice with stable resolution against the project root.
  - Teach `/audit` to prefer configured documentation sources and explicitly report when it falls back to local discovery.
  - Teach `/audit` to prompt for documentation sources when no `docs.sources` decision exists.
  - Let projects set `docs.sources: []` as an explicit "no configured documentation sources" decision so future audits do not ask again.
  - Document `docs.sources` in README and website configuration docs.
out_of_scope:
  - `audit.docs.*` namespacing; docs sources are project knowledge, not audit-owned.
  - Fetching URL docs, cloning external git repos, auth, or connector-backed docs.
  - Building full repo-inventory drift detection in this ticket.
done_when:
  - Unit tests cover valid local sources, invalid/malformed config, relative/absolute path resolution, and empty fallback.
  - BDD feature coverage exists for configured sources, missing-source prompting, and explicit-empty no-prompt behavior.
  - Audit skill/template docs mention top-level `docs.sources` and local discovery fallback.
  - Audit skill/template docs instruct agents to prompt only when `docs.sources` is absent, and to stop prompting when `docs.sources: []` is configured.
  - README and website docs show `docs.sources` examples.
---

# Configure documentation sources for audit

**Goal:** Let projects tell safeword where documentation lives so audit can compare repo reality against the right docs instead of guessing.

**Why:** Customer docs may live anywhere: README, docs folders, package websites, external repos, or URLs. The config contract needs to be generic before audit can reliably detect docs drift.

## Work Log

- 2026-06-14T12:23:42.955Z Started: Created ticket 3BTGMW
- 2026-06-14T12:23:42.955Z Decision: Use top-level `docs.sources`, not `audit.docs`, because documentation sources are project knowledge that audit consumes but does not own.
- 2026-06-14T12:39:53Z Implemented: Added `readConfiguredDocumentationSources` for local/url/git source shapes, local source validation in `safeword check`, audit guidance for configured-vs-fallback documentation coverage, and public docs for `docs.sources`.
- 2026-06-14T12:39:53Z Verified: `bun run --cwd packages/cli test tests/utils/documentation-sources.test.ts tests/commands/check.test.ts`, `bun --cwd packages/cli eslint src/utils/configured-paths.ts src/health.ts tests/utils/documentation-sources.test.ts tests/commands/check.test.ts`, `bun run --cwd packages/cli typecheck`, `bun run --cwd packages/cli lint:gherkin`, and Prettier check on touched files passed. `bun packages/cli/src/cli.ts check --offline` still fails only on pre-existing missing `.codex/config.toml`.
- 2026-06-14T12:44:00Z Backfill: Promoted to feature because audit now has a user decision flow and persistent no-prompt state. Backfilling spec, dimensions, feature source, R/G/R ledger, and implementation plan before continuing.
- 2026-06-14T12:56:53Z Implemented: Added `readConfiguredDocumentationSourceDecision` with `unset` / `explicit-none` / `configured`, updated audit surfaces to prompt only when `docs.sources` is absent, documented `docs.sources: []` as the durable no-prompt choice, and added executable Cucumber coverage.
- 2026-06-14T12:56:53Z Scenario gate: Manual `/review-spec` pass found one weak fallback assertion; strengthened BDD steps to assert audit template fallback/no-prompt instructions as well as config state.
- 2026-06-14T12:56:53Z Verified: `bun run --cwd packages/cli test tests/utils/documentation-sources.test.ts tests/commands/check.test.ts tests/skills/audit-documentation-sources.test.ts`, `bun run test:bdd -- features/configure-audit-doc-sources.feature`, `bun packages/cli/src/cli.ts lint-gherkin`, package ESLint on touched CLI files, `bun run --cwd packages/cli typecheck`, and Prettier checks passed. `safeword check --offline` still fails only on pre-existing missing `.codex/config.toml`.
