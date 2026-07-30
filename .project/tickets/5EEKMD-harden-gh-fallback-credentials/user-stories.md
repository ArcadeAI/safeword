# User Story: Protect retro filing from malformed GitHub CLI credentials

As a developer with an existing GitHub CLI login,
I want retro filing to use that login safely when `GITHUB_TOKEN` is unavailable or rejected,
so that filing works without asking me to create or provide another token.

## Acceptance Criteria

1. Given `gh auth token` returns text outside RFC 6750 Bearer syntax, when retro resolves credentials, then it resolves no token and creates no REST transport.
2. Given a caller supplies an environment only to look up `GITHUB_TOKEN`, when fallback invokes `gh`, then the child receives the real process environment except for `GITHUB_TOKEN`.
3. Given `GH_TOKEN` is configured explicitly, when fallback invokes `gh`, then it remains available to `gh` as an opaque operator-controlled credential.
4. Given one test configures a subprocess response, when the next test runs, then it starts with a reset mock implementation.

## Non-goals

- Prompting users for a token.
- Interpreting token ownership, authorization, or GitHub-specific token formats locally.
