# Completion-evidence recovery proof

This task's new proof is separate from the unchanged 5F5ZZA historical ledger.
The remaining observer, exact-case, authenticated-correction and host-closing
tests are not implemented or certified by this first loop.

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

### Scenario: Recovery requires the exact active case set

Given an otherwise valid signed observation with one active Examples row
replaced by a deferred row without changing the total count,
when the contributor checks completion through the public recovery gate,
then that case-set mismatch prevents completion credit.
The matching 142-case observation is the positive control.

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Recovery observes the committed candidate itself

Given a clean candidate descended from the pinned baseline,
when the contributor requests observation through the fixed public CLI command,
then the retained signed record binds the actual process result, complete report
and producing product tree. Caller reports, failed runs and dirty execution
inputs cannot produce a passing observation.

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Recovery requires independent current certification

Given a passing authenticated observation but an ordinary quality-review,
same-agent, stale or wrong-profile receipt,
when the contributor checks completion through the public recovery gate,
then the supplied receipt cannot grant current certification.
A fresh cross-agent recovery receipt with every required confirmation is the
positive control; missing or false confirmations remain rejected.

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

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

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Feature-level cross-scenario refactor

- [ ] cross-scenario
