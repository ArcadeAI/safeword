# Spec: Manage remote-test workflows without overwriting customers

## Intent

Let a project inspect, install, and remove Safeword's first optional remote-test
workflow without adopting or overwriting customer-owned CI.

## Boundary

This feature manages one file: `.github/workflows/safeword-remote-tests.yml`.
Test-execution preference remains the separate S7TZF9 setting (`local` or
`remote-preferred`); workflow setup and disable never change it. Existing test
execution continues to fall back locally when remote execution is unavailable.

GRDXXA owns release admission of the exact workflow. FFXB81 owns recognizing and
replacing previously released workflow versions when a second version exists.
Ordinary Safeword install, upgrade, uninstall, status, and doctor never create,
replace, remove, or report drift for this explicitly managed optional file.
When uninstall leaves the current optional workflow in place, human output and
JSON finding `REMOTE_WORKFLOW_REMAINS` say “The optional remote-test workflow
remains installed. Run `bunx safeword project test-execution remote disable` to
remove it.” The packaged command remains usable after project uninstall.

## Jobs To Be Done

### Technical Builder — Opt in without surrendering ownership

> When I add remote testing around my existing CI, I want Safeword to change
> only workflow bytes it can prove it shipped, so my CI remains mine.

#### Rule TBU1.R1 — Workflow bytes that differ from the current bundle when observed before mutation are never changed

### Non-Technical Builder — Know what to do next

> When remote-test setup needs attention, I want one plain result and one safe
> next action without learning GitHub Actions internals.

#### Rule NTB1.R1 — Status is read-only, stable, and gives at most one next action

## Ownership Model

Every component is inspected without following symbolic links. Existing
required parents are checked before destination absence or byte identity. A
missing parent is creatable; an existing unreadable, symlinked, or wrong-typed
parent is unsafe.

The workflow is:

- `not_installed` when every required parent is safe or creatable and the
  destination is absent;
- `current` when every required component is safe and observed bytes equal the
  current bundled workflow after the comparison rule below;
- `customer_owned` for every other safe regular-file value; or
- `unsafe_path` when a required component is unreadable or has the wrong type.

For comparison only, replace every CRLF sequence with LF in both observed and
bundled bytes; perform no other transformation. No Git filter, subprocess, or
customer code participates in comparison.

Stable path facts such as `EACCES`, `ELOOP`, and `ENOTDIR` classify as
`unsafe_path`. Every unlisted observation error is indeterminate and returns
exit 2 with result-envelope state `failed`, a retryable
`REMOTE_WORKFLOW_RETRY` error, no lifecycle data, and the sentence “Safeword could
not confirm the workflow path state; run the command again.”

## Lifecycle

| State | Status action | Setup | Disable |
| --- | --- | --- | --- |
| `not_installed` | `install_remote_tests` | publish current workflow | successful no-op |
| `current` | none | successful no-op | remove workflow |
| `customer_owned` | `move_aside_and_repeat` | preserve and stop | preserve; successful no-op |
| `unsafe_path` | `repair_path_and_repeat` | preserve and stop | preserve and stop |

The public entry points are `safeword project test-execution remote status`,
`setup`, and `disable`.

Every fully classified status, setup, and disable result contains the lifecycle
fields `state`, `affected_path`, and `next_action`; status data contains exactly
those fields. The latter two describe the action for that command, so both are
null when its desired state is already true (including setup on `current` and
disable on `not_installed` or `customer_owned`). Successful setup data also
contains `effective_mode`; JSON carries the same guidance as a stable finding
code and human output renders its exact sentence.
`affected_path` is the path a status action operates on; it is null with
`next_action` when no action applies. For an unsafe ancestor it is the first
unsafe repository-relative component. Fully classified status exits 0;
indeterminate observation exits 2.

Setup conflicts exit 2 with lifecycle data and `REMOTE_WORKFLOW_CONFLICT`;
retryable state churn and indeterminate observation use `REMOTE_WORKFLOW_RETRY`.
Disable on customer-owned bytes exits 0 because the desired state—no Safeword
workflow installed—is already true. Unsafe paths remain conflicts because
Safeword cannot establish what occupies the managed location.

