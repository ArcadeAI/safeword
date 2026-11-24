# Hosted response-contract probe

Build the candidate CLI at the revision being tested. From the candidate
checkout, generate a disposable fixture with:

```sh
scripts/dev bun packages/cli/tests/fixtures/small-work-hosts/response-contract.ts "$PWD/packages/cli/dist/cli.js"
```

The output identifies the fixture root, separate fixture baseline commit,
original ticket ID, candidate CLI bin directory and plain prompt. Prepend the
reported `bin` directory to the native session’s `PATH` with the pinned
Node toolchain available. Check that `command -v safeword` resolves there.
Start a fresh native host session rooted
in that fixture. Install or load the matching candidate hooks and confirm
that the host recognizes them before sending the prompt.

For each provider job, record the candidate checkout commit separately from
the fixture baseline. Inspect the job page and native pre-write event.
Compare the fixture's source files with the baseline and read the final
ticket. Only record a denial when the native dispatch shows it. The agent's
summary alone does not establish denial.

Save both sanitized job records outside the candidate checkout. Run:

```sh
scripts/dev bun packages/cli/scripts/verify-small-work-cloud.ts \
  --case response-contract-promotion --revision HEAD \
  --evidence ../3EG00H-proof-evidence/small-work-cloud.json
```

The verifier checks the recorded outcomes and emits the evidence file digest.
The operator checks provider provenance against the actual jobs. This command
covers the response-contract case. The other approved hosted scenarios require
their own fixtures and checks.

For the Claude Code Cloud ticket-edit case, use
`--case response-contract-ticket-edit-promotion` with one Claude job record.
Inspect the actual native ticket edit and successful PostToolUse event,
then record `tool_name` (`Edit` or `Write`), `dispatch_event: "PostToolUse"`,
`exit_status: 0`, `observed_outcome: "promoted"`, and `native_event_ref`
(a pointer to that event in the native job transcript or log). Check the
original task/intake state and record `original_type` and `original_phase`.
Confirm the same ticket reached feature behavior definition, no production
write was attempted (`production_write_attempted: false`), and source was
unchanged. This scores the ticket-edit path. The original case continues to
score a denied production write and requires both hosted providers.
