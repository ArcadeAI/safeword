# Cursor IDE completion proof

This is the next PR 1 proof, not a change in accepted behavior. The actual
completion outline in `features/consistent-host-contract.feature` owns the
Cursor 3.24.18 example. All outline completion boxes remain unchecked.

The isolated probe reuses the native plugin discovery/guard fixture through
`CursorNativePluginActor`; the existing write actor keeps its assertions.
Test observers only record host input. The generated native package supplies
every policy decision; no project Stop hook returns a follow-up.

Given establishes the exact signed IDE, generated plugin registration, a real
setup conversation, and its actual native Stop dispatch with loop count zero.
That setup turn must not have consumed any continuation. The synthetic task is
in verification with no verify.md. Its session state is bound to the observed
conversation before the When; it is not patched during the trial.

When submits one request to finish that same conversation. The actor never
resubmits it. It records actual native Stop input/output and the owned window.
Then requires the production package's verify.md follow-up, a subsequent
completed Stop with loop count one in that conversation/version, and the unmet
verification requirement in an actual assistant response and visible UI.
Model prose alone, a fabricated hook payload, foreign conversation, failing
script, or ticket-write denial cannot pass this proof.

The diagnostic component command is:

```sh
SAFEWORD_CURSOR_TEST_CONFIG=/tmp/safeword-2enrh5-targets.aOFAud/cursor-pinned-fixture.json \
scripts/dev bun packages/cli/scripts/run-host-contract-proof.ts \
  --proof native-cursor-continuation --require-targets
```

It returns 2 only when all setup/action steps pass and the final assertion
fails with HOST_CONTINUATION_MISSING. Setup failure is unavailable (3).
A passing component is still incomplete (3) until the full native-cursor group
is assembled. This diagnostic command cannot admit a package.

On 2026-10-21 the regular application had advanced to 3.26.13. Restored the exact
3.24.18 signed build in `/tmp/safeword-2enrh5-targets.aOFAud/Cursor-3.24.18.app`
from Cursor's distribution server, leaving the regular application intact.
Disabled updates only in the pre-existing isolated test profile.

First execution was unavailable at Given: macOS refused to activate the owned
test process. The operating-system session reports CGSSessionScreenIsLocked=true.
Report: `/var/folders/v4/1hqkg6ln4nd71j_bjw3_xxb00000gn/T/safeword-host-contract-proof-6Uh4nT/cucumber.json`.
No production completion integration or passing live result is claimed.
Observer regressions: two files, fourteen tests passed. Typecheck, targeted
ESLint and formatting passed. Independent quality review
`bf303c06-7e14-4ead-991b-180027b868c4` could not run because Claude requires
renewed authentication; the prescribed browser sign-in is awaiting the user.
This is unreviewed scaffolding, not approved live evidence.
