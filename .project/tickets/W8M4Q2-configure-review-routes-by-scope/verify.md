# Verification

## Verify Checklist

**Focused tests:** 96/96 pass after final reviewer edits.
**Full suite:** 541/542 files and 8,851 tests passed; one unrelated contention-sensitive durable-job test failed because its fixture review id was `undefined`, then passed 1/1 in isolation.
**Lifecycle contract:** 12/12 pass with regenerated origin-main fixtures.
**BDD proof:** 40/40 provenance tests pass; both affected features are in the Vitest proof lane without raising fan-in ratchets.
**Build:** success.
**Lint:** clean, including Gherkin.
**Typecheck:** clean.
**Refactor:** no additional source refactor warranted after the shared parser/persistence/policy boundary review.
**PR scope:** matches the scoped model-ranking goal and repairs the pre-existing ranked-route BDD lane included on this branch.

Audit passed for W8M4Q2: scoped architecture, documentation, dependency, configuration, and test-quality checks found no new blocking issue; previously reported principle findings belong to older tickets outside this slice.

## End-user walkthrough

Using an isolated temporary XDG profile and project, the real CLI successfully:

1. set `claude` routes to `opencode=vendor/model-b`, then `codex`, reporting a created user-profile file;
2. listed the same ordered routes with `source: user` and cross-agent provenance;
3. reset only the selected author, reporting the profile update; and
4. listed the restored built-in `codex → opencode → claude` chain with the same-author route degraded.

## Independent review

- Review `2c0fb2ac-011f-474d-ae76-e0c614d1681c`: approved by independent Claude/Opus; model-aware built-in listing, strict-scope documentation, malformed reset behavior, and effect reporting findings applied.
- Review `6acb9050-531e-425c-9f6e-3daaa3d43adc`: approved by independent Claude/Opus; typed malformed-config envelopes, same-author replacement proof, persisted-output fidelity, and architecture freshness findings applied.
- Review `217b97de-aa97-49a4-86a8-98d364abd602`: approved by independent Claude/Opus on the CI-corrected head; declared status network effects, path-preserving diagnostics, retryable write failures, forward-compatible author keys, and duplicate degraded-run findings applied.

## Dispositions

- Kept the default set/reset scope at `user` because the command family exists specifically to manage personal ranking; project overrides remain explicit with `--scope project` and every result identifies its scope/path effect.
- Kept shadowed-scope inspection as a follow-up rather than expanding `list` into a multi-scope diagnostic surface; the current command truthfully reports the effective source and does not merge lists.
- Kept the existing durable-write module location because multiple review, OpenCode, Claude, utility, and Codex modules already share it; relocating that cross-cutting primitive is repository-wide architecture work, not this focused feature.

## Post-main integration review (2026-09-02)

The historical review and CI references above describe earlier heads. PR #3617 carries the final exact-head readiness receipt.

- Merged the authentication-recovery changes and the v0.83.1 release from main; regenerated both host bundles and lifecycle fixtures.
- Applied review findings for ranked authentication recovery, canceled-job effect reporting, safe worker PID ownership, user-profile execution, malformed-config diagnostics, and user/project precedence.
- The focused public-CLI, route configuration, preferences, and machine-contract run passed 133/133 tests. Release lifecycle regeneration passed 12/12. The final parser-diagnostic and route-command run passed 18/18.
- Public-CLI proof now exercises user-only execution and project replacement with both scopes populated, author-independent resolution, malformed shadowed user configuration, unrelated project-setting preservation, and terminal-safe blocked-review recovery.
- Repeated the end-user walkthrough with the regenerated CLI in an isolated profile: set `claude=opus → opencode` for Codex-authored work, list user routes, set and list a project-only `opencode` override, reset the project override, and confirm the original user list reappears. All six commands succeeded; the real user profile was untouched.
- Authentication remains a stop condition even after a degraded result: existing feedback is preserved, but the independent login recovery contract is not weakened.
- Deferred non-blocking presentation suggestions: the legacy built-in listing does not enumerate its conditional runtime-default retry; route failure prose could distinguish unattempted routes more explicitly. Structured route evidence remains authoritative.
