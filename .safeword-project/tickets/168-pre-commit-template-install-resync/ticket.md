---
id: 168
type: patch
phase: intake
status: in_progress
created: 2026-05-20T06:08:00Z
last_modified: 2026-05-20T06:08:00Z
scope: |
  Add a pre-commit hook (or extend the existing lint-staged config) that
  re-syncs the dogfood install copy (`.safeword/...`, `.claude/skills/...`)
  whenever its template source (`packages/cli/templates/...`) is staged
  for commit AND has been modified by the formatter pass.

  Concrete: when `lint-staged` runs prettier / markdownlint on a staged
  template file and the formatter rewrites it, the corresponding
  dogfood pair-member doesn't get the same update (it was staged earlier
  with pre-format content). Result: byte-level pair drift that
  `dogfood-parity.release.test.ts` catches in CI.

  Resolution paths (decide during fix):
  (a) Post-formatter step in lint-staged that runs a sync script
      (`scripts/sync-dogfood.ts`) which iterates SAFEWORD_SCHEMA.ownedFiles
      and copies template -> install for any pair whose template was just
      formatted
  (b) Pre-commit hook (husky) that runs the same sync after lint-staged
      completes
  (c) Make the formatter aware of pair-members and format both at once
      (more invasive — touches prettier/markdownlint config)
out_of_scope: |
  - Reorganizing SAFEWORD_SCHEMA.ownedFiles structure
  - Changing which files are paired
  - Auto-fixing parity drift in CI (the goal is preventing it at commit
    time, not letting it land then patching after)
  - Anything in the templates themselves
done_when: |
  - Committing a change to any template file with formatter-applied edits
    leaves the install copy in byte-equal sync
  - Release-gate `dogfood-parity.release.test.ts` cannot fail from
    "I edited the template, lint-staged reformatted it, but the install
    copy still has my pre-format content"
  - Mechanism documented (one line in CLAUDE.md or AGENTS.md)
  - No new pre-commit latency cost > 2 seconds for non-template edits
---

# Pre-commit auto-resync of template/install pairs after formatter pass

**Goal:** Make the lint-staged formatter step transparent to dogfood parity — if it touches a template, the paired install copy automatically catches up before commit lands.

**Why:** PR #117 hit this exact failure in CI. Four template files (`prompt-questions.ts`, `planning-guide.md`, `test-definitions-feature.md`, `SCENARIOS.md`) had been manually `cp`'d to their `.safeword/...` install copies during the work session. But the final commit ran lint-staged, which reformatted the templates (trailing whitespace, markdown polish). The install copies — already staged with pre-format content — didn't get re-synced, so the release-gate parity test failed with 4 byte-level drift errors. Fixed manually by re-`cp`-ing in commit `e1974d6`, but the underlying mechanism is still broken: any future PR that touches owned-file templates is one formatter pass away from the same failure. This patch closes the structural gap.

## Work Log

- 2026-05-20T06:08:00Z Started: ticket created post-merge of #117 to address the root cause of that PR's CI failure. Lower priority than functional work but worth fixing before the next contributor (or future-session-me) trips over it again.
