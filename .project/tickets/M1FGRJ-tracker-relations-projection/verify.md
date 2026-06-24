# Verify: M1FGRJ sync-tracker v2 graph projection

## Result

Implemented and verified the unit-testable graph projection slice. Ticket remains
`in_progress` until the maintainer confirms it should be marked done.

## Evidence

- `bun run --cwd packages/cli vitest run tests/tracker-sync` — 13 files / 85
  tests passed.
- `bun run --cwd packages/cli typecheck` — passed.
- `bunx eslint packages/cli/src/tracker-sync/*.ts packages/cli/tests/tracker-sync/*.test.ts`
  — passed.
- `bunx markdownlint-cli2 .project/tickets/M1FGRJ-tracker-relations-projection/*.md .safeword/logs/ticket-M1FGRJ-tracker-relations-projection.md`
  — 0 errors.
- `bun packages/cli/src/cli.ts architecture --check` — passed.
- `bun run --cwd packages/cli test:release` — 4 files / 7 tests passed.
- `git diff --check` — passed.

## Coverage

- Parent/dependency ordering: child tickets no longer create before known parent
  or dependency tickets.
- Native hierarchy: resolved `parent:` / `epic:` refs become parent refs in the
  graph writer request; unresolved refs fall back to labels.
- Native relations: `depends_on:` and `blocked_on:` targets with sidecar refs
  become blocked-by refs; dangling refs are skipped.
- Native type: payloads include `issueType` while preserving `type:<type>` label
  fallback.
- Idempotence: create, update, and pending-entry reconcile paths all replay graph
  projection against the same sidecar refs without duplicate creates.
- GitHub adapter: mocked `gh issue edit` arguments cover `--type`, `--parent`,
  and `--add-blocked-by`, including retry without `--type` when issue types are
  unavailable.

## Remaining Scope Notes

- No live tracker run was performed; M1FGRJ explicitly calls for mocked clients
  and no live tracker.
- GitHub Projects v2 Status-field ownership remains deferred because v1 ceded
  tracker status except close-on-terminal.
