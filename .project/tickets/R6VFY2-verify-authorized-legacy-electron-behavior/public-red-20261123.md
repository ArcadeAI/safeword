# Installed public observation RED

Before production changes, the supported installed 1.2.0 runtime was invoked
against Soulless commit 07307ac825d1725754d43d9af5fd4175b12609a3 and the committed
mixed-case request at
`.project/tickets/SGWMBS-open-save-soul-electron/retrospective-proof/cased-suffix.request.json`.

The selected spec exists at its declared line, every declared support file exists,
and the behavior-removal anchor occurs exactly once. The requested assertion is
the existing package-metadata equality check, not a setup operation. Its proposed
failure text is an authored expectation; it has not been observed or approved.

```sh
bun /Users/alex/.codex/plugins/cache/safeword/safeword/1.2.0/runtime/cli.js \
  --cwd /Users/alex/.codex/worktrees/cc7f/soulless-monorepo \
  review observe retrospective \
  --request .project/tickets/SGWMBS-open-save-soul-electron/retrospective-proof/cased-suffix.request.json \
  --json
```

Actual result: exit 1; `ok: false`, `state: failed`, error code
`CLI_ARGUMENT_INVALID`, message `error: unknown command 'observe'`.
Raw result: `/tmp/issue163-safeword-public-red.json`.

Retained raw stdout:

```json
{"schema_version":1,"ok":false,"state":"failed","changed":false,"findings":[],"effects":{"files":[],"packages":[],"configuration":[],"network":[],"destructive":[]},"errors":[{"code":"CLI_ARGUMENT_INVALID","message":"error: unknown command 'observe'","retryable":false}],"recovery":[],"next_actions":[]}
```

Fixture checks used Python `Path.is_file()` for the six declared support files,
`source.count(request['mutation']['before'])` for the unique anchor, and the
one-based `testLine` to read the existing test declaration. Observed count: 1;
missing support files: none. SHA-256 identities of the committed bytes:

- Request: `0f88eebc631ae944bdebdc633aeb76ec0f9482547074a0af21d2a0cc92bfebd0`.
- Selected test: `47dc28ed3a6e2c0f37b29f546628d8f4ee01383c62bff02065aedbe1535cf1b4`.
- Implementation: `8055b6bd8ae81e5c27ffc8d5bb65e22539c19f6c97eff7dddb52ddf376d7da72`.

This is the expected outside-in failure for the absent public capability. No
original/mutant execution, independent proof approval, VERIFIED credit or scenario
GREEN is claimed. The 40 existing legacy retrospective tests passed before any
production change (`/tmp/issue163-safeword-legacy-baseline-tests.log`).

## Planning provenance

Real authenticated reviews approved intake, all 21 scenarios, the implementation
design and the execution sequence. Implementation and execution approval IDs are
`0cee16dc-0e28-49ef-b1ef-501255a5b50d` and
`8ed348bf-29a9-4a8c-bd6b-48e038f7c9ad`. The supported `ticket approve-plan`
command reported human approval not required; coding authorization passed before
entering implementation.

The ticket's first Git commit was made after those real planning transitions, so
the commit-boundary observer correctly warned that its first committed phase was
implement. There were no skipped planning phases; they occurred while the new
files were untracked. No earlier phase commits are invented. A markdown heading
fix then invalidated the optional ledger target in scenario review. The canonical
feature alone is being reviewed afresh so later progress in the test ledger does
not substitute for or continually invalidate the accepted behavior source.
