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
