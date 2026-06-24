# Verify: M1FGRJ sync-tracker v2 graph projection

## Result

Implemented and verified the unit-testable graph projection slice. Ticket remains
`in_progress` until the maintainer confirms it should be marked done.

## Evidence

- `bun run --cwd packages/cli vitest run tests/tracker-sync` — 13 files / 85
  tests passed.
- `bun run --cwd packages/cli vitest run tests/tracker-sync tests/integration/codex-pretooluse-spike.test.ts`
  — 14 files / 90 tests passed.
- `bun run --cwd packages/cli typecheck` — passed.
- `bunx eslint ...tracker-sync... ...codex...` — passed.
- `bunx markdownlint-cli2 .project/tickets/M1FGRJ-tracker-relations-projection/*.md .project/tickets/CXP9LM-codex-live-parity-smoke/*.md`
  — 0 errors.

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
