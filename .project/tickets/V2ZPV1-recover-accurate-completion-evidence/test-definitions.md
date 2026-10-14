# Completion-evidence recovery proof

This task's new proof is separate from the unchanged 5F5ZZA historical ledger.
The observer, authenticated-correction, certification and host-closing tests
remain open. Completed refusal and parser checks do not grant completion credit.

## Observer boundary invocation

The opt-in Cucumber configuration proves the observer itself through the real
public CLI, including its signed 142-case report and refusal to close without
independent certification. It is separate from the inner observed lane's root
`cucumber.mjs`. Build the final committed CLI first, then run from the root:

```bash
NODE_OPTIONS='--import tsx' scripts/dev node node_modules/.bin/cucumber-js --config features/recovery-observation.cucumber.mjs
```

This invokes the expensive observation once; the wrapper checks that same actual
record. It grants no credit for a failed run or caller-authored report.

## Scenarios

### Scenario: Recovery refuses authority for another ticket

Given a project without any approved recovery evidence,
when the public CLI evaluates recovery for OTHER1,
then it returns the exact LEDGER_RECOVERY_SCOPE_MISMATCH finding and changes nothing.
An unknown-command failure is not the required refusal.

- [x] RED 7c1b18385
- [x] GREEN e24cdfe13
- [x] REFACTOR 34958df6b

The remaining rows implement the already-reviewed plan; none is completed by
the scope refusal above. Current certification never records historical RED.

### Scenario: Recovery refuses rewritten historical proof

Given the exact pinned original ledger, the gate still requires authenticated current proof.
After a checked historical RED row is unchecked, the public gate reports
LEDGER_RECOVERY_HISTORY_CHANGED and preserves the supplied bytes.

- [x] RED 4ca627324
- [x] GREEN 61994536f
- [x] REFACTOR skip: the fixed profile and direct gate check need no structural change

### Scenario: Recovery preserves the exact original history

Given the pinned 5F5ZZA ledger and authenticated current certification,
when the contributor checks completion through the public recovery gate,
then the original checked history remains unchanged while the report names the
single authorized REFACTOR erratum as a separate correction.

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Recovery refuses inherited scope changes

Given the exact pinned ledger and feature, current proof remains required.
Changing an inherited rule tag without changing the number of cases produces
LEDGER_RECOVERY_SCOPE_CHANGED and does not rewrite the feature.

- [x] RED e1668c35b
- [x] GREEN 89fda7fbf
- [x] REFACTOR skip: scope and history checks share the existing fixed profile

### Scenario: Recovery summarizes only the exact passing active report

Synthetic parser controls exercise the exact 142 case identities and their assertions.
A same-count deferred substitution, duplicate, skipped step, failed hidden hook,
missing assertion or failed process cannot produce a summary. A summary is not
authenticated observation, certification or actor-facing acceptance proof.

- [x] RED 82584dbe2
- [x] GREEN c1df9c691
- [x] REFACTOR d552f52af

### Scenario: Recovery requires the exact active case set

Given an otherwise valid signed observation with one active Examples row
replaced by a deferred row without changing the total count,
when the contributor checks completion through the public recovery gate,
then that case-set mismatch prevents completion credit.
The matching 142-case observation is the positive control.

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Recovery observation refuses another ticket or missing baseline

The public observer refuses OTHER1 with the exact scope finding.
For 5F5ZZA without the pinned Git ancestry it returns
LEDGER_RECOVERY_BASELINE_REQUIRED and leaves the project unchanged.

- [x] RED a23a21e8f
- [x] GREEN 31dbcd9ff
- [x] REFACTOR skip: reuse the existing external proof-tool resolver

### Scenario: Recovery observes the committed candidate itself

Given a clean candidate descended from the pinned baseline,
when the contributor requests observation through the fixed public CLI command,
then the retained signed record binds the actual process result, complete report
and producing product tree. Caller reports, failed runs and dirty execution
inputs cannot produce a passing observation.

- [x] RED 152b9adea
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Recovery observations use their own authenticated protocol

