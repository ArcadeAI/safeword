# Test Definitions: Recover remote-test setup after interruption

Executable source: `packages/cli/features/recover-remote-test-setup-after-interruption.feature`.

## Rule: recover-remote-test-setup-after-interruption.H136BP.R1

- Table fault model: create, write, sync, destination recheck, rename, remove,
  cleanup, and final verification failures crossed with applicable destination
  states; assert exit class, complete destination, residue, and preference.
- Integration: interruption immediately before or after atomic rename or
  destination removal exposes only the prior/current complete byte sequence or
  absence.
- Integration: explicit retry converges from absent, historical, and current states and preserves customer-owned bytes.
- Integration: customer changes after interruption are preserved.
- Planned lower-level table path model: exclusive private-path creation rejects regular files,
  directories, symlinks, and dangling symlinks; later invocations ignore those
  same leftover shapes without following links.
- Integration: failures return nonzero without changing the execution preference.

## Scenario Review Dispositions

- Complete-destination outcomes, interruption boundaries, retry convergence,
  customer preservation, and external-target preservation: `covered` by
  representative acceptance scenarios.
- Operation × destination failure permutations: `delegated` to the table fault
  model.
- Private-path and leftover-object permutations: `delegated` to the planned
  lower-level table path model; the symlink acceptance scenario binds its
  fail-closed and no-link-following invariants. Regular-file and directory
  occupancy remain unsatisfied until that model lands during implementation.
