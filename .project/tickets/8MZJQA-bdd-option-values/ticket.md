---
id: 8MZJQA
slug: bdd-option-values
type: patch
phase: intake
status: in_progress
external_issue: https://github.com/ArcadeAI/safeword/issues/7724
created: 2026-11-17T15:46:26.635Z
last_modified: 2026-11-17T15:46:26.635Z
---

# Stop BDD lane option values dropping workspace features

**Goal:** test:bdd -- --name x.feature still runs scenarios from every workspace feature directory

**Why:** Option values ending in .feature were read as feature paths, so monorepo scenarios were silently skipped (#7724)

## Scope

- `templates/cucumber/cucumber.mjs`: the argument right after a value-taking Cucumber option (`--name`, `--tags`, `--format`, `--import`, `-p`, …) is that option's value, never a feature path. Arguments after a bare `--` stay positional.
- Every remaining positional argument is a feature path, as Cucumber itself reads it, so directory forms (`features/checkout/`, `./features`) also drop the default globs. Cross-agent review flagged the directory forms; this is the third defect from the old name-shape guessing, so the classifier is replaced rather than patched.
- New template hash in `cucumber-template-revisions.ts`; dogfood sync and regenerated surfaces.

## Out of scope

- Short-flag bundles such as `-fsummary` (already start with `-`, so already ignored).

## Work Log

<!-- Progress history, not part of the accepted contract: record scope and decisions above. -->

- 2026-11-17T15:46:26.635Z Started: Created ticket 8MZJQA
