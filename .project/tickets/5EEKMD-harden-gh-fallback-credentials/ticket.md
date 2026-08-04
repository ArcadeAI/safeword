---
id: 5EEKMD
slug: harden-gh-fallback-credentials
type: task
phase: done
status: done
created: 2026-07-29T17:33:42.554Z
last_modified: 2026-07-30T00:46:48Z
external_issue: https://github.com/ArcadeAI/safeword/issues/1637
external_prs:
  - https://github.com/ArcadeAI/safeword/pull/1577
---

# Protect retro filing from malformed GitHub CLI credentials

**Goal:** Keep gh-based retro filing header-safe without prompting users for a token.

**Why:** Malformed gh output and environment coupling can make automatic filing fail or send unusable credentials.

## Scope

- Accept only RFC 6750 Bearer-syntax output from `gh auth token`.
- Run `gh auth token` with the real process environment, excluding only the rejected `GITHUB_TOKEN`.
- Reset subprocess mocks after each test and simplify the one-row parameterized test.

## Out of Scope

- Prompting for, storing, or creating GitHub credentials.
- Guessing whether opaque `GH_TOKEN` values are valid; GitHub remains the authority.

## Done When

- A malformed `gh` result cannot create a REST transport or Authorization header.
- An injected lookup environment cannot remove process context needed to invoke `gh`.
- The focused and repository verification lanes pass with isolated mocks.

## Work Log

- 2026-07-29T17:33:42.554Z Started: Created ticket 5EEKMD
- 2026-07-29T17:39:00.000Z Defined: Captured the late #1577 review findings as #1637 scope and acceptance criteria.
- 2026-07-29T17:42:14.000Z Implemented: Added RED→GREEN coverage for unsafe gh output, lookup-environment isolation, and mock reset; simplified the single-case test table.
- 2026-07-29T17:48:00.000Z Reviewed: Fresh independent quality review approved the implementation with no blocking findings.
- 2026-07-29T18:15:00.000Z Verified: Focused tests, canonical test plan, BDD acceptance lane, lint, formatting, and audit completed; recorded evidence in verify.md.
- 2026-07-30T00:46:48Z Completed: User authorized the done transition after the ready-PR closure gate confirmed the recorded verification evidence.
