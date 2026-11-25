# Native Codex bounded continuation characterization

Observed against the regenerated native compatibility container after merging
current main. No production policy changed to produce this result, and no
missing-behavior RED is claimed: the current behavior already passes.

Run:

```sh
SAFEWORD_CODEX_GUARD_FIXTURE=/tmp/safeword-2enrh5-targets.aOFAud/codex-guard-KbebbV/fixture.json \
scripts/dev bun packages/cli/scripts/run-host-contract-proof.ts \
  --proof native-codex-continuation --require-targets
```

The profile selects the actual Codex 0.160.0 completion example from
features/consistent-host-contract.feature. One scenario / four steps passed in
13.152 seconds on the final scaffold. Report:
`/var/folders/v4/1hqkg6ln4nd71j_bjw3_xxb00000gn/T/safeword-host-contract-proof-eoyeha/cucumber.json`.
Native observations and CLI streams:
`/tmp/safeword-2enrh5-targets.aOFAud/codex-guard-KbebbV/codex-unfinished-ticket-stop-gnyzM0/`.

Given uses the exact native CLI and actual installed generated package. It
checks complete package byte equality, then observes one quiet setup Stop.
Before the trial, the fixture binds a synthetic done-phase/in-progress task
without verify.md to that observed session. The When resumes that session once
with a request to finish; the driver never manually resubmits after it.

A transparent Bun process observer records actual native Stop input and the
generated runtime's output, forwarding arguments, input, output and exit status.
It supplies no permission or continuation decision and modifies no hook manifest
or trust record. The first trial Stop has stop_hook_active=false and returns
decision:block with the missing verify.md reason. The next has the same session
and project, stop_hook_active=true, and returns {}. The real CLI emits two
assistant messages, the second reports the missing verification requirement, and completes without another
automatic iteration. The task stays in_progress; no verify.md is manufactured.
The installed package still matches its source after the trial.

This is diagnostic characterization, not sealed admission, current customer
activation, unlimited completion enforcement or the whole completion outline.
The component runner deliberately returns incomplete (3) even when its scenario
passes, until the native-codex group has all required obligations. Missing setup
must remain unavailable (3); only an observed final-boundary missing continuation
or exceeded bound can be an intended product failure (2). All scenario-ledger
checkboxes remain unchecked. A timeout remains unavailable rather than proving
every possible unbounded-continuation failure.

Verification on 2026-10-21:

- Focused classifier and existing Cursor CLI regression checks: 38/38 pass,
  `/tmp/safeword-codex-continuation-controls-green.log`.
- Actual native Codex allowed-write, denied-write and bounded-continuation:
  3/3 pass in 32.88 seconds, `/tmp/safeword-codex-continuation-live-final.log`.
- Package typecheck and targeted ESLint pass. The shared Cucumber step is outside
  the ESLint project; the actual scenario executes that wiring successfully.
- Earlier trials exposed over-specific text matching: a literal filename,
  Markdown backticks and auxiliary verbs. The classifier now normalizes formatting
  and supports the recorded missing-evidence forms. Negative controls reject
  completed verification, unrelated failures and negated missing-evidence claims.
  These are harness repairs, not production behavior REDs.
- Review f2e73d93-05d3-4286-8e1f-ccdce01e3225 approved the scaffold (Claude/opus,
  cross-agent). Its suggested assistant-message-count classification and explicit
  unsupported-host rejection were applied. A subsequent receipt became stale
  during the classifier fix; a current final review is pending.

Temporary evidence paths are local diagnostics and may disappear on cleanup.
The committed runner and negative controls are the reproducible deliverable;
these observations are not sealed package-conformance evidence.
