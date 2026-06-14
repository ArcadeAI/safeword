---
id: VM78NC
slug: cucumber-runner-discovery-profiles
type: task
phase: intake
status: in_progress
epic: bdd-phase-two-merge
depends_on: [102b, 1DT29X]
relates_to: [XK5N14, CXP9LM]
created: 2026-06-13T23:32:20.673Z
last_modified: 2026-06-14T00:58:37Z
scope:
  - Align the feature-file discovery policy across Cucumber runner config, `lint-gherkin`, `safeword check`, and `codify`.
  - Decide and implement the default runner profile for package-level feature files in monorepos.
  - Define an intentional default treatment for `@manual` and `@live` feature tags so local/CI Cucumber runs do not accidentally execute trusted-environment smoke tests.
  - Update source templates and dogfooded Cucumber configs consistently.
  - Add a monorepo/package-level feature fixture proving intended feature files are either run or explicitly excluded by profile.
out_of_scope:
  - Building the Codex live smoke implementation itself.
  - Native-language Cucumber step definitions.
  - Removing legacy markdown fallback in `check` or `codify`.
  - Broad workspace detection rewrites outside feature-file discovery.
done_when:
  - The scaffolded `cucumber.mjs` behavior matches the feature paths that safeword lints and reads.
  - Package-level feature files cannot silently pass lint/check while being skipped by `test:bdd`.
  - `@manual` / `@live` exclusion is documented and test-backed, or an alternative profile decision is recorded with evidence.
  - Template and dogfood configs stay aligned.
  - Focused Cucumber/setup tests pass.
---

# Run every intended feature file in the Cucumber lane

**Goal:** Make safeword's Cucumber runner execute the same feature files that safeword lints, reviews, checks, and codifies.

**Why:** Today root/package discovery is inconsistent: package-level `.feature` files can be visible to safeword tooling while the scaffolded Cucumber config only runs root `features/**/*.feature`.

## Evidence

- `lint-gherkin` discovers root `features/` and `packages/*/features/`.
- `findFeatureSourcePath` recursively finds feature files in any `features` directory up to depth 5.
- `templates/cucumber/cucumber.mjs` runs only `features/**/*.feature`.
- The Codex feature-file backfill added an ad hoc package-local `tags: 'not @live and not @manual'`; that policy is not in the customer scaffold.

## Work Log

- 2026-06-13T23:32:20.673Z Started: Created ticket VM78NC
- 2026-06-13 Scoped from Gherkin/Cucumber incompleteness audit: runner discovery and tag profiles need one explicit policy instead of per-surface drift.
- 2026-06-14T00:07:27Z Implemented: Cucumber configs and `lint-gherkin` now share root/workspace feature discovery; local profiles skip `@manual` and `@live`; focused integration plus package/root Cucumber lanes passed.
- 2026-06-14T00:37:58Z Quality-review follow-up: constrained `check`/`codify` feature-source lookup to the same executable roots and refactored `lint-gherkin` to use the shared collector; regression tests and Cucumber lanes passed.
- 2026-06-14T00:58:37Z Refactor: simplified feature-source matching into one predicate; focused feature-source tests, package lint, and package/root Cucumber lanes passed.
