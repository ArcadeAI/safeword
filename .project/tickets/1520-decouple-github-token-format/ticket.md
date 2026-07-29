---
id: 1520
type: task
phase: done
status: done
created: 2026-07-28T00:00:00Z
last_modified: 2026-07-28T14:39:38Z
external_issue: https://github.com/ArcadeAI/safeword/issues/1520
scope: Treat GITHUB_TOKEN as an opaque RFC 6750 Bearer credential while rejecting documented environment placeholders and unusable characters, including from the gh fallback child environment.
out_of_scope: Changing the egress scrubber or validating whether a credential is authorized by GitHub.
done_when: The resolver has no GitHub-format allowlist, accepts valid opaque Bearer tokens without a length floor, and preserves proxy-placeholder fallback.
---

# Task: Keep future GitHub credentials usable without format updates

**Type:** Improvement

**Scope:** Make the retro REST token resolver accept opaque values that satisfy RFC 6750 Bearer-token grammar, while retaining the documented `proxy-injected` fallback to `gh`.

**Out of Scope:** Changing the format-coupled egress scrubber, adding authorization preflight, or interpreting GitHub token prefixes and lengths.

**Done When:**

- [x] Resolver accepts arbitrary valid Bearer-token syntax without a GitHub-specific prefix or minimum length.
- [x] Empty values, documented placeholders, whitespace, and control characters fall back to `gh` before an Authorization header is built.
- [x] A syntactically usable unauthorized value reaches the REST transport and its 401 remains terminal.
- [x] The `gh` child cannot reintroduce a rejected `GITHUB_TOKEN` placeholder.

**Tests:**

- [x] Unit: current classic, stateless, fine-grained, and legacy hex fixtures remain accepted alongside opaque valid Bearer values.
- [x] Unit: empty, placeholder, whitespace, and control-character values fall back to `gh`.
- [x] Unit: an opaque valid Bearer value is sent in the Authorization header and a 401 is terminal.
- [x] Unit: the default `gh` fallback omits rejected `GITHUB_TOKEN` while retaining an independent `GH_TOKEN` credential source.

## Work Log

- 2026-07-28T14:39:38Z Improved: Resolved all PR #1577 review items after fresh quality-review and figure-it-out passes. The syntax and placeholder-policy checks are separate, #1465 and #1520 own distinct terminal-401 regressions, nonliteral placeholders and terminal CR/LF are pinned, and the default `gh` child no longer inherits a rejected `GITHUB_TOKEN` (#1602) while retaining `GH_TOKEN`.
- 2026-07-28T06:50:00Z Complete: `$safeword:quality-review`, `$safeword:refactor`, `$safeword:verify`, and `$safeword:audit` completed. Full Vitest suite (5,596 passing; 5 skipped), BDD lane (505 passing; 3 skipped), typecheck, lint, format, and scope checks are green; audit baseline warnings are recorded in `verify.md`.
- 2026-07-28T06:15:00Z Corrected: Moved this record from the schema-managed `.safeword/` template directory to the project ticket namespace after full verification exposed the inventory violation.
- 2026-07-28T06:08:00Z Improved: Renamed the token predicate to describe Bearer-credential usability and added one-character, full-grammar, and NUL-control regression cases; targeted tests passed (45 tests).
- 2026-07-28T06:01:00Z Complete: Targeted tests, typecheck, ESLint, Prettier, and diff whitespace checks passed; no commit or tracker-state change was requested.
- 2026-07-28T05:59:00Z Verified: `bun run test src/retro/github-rest.test.ts` passed (42 tests); `bun run typecheck` passed.
- 2026-07-28T05:58:00Z Implemented: Replaced GitHub-specific token prefixes and length checks with RFC 6750 Bearer-token syntax plus the exact `proxy-injected` exclusion; added opaque-token, invalid-character, Authorization-header, and terminal-401 regression coverage.
- 2026-07-28T00:00:00Z Started: Triaged GitHub issue #1520 and recorded the scoped implementation and test plan.
