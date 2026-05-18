---
id: 154
type: task
phase: intake
status: in_progress
created: 2026-05-18T05:26:00Z
last_modified: 2026-05-18T05:26:00Z
scope: |
  Design and implement a pattern for "canonical example by reference" so that docs,
  skills, and guides describing the same format/contract point at one source rather
  than duplicating examples inline. Two candidates to evaluate:
  (a) Markdown link/include pointers (e.g., guides say "See canonical example:
      .safeword/templates/test-definitions-feature.md" instead of inline duplication)
  (b) Build-time templating (process .md files to inline a tagged section from a
      designated source file at install/upgrade time)
  Pick one, apply to test-definitions format (the worst current offender), document
  the pattern for future format consolidation.
out_of_scope: |
  - Migrating EVERY duplicated example in the repo (just the test-definitions one
    as proof-of-concept; future PRs follow the pattern)
  - Replacing prose explanations (only the example blocks)
  - Build tooling that breaks Claude Code's existing markdown-as-source rendering
done_when: |
  - Pattern documented in .safeword/guides/context-files-guide.md
  - planning-guide.md + SCENARIOS.md + TDD.md reference the canonical example
    rather than duplicating it
  - Verified: editing the canonical example propagates to all reference sites
    (whether at runtime via Claude reading or at install via templating)
---

# Canonical-example-by-reference pattern for shared format docs

**Goal:** Eliminate duplicate format examples across docs by having all sites reference one canonical source.

**Why:** Ticket 152 had to update test-definitions format in 4 files (template + SCENARIOS.md + planning-guide + README) because each duplicated the example inline. A reference pattern means future format changes touch one file. Combined with ticket 153's contracts, this gives both detection (contracts catch drift) and prevention (one source eliminates the possibility of drift).

## Work Log

- 2026-05-18T05:26:00Z Started: ticket created from 152 audit follow-up
