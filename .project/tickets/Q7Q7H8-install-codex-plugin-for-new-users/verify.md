# Verify: Q7Q7H8 install-codex-plugin-for-new-users

**PR Scope:** Add explicit profile-scoped Codex plugin installation for new
users, retain explicit legacy-hook cleanup and the legacy compatibility route,
and update the corresponding guidance and coverage.

## Verify Checklist

**Test Suite:** PASS - full Vitest suite: 353 files, 5225 passed, 5 intentional skips.
**BDD:** PASS - full BDD lane: 92 scenarios, 1096 steps.
**Focused regression:** PASS - Codex migration, setup, and upgrade command coverage: 49 tests.
**Lint and typecheck:** PASS - repository lint and TypeScript checks.
**Behavioral coverage:** PASS - fresh setup and upgrade guidance, profile-only installation, failed-install non-mutation, explicit legacy cleanup, confirmation refusal, and legacy-command compatibility.

## Notes

- Installation remains a profile-scoped, explicit `safeword codex install`
  action; setup and upgrade only give the user that next step.
- `safeword codex migrate --remove-legacy-hooks` changes only Safe Word hook
  registrations and preserves unrelated project configuration.
- `safeword migrate codex-plugin` remains available for existing scripts.