Human output renders null as `none` and uses these sentences:

- install: “Run `bunx safeword project test-execution remote setup` to install
  Safeword's test workflow.”
- customer conflict: “Safeword won't overwrite the differing workflow. Compare
  or move it aside, then run the command again.”
- unsafe path: “Repair the workflow path, then run the command again.”
- customer-owned disable: “No Safeword workflow is installed at this path; the
  existing workflow is yours and was left unchanged.”

A setup resolves and validates the effective execution mode before mutation,
so a configuration read failure cannot turn a completed publication into a
reported failure. Invalid configuration returns the existing non-retryable
`SAFEWORD_TEST_EXECUTION_INVALID` failure with no lifecycle data. A successful
setup reports that cached, unchanged mode. When
that mode is local it says “Run `safeword project test --execution
remote-preferred` to prefer remote execution.”; when already remote-preferred
it says “Remote-preferred execution is already selected.” This is guidance,
not a preference mutation.
Status and disable do not read test-execution preference because their outputs
do not depend on it.

## Safe Publication

Setup writes and syncs the complete workflow to a fresh, dot-prefixed private
file in the workflow directory whose name cannot be parsed as a GitHub Actions
workflow. It publishes with an exclusive same-directory link, so an existing or
concurrently appearing destination is never replaced and the visible
destination is never partial. It then removes only its own private entry.

If exclusive publication reports EEXIST, setup reclassifies once: `current`
succeeds without mutation; customer/unsafe states return their normal result;
absence or indeterminate observation returns result-envelope state `failed`
with a retryable `REMOTE_WORKFLOW_RETRY` error and no lifecycle data. It never
loops.
A crash can leave the private entry; later invocations ignore unknown residue.
Ordinary failure cleanup removes only the entry created by that invocation. If
that cleanup also fails, the already-classified primary result wins and a
`REMOTE_WORKFLOW_RESIDUE` warning is added; cleanup never masks a conflict or
publication failure.
Every mutation failure except the explicitly handled EEXIST races returns exit
2 with result-envelope state `failed`, non-retryable
`REMOTE_WORKFLOW_PUBLICATION_FAILED`, no lifecycle data, the underlying
operation and code, and “Safeword could not publish the workflow. Fix the
reported permission, capacity, or filesystem-support problem; local testing
remains available.” Private-create EEXIST returns retryable
`REMOTE_WORKFLOW_RETRY`; parent-mkdir and exclusive-link EEXIST follow their
single-reinspection rules below.
If publication succeeded but private-entry
cleanup fails, setup returns `current` with warning
`REMOTE_WORKFLOW_RESIDUE` and “The workflow is installed, but Safeword could
not remove temporary file <path>. GitHub Actions cannot run it; it is safe to
delete.” It never reports the installed workflow as failed.

Missing parents are created one component at a time. EEXIST is inspected once
without following links: an expected directory is accepted, an unsafe object is
reported, and absence/indeterminate observation returns result-envelope state
`failed` with a retryable `REMOTE_WORKFLOW_RETRY` error.

Disable rechecks immediately before unlink. The contract preserves customer
bytes it observes; it does not claim coordination with an arbitrary writer that
changes a path between the final check and a path-based filesystem operation.
Unlink ENOENT converges successfully to `not_installed`. Every other unlink
failure exits 2 with state `current`, affected path
`.github/workflows/safeword-remote-tests.yml`, next action `repair_path_and_repeat`,
non-retryable `REMOTE_WORKFLOW_REMOVAL_FAILED`, operation/code/path detail, and
“Safeword could not remove the workflow. Fix the reported filesystem problem,
then run remote disable again.”

## Outcomes

- Opt-in is explicit and optional for every customer.
- Observed customer workflow bytes are preserved.
- With valid configuration, repeating setup or disable is a successful no-op.
- Failure never changes test-execution preference.
- A failed or interrupted setup exposes absence or the complete workflow.
- Setup may create managed parents; successful commands otherwise change only
  the registered workflow entry and necessary parent metadata.

## Open Questions

None.
