---
id: GCKB2Z
slug: prove-source-repo-install-at-cli-boundary
type: task
phase: done
external_prs:
  - https://github.com/ArcadeAI/safeword/pull/6258
scope:
  - A Gherkin feature that runs the built safeword CLI (install --agents=claude and claude status) against a fake claude host and a marketplace checkout offering an older released plugin.
  - Scenarios for the source repo (healthy, CLAUDE_PLUGIN_DOGFOOD_RELEASED, no plugin update), a consumer project (CLAUDE_PLUGIN_UNVERIFIED), and a plugin newer than the CLI (refused).
out_of_scope:
  - Any change to the PR #6258 production code; a bug a scenario exposes is reported, not fixed here.
  - Re-proving unit-level cases already covered in tests/claude-plugin/profile-install.test.ts (prerelease, payload identity mismatch, re-enable).
done_when:
  - The scenarios fail against a build with the source-repo exception disabled and pass on this branch.
  - bun run --cwd packages/cli test:bdd passes.
  - check-generated-surfaces.ts reports every surface current.
  - A draft PR is open against claude/intelligent-matsumoto-f06641.
status: done
created: 2026-11-23T17:58:40.686Z
last_modified: 2026-11-24T01:30:00.000Z
---

# Prove maintainers can install Safeword from the source repo while the CLI is unreleased

**Goal:** Gherkin scenarios drive the real safeword CLI to show the source-repo released-plugin exception, and its limits, end to end.

**Why:** PR #6258 shipped the exception with unit tests only; nothing exercised it through the install and status commands a maintainer actually runs.

## Work Log

<!-- Progress history, not part of the accepted contract: record scope and decisions above. -->

- 2026-11-23T17:58:40.686Z Started: Created ticket GCKB2Z
- 2026-11-23T18:10:00Z Added `features/install-from-the-source-repo-between-releases.feature` with steps that run the built CLI (`install --agents=claude`, `claude status`) against a fake `claude` host mirroring `tests/claude-plugin/profile-install.test.ts`.
- 2026-11-23T18:12:00Z RED proof (build mutated, then restored; no production change committed):
  - `acceptedPluginVersion` always returns `VERSION` → maintainer scenario fails: install exits 1 with `CLAUDE_PLUGIN_UNVERIFIED`.
  - Exception applied outside the source repo → consumer scenario fails: install exits 0 with `CLAUDE_PLUGIN_DOGFOOD_RELEASED`.
  - GREEN on the unmodified #6258 code: all three scenarios pass.
- 2026-11-23T18:12:00Z Decision: assert `claude status` classification `unproven` for the source repo. Status reaches `unproven` only after accepting the plugin version; the remaining runtime proof needs a real `/reload-plugins`, which no fixture can supply.
- 2026-11-23T21:20:00Z #6258 merged (`3f5353165`); PR #8210 retargeted to `main`, so the draft-PR criterion is met against `main` instead.
- 2026-11-23T23:20:00Z Scenario-quality pass: downgrade guard disabled → downgrade scenario fails (RED); added the consumer "asks Claude to update" assertion and made the `When` step persona-neutral (`845cd84df`).
- 2026-11-24T00:10:00Z `/verify` and `/audit` recorded in `verify.md` (`ee4299c75`); CI 15/15 green. Closed.
- 2026-11-24T01:28:38.843Z Phase: implement → done
- 2026-11-24T01:28:38.920Z Phase: implement → done
