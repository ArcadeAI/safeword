---
id: JCC69C
slug: dev-tooling-version-bumps
type: task
phase: intake
status: backlog
external_issue: https://github.com/ArcadeAI/safeword/issues/717
scope: |
  Bump six dev-only tooling dependencies flagged outdated by the 2026-07-04
  audit (all devDependencies; no runtime deps involved):
    - @types/node       26.0.1 → 26.1.0   (minor)
    - eslint            10.5.0 → 10.6.0    (minor)
    - knip              6.20.0 → 6.24.0    (minor)
    - prettier          3.8.4  → 3.9.4     (minor)
    - tsx               4.22.4 → 4.23.0    (minor)
    - markdownlint-cli2 0.22.1 → 0.23.0    (0.x minor — treat as major per audit risk matrix)
  Update package.json + lockfile, run the full suite + lint, and fix any
  formatter/lint churn the prettier and markdownlint-cli2 bumps introduce.
out_of_scope: |
  - Runtime/production dependency upgrades (none were flagged).
  - eslint/prettier config rewrites beyond what the bump strictly requires.
  - The 5 unused exports flagged by the same audit — tracked in J2R9HY.
done_when: |
  - All six packages are at the listed target versions in package.json and the
    bun lockfile.
  - `bun run test`, `/lint` (eslint + prettier + tsc --noEmit) are green.
  - Any prettier 3.9 / markdownlint-cli2 0.23 reformatting is committed so the
    pre-commit hook is a no-op on a clean tree.
  - markdownlint-cli2's 0.x-minor bump is verified against its changelog for
    rule-default changes before merging (audit matrix flags 0.x minors as
    breaking-risk).
created: 2026-07-04T00:18:53.861Z
last_modified: 2026-07-04T00:18:53.861Z
---

# Bump 6 dev-tool dependencies (audit follow-up)

**Goal:** Bring the six outdated dev-tool dependencies up to their current
minor versions and absorb any resulting formatter/lint churn.

**Why:** Surfaced by the 2026-07-04 audit during the #644 G8 verify pass. All
six are low-risk dev tooling (only `markdownlint-cli2`'s 0.x minor warrants a
changelog check), but they were out of scope for the docs-cleanup ticket. Kept
as a standalone maintenance task so the bumps and their reformatting land in one
reviewable diff instead of riding along with unrelated work.

## Work Log

- 2026-07-04T00:18:53.861Z Started: Created ticket JCC69C
- 2026-07-04T00:20:00Z Scoped from audit follow-up (parent context: #644 G8 verify). status → backlog.
