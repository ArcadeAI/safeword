---
id: 8MZJQA
slug: bdd-option-values
type: patch
phase: done
status: done
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
- 2026-11-17T17:35:00.000Z Implemented red-first: `--name option-value.feature` ran 0 scenarios and passed. Fixed option values, then replaced the name-shape classifier with Cucumber's positional rule after cross-agent review found directory forms; two further review passes added combined short options and `--name --`. Pass 4 approved; the ticket-level review added a lone `-` (e2b2f7fa4) and then approved (ce967590). Verify and audit passed (see verify.md).
- 2026-11-17T17:35:00.000Z Phase: intake → done
- 2026-11-17T18:21:28.819Z Phase: intake → done
