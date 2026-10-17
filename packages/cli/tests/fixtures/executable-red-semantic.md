# Executable RED semantic checks

The default CI suite runs `tests/review/executable-red-semantic-fixtures.test.ts`.
It executes five real Cucumber fixtures and verifies their step statuses and
whether the actor ran. The Then error details distinguish actor output from an
unrelated assertion. It also calibrates the deterministic verdict scorer
against always-approve, always-reject, missing-verdict, wrong-reviewer,
non-independent, wrong-status and wrong-gate observations. It makes no model calls.

Run the opt-in model lane from the repository root:

```sh
SAFEWORD_RUN_EXECUTABLE_RED_LIVE=1 \
  SAFEWORD_EXECUTABLE_RED_LIVE_REVIEWER=claude \
  SAFEWORD_EXECUTABLE_RED_RESULTS_PATH=/tmp/red-semantic-fresh.json \
  scripts/dev bun run --cwd packages/cli test --config vitest.live.config.ts \
  tests/smoke/executable-red.live.test.ts --maxWorkers=1
```

Use a fresh absolute result path. The assigned reviewer must be `claude` or
`codex`, installed and signed in on this host. Optional
`SAFEWORD_EXECUTABLE_RED_LIVE_MODEL` selects its model; otherwise the route uses
its runtime default. The live config restores the real reviewer profile paths
while ordinary tests keep their isolated profiles.

The lane invokes the public CLI, executes Cucumber, polls authenticated review
status, and checks the GREEN gate. One intended actor assertion must receive an
independent approval. Undefined steps, pending steps, setup failure, and an
unrelated assertion must each receive an independent rejection. A gate denial
alone cannot satisfy a rejection case. All five observations must pass. Each
case uses a fresh fixture and review ID. The coordinator may attempt configured
routes before returning its final result; these attempts are not counted as
additional observations or statistically independent samples.

Expect five paid reviewer calls, bounded by the configured review budget
(normally two minutes each). This lane is a pre-merge check for executable-RED
prompt changes and a manual regression check, not part of default CI. Review
maintainers own failures: inspect fixture statuses, attestation, actual reviewer,
verdict and gate before changing the prompt or scorer. Never weaken a scorer to
hide a wrong verdict. Results retain the actual outputs; fixture directories are
removed and pending reviews are cancelled during cleanup. The evidence records public review/gate JSON responses; the harness does not
copy credential stores or review-integrity key files.

This small synthetic set is regression evidence, not provider qualification,
installed-host/cloud parity, or reconstruction of missing historical RED.