A genuine recovery tag validates only unchanged observation bytes for the same
root and installed profile. CKWE2D tags cannot authorize recovery, and recovery
tags cannot authorize CKWE2D. Wrong kind, ticket or profile cannot be signed;
verification of an unauthenticated record cannot create an integrity key.
Changing only the profile-owned key invalidates a genuine tag, and restoring
the original key validates it again; an unkeyed checksum cannot pass this control.

- [x] RED 2e690eaf9
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Recovery requires typed case-bound certification metadata

The dedicated review contract accepts actual empty findings. Approval requires
the installed profile, distinct active cases and all six confirmations. Ordinary
approval, wrong profiles, duplicate or deferred cases and missing or false
approval confirmations are refused. These parser controls grant no job authority.

- [x] RED a008c55f9
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Recovery reads only authenticated independent receipt provenance

Given a signed review job with current target/context fingerprints and valid
case-bound certification metadata, the internal reader returns its authenticated
targets, context and certification. Wrong kind, same-agent, contradictory verdict,
unsupported author, wrong profile, false confirmation, stale context and unsigned
records return no receipt. This pure contract does not grant completion credit;
the public gate still requires the matching passing observation and all targets.

- [x] RED daa750959
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Recovery requires independent current certification

Given a passing authenticated observation but an ordinary quality-review,
same-agent, stale or wrong-profile receipt,
when the contributor checks completion through the public recovery gate,
then the supplied receipt cannot grant current certification.
A fresh cross-agent recovery receipt with every required confirmation is the
positive control; missing or false confirmations remain rejected.

- [x] RED daa750959
- [ ] GREEN
- [ ] REFACTOR

Review 18560ec0 rejected daa750959 as proof of this public-boundary scenario:
it tests only the internal receipt reader. The actual public gate proof remains
required; this failed review grants no GREEN authority.

### Scenario: Recovery survives only the named audit changes

Given a certified producing tree,
when the contributor commits only the named audit artifacts and checks closing,
then the certification remains current. A product change, execution-input
change or accepted-scope change makes that same certification unusable.

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Supported closing boundaries retain honest evidence

Given authenticated current recovery and the normal closing prerequisites,
when local Claude, Codex or Cursor evaluates 5F5ZZA completion,
then current active evidence is credited without changing historical checkboxes
or crediting any of the 33 unverified deferred cases. Removing that authority
restores the ordinary rejection. OpenCode cannot receive the recovery view.

- [x] RED 290f1453a
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Recovery credits only authenticated proof through the public CLI

Given a matching signed observation and an independent case-bound certification,
when the contributor checks the public CLI recovery gate,
then the gate credits all 142 active cases and displays all 33 deferred cases as
unverified without modifying the historical ledger. Report tampering, deferred
credit, invalid authentication, a signed failed run and an unsigned receipt are
each rejected; restoring the valid evidence restores approval. This is simulated
host boundary proof, not current live acceptance evidence.

- [x] RED 14e01c20a
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Recovery exposes honest views through the completion composite

Given simulated passing dependency and test prerequisites, a valid in-scope
verify artifact and authenticated current certification, the shared completion
composite credits only supported local hosts and displays all 33 cases as
deferred-unverified. Missing receipts, unknown hosts and OpenCode remain blocked.
The public gate exposes a historical validation view that corrects only the
exact approved REFACTOR annotation and enumerates every missing historical row;
the original ledger bytes remain unchanged. This component proof does not claim
that native hook adapters have already been wired or exercised.

- [x] RED 02bf86d09
- [ ] GREEN
- [ ] REFACTOR

The earlier supported-boundary RED 290f1453a was rejected because it called only
the internal scenario helper. Native Stop and closing-edit coverage remains
required independently; no approval or GREEN credit is inferred from that RED.

### Scenario: Recovery reaches the actual local hook adapters

Given an actual frozen dependency install, an explicitly simulated passing test
plan, an in-scope verify artifact and signed fixture certification, the real
Cursor closing-edit, Codex Stop and Claude Stop source entrypoints admit current
active proof. Removing certification denies each boundary; OpenCode's actual
pre-tool dispatcher remains denied. The original historical ledger is unchanged.
This simulated-host wiring proof is not installed-host qualification or actual
current acceptance, both of which remain separately required.

- [x] RED bfd814971
- [ ] GREEN
- [ ] REFACTOR

## Feature-level cross-scenario refactor

- [ ] cross-scenario
