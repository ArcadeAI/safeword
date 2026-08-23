# Epic: Install remote test workflows without overwriting customer changes

## Intent

Let every project optionally gain managed remote-test capacity through a safe, inspectable lifecycle with local fallback, without overwriting customer CI or granting unnecessary authority.

## References

- Parent: [BBNZ68 — Offload tests without blocking local work](../BBNZ68-offload-tests-without-blocking-local-work/spec.md)
- Prerequisite: [S7TZF9 — Choose local or remote test execution](../S7TZF9-choose-local-or-remote-test-execution/spec.md)
- Follow-on: [S2TF4J — Run tests remotely with safe recovery](../S2TF4J-run-tests-remotely-with-safe-recovery/spec.md)
- Security sibling: [BR373S — Protect remote test runners](../BR373S-protect-remote-test-runners/spec.md)

## Child Features

- [HWZZJ8 — Manage remote test workflows without overwriting customers](../HWZZJ8-manage-remote-test-workflows-without-overwriting-customers/spec.md) owns v1 identity, status, first setup, disable, and public adapters.
- [H136BP — Recover remote test setup after interruption](../H136BP-recover-remote-test-setup-after-interruption/spec.md) is superseded as an implementation ticket; its first-publication evidence is reconciled into HWZZJ8 and its historical-replacement evidence is preserved for FFXB81.
- [GRDXXA — Install only trusted remote test workflows](../GRDXXA-install-only-trusted-remote-test-workflows/spec.md) owns workflow admission and least privilege.
- [FFXB81 — Upgrade remote-test workflows safely](../FFXB81-upgrade-remote-test-workflows-safely/spec.md) is blocked until a second workflow version is proposed and then owns historical identity, replacement, and recovery.

## Split Rationale

The original packet combined unrelated workflow admission and lifecycle concerns.
Workflow admission remains separate. HWZZJ8 manages one local file, while H136BP
keeps its interruption proof readable without pretending to be another runtime
component. Execution preference remains independently configurable.

## Product Inspiration

Kubernetes field ownership inspired exact managed identity and visible conflicts. Terraform drift detection inspired classify-before-mutate behavior. Safeword does not copy field-level merging or infrastructure-plan complexity: it owns whole registered files, never imports customer bytes, and gives non-technical builders one plain next action.

## Epic Outcome

Together, the current children provide optional managed workflow setup, safe
disable, retry after interruption, least-authority release admission, and local
ownership status. FFXB81 adds update only when a predecessor exists. Dispatch and remote
results remain in surrounding BBNZ68 children; graceful local fallback already
belongs to test-execution mode resolution.

## Release Gate

The parent acceptance proof runs the packaged CLI against real repositories and
requires HWZZJ8's lifecycle plus GRDXXA's admitted bytes. It covers first opt-in,
disable, repeat, customer divergence, unsafe paths,
interruption, preference independence, and human/JSON parity. The release
contract also blocks changing released v1 workflow bytes until FFXB81 is active
and its migration proof is green.
