# User stories: accept and redact stateless GitHub installation tokens

Issue: [#1495](https://github.com/ArcadeAI/safeword/issues/1495)

## Story 1: use valid installation credentials

As a safeword user running retro with a GitHub App installation token, I want
both classic opaque and stateless JWT-like `ghs_` credentials to be recognized,
so filing continues during GitHub's staged token-format rollout.

### Acceptance criteria

- Given a classic opaque `ghs_` token, when retro resolves `GITHUB_TOKEN`, then
  it selects that value without consulting the `gh` fallback.
- Given a stateless JWT-like `ghs_` token, when retro resolves `GITHUB_TOKEN`,
  then it selects that value without consulting the `gh` fallback.
- Given a non-credential placeholder or a value with valid-looking token text
  embedded inside other text, when retro resolves `GITHUB_TOKEN`, then it rejects
  the whole value and falls back to `gh`.

## Story 2: prevent stateless credentials from leaving the egress boundary

As a safeword user, I want stateless `ghs_` tokens fully redacted from prose, so
no header, payload, signature, or allowed-character tail can reach a public
issue.

### Acceptance criteria

- The full stateless token rule runs before the classic `ghs_` rule.
- The classic-only rule leaves the known partial leak, deleting it leaves the
  whole stateless token, stateless-before-classic fully redacts it, and
  stateless-after-classic retains the partial leak.
- Stateless fixtures ending in `-` and `_` are fully redacted without residue.
- Classic GitHub tokens remain fully redacted.

## Out of scope

- Live GitHub authentication with forced `enabled` and `disabled` rollout
  headers is release evidence and cannot be proven by offline unit tests.
- Changing the REST transport architecture tracked by #1479.
