---
id: S2CWBE
slug: codex-desktop-session-proof-fallback
type: task
phase: implement
status: in_progress
scope:
  - Restore current-session proof recording in Codex Desktop code-mode when its PreToolUse cache bridge did not arm.
  - Use the runtime-provided CODEX_THREAD_ID only as a Codex session-identity fallback after explicit and fresh bridged identities are unavailable.
  - Keep Codex Stop able to resolve the same session binding when its payload omits session_id.
out_of_scope:
  - Changing the Codex PreToolUse matcher, weakening the done gate, or treating turn_id as a durable session identity.
  - Inventing a fixed session id, accepting CODEX_THREAD_ID for Claude or Cursor, or changing existing cache expiry and ordering semantics.
  - Repairing the Codex Desktop hook dispatcher; its missing bridge delivery remains an upstream runtime observation.
done_when:
  - Codex Desktop proof helpers log CODEX_THREAD_ID only when explicit and fresh bridge identities are absent.
  - A fresh Codex bridge identity remains authoritative over CODEX_THREAD_ID.
  - Codex Stop resolves the same thread identity when a Stop payload lacks session_id.
  - Template and dogfood hook copies remain synchronized, with focused behavioral regression evidence.
created: 2026-07-24T23:01:29.838Z
last_modified: 2026-07-25T00:12:00Z
---

# Keep Codex Desktop proof session-bound

**Goal:** Let Codex Desktop record quality proof when its PreToolUse cache bridge is unavailable.

**Why:** Desktop code-mode exposes CODEX_THREAD_ID while the documented cache bridge does not arm, leaving verified work without session-scoped proof.

## User Story

See [user-stories.md](./user-stories.md) for the user-visible behavior and acceptance criteria.

## Test Definitions

See [test-definitions.md](./test-definitions.md) for the RED/GREEN/REFACTOR ledger.

## Figure-It-Out Decision

**Frame:** Bind Safeword feature-skill proof in Codex Desktop code-mode when the
documented PreToolUse cache bridge does not arm.

**Decision:** Keep the cache bridge as the preferred path. After explicit
arguments, Claude identity, and fresh Codex/Cursor bridge entries have all
failed, let the shared run-identity resolver use a non-empty
`CODEX_THREAD_ID` as a Codex session key. It must never use `turn_id` as the
fallback, and callers that explicitly select Claude or Cursor keep their own
identity rules.

**Why:** The live Desktop environment exposes `CODEX_THREAD_ID`, and Safeword
already treats it as session-stable for Codex retro state. The fallback restores
proof and session-bound Stop behavior without pretending the cache bridge
delivered an identity.

## Work Log

- 2026-07-24T23:01:29.838Z Started: Created ticket S2CWBE
- 2026-07-24T23:02:31Z Revalidated: the earlier Codex bridge ticket covers the documented hook-to-helper cache path, but this Desktop code-mode run produces no cache while exposing CODEX_THREAD_ID. The missing bridge delivery is still relevant.
- 2026-07-24T23:02:31Z Scoped: selected a cache-last CODEX_THREAD_ID fallback, constrained to the Codex runtime and the shared resolver so recorder, review stamp, and Codex Stop agree on one session key.
- 2026-07-24T23:07:21Z RED: focused resolver, real invocation-helper, review-stamp, and Codex Stop tests failed as expected. Each currently sees no durable identity when only CODEX_THREAD_ID is available; Stop leaves the bound ticket in progress.
- 2026-07-24T23:20:22Z RED: quality review found review-stamp let CODEX_THREAD_ID override a fresh Codex bridge cache identity.
- 2026-07-24T23:20:49Z GREEN: made the bridge authoritative over the environment fallback while retaining Claude's direct identity precedence; the two Codex Desktop review-stamp regressions pass.
- 2026-07-24T23:25:00Z Validated: focused resolver, proof-helper, review-stamp, and Stop tests pass; lint, typecheck, build, parity, and diff checks pass. Fresh quality review approved the corrected precedence.
- 2026-07-25T00:12:00Z REFACTOR evidence: the full existing ordered proof-bridge cache suites pass (28 invocation-helper and 34 review-stamp bridge tests), covering expiry, ordering, foreign paths, and missing identity. The complete S2CWBE ledger is now green.
