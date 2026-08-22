# Test Definitions: Manage remote-test workflows without overwriting customers

Executable source: `packages/cli/features/manage-remote-test-workflows-without-overwriting-customers.feature`.

## Rule: manage-remote-test-workflows-without-overwriting-customers.TBU1.R1

- Unit table: parent/destination type × stable/default-indeterminate error.
- Unit table: absent/current LF/current CRLF/customer near-miss classification.
- Unit contract: comparison uses in-memory bytes only and cannot spawn Git,
  filters, subprocesses, or customer code.
- Integration table: private create (including EEXIST), write, sync, link, and
  cleanup faults.
- Integration contract: every mutation fault except specified EEXIST races uses
  the non-retryable publication error with operation/code detail; the table
  includes create EACCES, retryable create EEXIST, parent-mkdir EEXIST, and
  exclusive-link EEXIST; post-publication cleanup failure reports current with
  a residue warning.
- Integration contract: setup resolves effective mode before mutation; an
  invalid preference returns `SAFEWORD_TEST_EXECUTION_INVALID` and leaves the
  workflow absent, while success carries the cached mode and stable guidance
  finding in JSON and human output.
- Integration contract: initial setup classification maps an indeterminate
  observation to result-envelope state `failed`, retryable
  `REMOTE_WORKFLOW_RETRY`, and no lifecycle data.
- Integration table: managed-parent mkdir success, EEXIST reinspection, unsafe
  replacement, and indeterminate failure.
- Integration: exclusive publication preserves a concurrently appearing file.
- Integration instrumentation: the injected filesystem records publication
  attempt counts and unlink attempts used by bounded-retry assertions.
- Integration: EEXIST reclassification is single-attempt across current,
  customer, unsafe, absent, and indeterminate results.
- Integration: interruption exposes absence or complete bytes; retry ignores unknown residue.
- Integration: every private publication name is dot-prefixed and lacks a
  `.yml`/`.yaml` suffix, so GitHub Actions cannot parse crash residue.
- Integration: disable's final recheck prevents unlink after an observed
  customer replacement and returns an unsafe-path conflict after an unsafe
  replacement.
- Integration: unlink ENOENT converges to not-installed; other unlink failures
  retain current with `REMOTE_WORKFLOW_REMOVAL_FAILED` and operation/code/path.
- Reconciliation: install, upgrade, uninstall, status, and doctor remain
  observational; uninstall human/JSON give the surviving workflow's packaged
  disable command, which remains usable after uninstall.
- Packaged CLI: status, setup, and disable wiring, shared conflict wording, and
  preference invariance.

## Rule: manage-remote-test-workflows-without-overwriting-customers.NTB1.R1

- Contract: human and JSON status derive from one closed result.
- Contract: setup and disable human/JSON renderings derive from the same
  lifecycle data and exit code.
- Integration: status performs no writes and unlisted observation errors are retryable.
- Existing execution contract (outside this rule's feature scenarios):
  remote-preferred falls back locally when unavailable.

## Scenario Review Dispositions

- Ownership boundaries, concurrent destination creation, interruption retry,
  customer preservation, reconciliation neutrality, and public wiring: `covered`
  by representative acceptance scenarios.
- Path/error and operation-fault permutations: `delegated` to deterministic
  lower-level tables.
- Comparison purity and private-name inertness: `delegated` to explicit unit
  and integration contracts above.
- Historical recognition, replacement, and expanded recovery: `deferred` to
  FFXB81 when a second workflow version is proposed.
- Workflow authority and distribution identity: `delegated` to GRDXXA.
