# Native Codex required diagnostic group

The PR 1 Codex boundary now runs every applicable Codex row from the accepted
feature, using the same case compiler as Cursor. The compiler owns selection,
not a second contributor-supplied list. Stable ID aliases preserve existing
diagnostic identities; new scenario names derive new IDs automatically.

The existing allowed/denied native-write test was extracted into one actor,
preserving native hook trust discovery, package byte checks, exact CLI version,
real tool-result assertions and filesystem outcomes. Both the live test and
the Cucumber source rows call it. Its post-extraction live run passed 3/3 in
33.20 seconds, including the unchanged continuation actor.

The new Codex catalogue actor uses the same canonical probe as both Cursor
actors. It installs the production-generated resource carrier with the actual
native marketplace into a new disposable profile. It reuses only the previously
provisioned test profile's auth and never changes the regular Codex profile.
The actual installed workflow reads its guide and invokes its bundled runtime;
native command output, a fresh helper artifact, package origin and unchanged
package bytes establish the result. A helper self-check precedes the trial and
its artifact is removed before the native turn.

Run:

```sh
SAFEWORD_CODEX_GUARD_FIXTURE=/tmp/safeword-2enrh5-targets.aOFAud/codex-guard-KbebbV/fixture.json \
SAFEWORD_CODEX_TEST_CONFIG=/tmp/safeword-2enrh5-targets.aOFAud/codex-portable-config.json \
scripts/dev bun packages/cli/scripts/run-host-contract-proof.ts --proof native-codex --require-targets
```

Observed 2026-10-21 after strengthening the helper binding: **5 scenarios / 19
steps passed**, 66.413 seconds, exit 0.
Report:
`/var/folders/v4/1hqkg6ln4nd71j_bjw3_xxb00000gn/T/safeword-host-contract-proof-rcKWuE/cucumber.json`.
Completed IDs: denied-write, allowed-write, bounded-continuation,
catalogue-helper and portable-components, each prefixed `codex-0.160.0-`.
The runner checks exact source rows, step counts and complete population before
writing diagnostic-only completed-cases.json with admission_eligible=false.
This supersedes earlier notes that native-codex exercises only portable loading.

Focused coverage/classification and Cursor CLI controls pass **48/48**. They
check unknown capability discovery, version/runtime separation, host-only
portable rows, empty/duplicate population rejection, the actual required Codex
population, existing continuation classification and rejection of broken declared
runtime links/commands. No new production policy
or missing-behavior RED is claimed.

These are resource/transport diagnostic fixtures. Synthetic catalogue markers
are not proof that every shipped workflow is present, and completing this
group does not grant customer activation, sealed conformance, lifecycle parity
or whole-ticket acceptance. The accepted PR 3 inventory and PR 4 evidence gates
retain those obligations. All acceptance-ledger boxes remain unchecked.
Local temporary artifacts may disappear; committed actors and runner are the
repeatable deliverable. Typecheck and targeted lint pass.

Review 455f9a23-a8d0-4fc0-9a51-6d0ef7c25479 requested a discriminating check
against an agent improvising around a broken workflow command. The actor now
resolves the workflow's declared relative runtime and recognizes only its
canonical helper grammar, sharing the recognizer with Cursor. Native calls
outside that observable grammar are unavailable rather than a fabricated RED.
An initial stricter run rejected a legitimate command-substitution spelling;
the fixture prompt now requests literal assignments solely for observation.
The final actual-native run above passes that stricter protocol.

Review 8d62cc34-2617-4a20-949f-f1d26d901098 approved the updated code
(Claude/opus, cross-agent), with no blocking errors. Remaining warnings concern
conservative path/early-runner failure classification, operator-supplied fixture
validation, copied test authentication and reliance on this pinned host's
default plugin enablement. They remain diagnostic limits; no regular profile,
trust bypass, customer activation or sealed receipt is introduced.
