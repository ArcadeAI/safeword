# Impl Plan: Run the requested revision remotely with least privilege

**Status:** implemented
**Planned on:** 2026-08-17

## Approach

Build one manual GitHub Actions workflow and prove its three observable
boundaries: request validation, checkout/result reporting, and job authority.
The local harness executes the workflow's real shell steps and replaces only
the two GitHub-owned boundaries: checkout and the test process. It can therefore
make checkout succeed at the requested SHA or fail because that SHA is
unavailable without claiming to emulate the `actions/checkout` implementation.

Build in three slices:

1. Add the candidate workflow as an existing-style schema-catalogued,
   always-omitted asset, so ordinary install cannot publish it. The single
   `workflow_dispatch` declares required string inputs with no defaults, passes
   them through exact `env:` bindings, and validates a lowercase
   40-hex SHA and the `done | full` lane, checks out that SHA with explicit
   `fetch-depth: 1` and `persist-credentials: false`, verifies
   `git rev-parse HEAD` exactly equals
   the requested SHA, sets up Bun, and invokes
   `bunx safeword@0.78.3 project test --lane <lane> --execution local`.
   Every workflow-context value consumed by shell is bound through that step's
   `env:`; no `run:` body contains a `${{ }}` expression. An `if: always()`
   report step writes `safeword-remote-test-result.json` and a pinned
   `actions/upload-artifact` step, also guarded by `if: always()`, publishes it under the fixed artifact name
   `safeword-remote-test-result`. The JSON has exactly
   `schema_version`, `status`, `lane`, `requested_sha`, `observed_sha`, and
   `rejected_reason`. Status is
   `rejected` when validation or checkout fails, `passed` when tests pass, and
   `failed` when tests run and fail. A test outcome other than `success` or
   `failure` is `incomplete`, never a test conclusion. Invalid values are not echoed: their JSON
   field is `null` and `rejected_reason` is `invalid_target_sha` or
   `invalid_lane`.
   Checkout rejection retains the already-valid request, has no test result or
   substitute revision, and uses `checkout_unavailable`; a HEAD mismatch uses
   `head_mismatch` and also includes the observed HEAD as diagnostic evidence.
   A completed result contains the observed workspace HEAD; `status` itself is
   the test conclusion. Failure before the report
   artifact is published is an ordinary workflow infrastructure failure, not a
   fabricated Safeword result. The integration
   harness observes that invalid input starts neither checkout nor tests, an
   unavailable SHA starts checkout but not tests, and a temporary source
   repository with a later main tip exposes a temporary ref at the requested
   ancestor; a `file://` depth-one clone of that ref is detached and the ref is
   removed, leaving exactly that one checked-out commit. A second fixture
   checks out the wrong commit and
   fails closed before tests, and pass/fail reports the HEAD the test process saw.
2. Add a small release-time workflow contract evaluator beside template/schema
   validation, plus the repository's pinned actionlint v1.7.12 check. It accepts
   exactly one `workflow_dispatch` trigger, required/no-default workflow inputs and their exact `env:` bindings, checkout `ref:` to the
   requested-SHA input, effective top-level and job permissions of exactly
   `contents: read`, checkout with a full immutable action SHA and
   `fetch-depth: 1`, `persist-credentials: false`, and every additional remote action at a full
   immutable SHA. It rejects job-level reusable workflows, local or Docker
   actions, any `secrets:` key, and any `secrets.*` expression anywhere in the
   document. It forbids `continue-on-error`, permits `if:` only as `always()` on
   the report and upload steps, and pins the result filename, exact JSON keys
   and rejection-reason enum, fixed artifact name, upload path, upload action
   SHA, upload condition, and the four-value status enum; rejects `${{ }}` inside
   every `run:` body; and requires each input or step outcome used by shell to
   arrive through the same step's `env:`. The report shell recomputes invalid
   input reasons from those bindings; failed validation steps need no outputs.
   It does not require a remote runtime dependency merely as a proxy
   for runtime setup. Table-driven unit tests remove or misbind `ref:` and each
   input, add job-level write permission and secret references in `env:`,
   `with:`, and `run:`, add a trigger or `continue-on-error`, change a step
   condition or result status, inline a workflow expression in `run:`, remove checkout,
   remove the permissions declaration, persist credentials, and replace each
   action SHA with a mutable ref. A wiring test reads the real template through
   its schema entry.
3. Add Cucumber steps that reuse the integration and contract harnesses, then
   remove `@wip`. Run the feature lane, focused Vitest tests, schema-registration
   test, typecheck, and lint. GRDXXA subsequently records pinned actionlint and
   four exact-byte GitHub runs—a passing `done` lane and failing `full` lane
   against a non-tip ancestor SHA, unavailable checkout, and invalid-input
   rejection—before the bytes are admitted for customer installation.

Primary proofs by scenario:

| Scenario behavior | Primary proof |
| --- | --- |
| Invalid SHA or lane | Actual validation shell; checkout and test recorders remain untouched; result JSON is `rejected` and omits the invalid value |
| Unavailable SHA | Checkout boundary returns unavailable; test recorder remains untouched; result JSON is `rejected` with no observed SHA |
| Checkout/request divergence | Checkout recorder prepares the shallow workspace at a different SHA; the actual verification shell reads HEAD, writes `head_mismatch` with requested and observed SHAs, and starts no tests |
| Passing, failing, or cancelled exact SHA | A two-commit source repository is shallow-cloned at its non-tip ancestor; actual verification and reporting shells read that HEAD and the test recorder observes the same working tree and a `passed`, `failed`, or `incomplete` result |
| `done`, `full`, or unsupported lane | Actual runner shell reaches the recording Safeword process with exactly one supported lane, or does not start it |
| Input wiring and minimum runner contract | Semantic mutation table covers exact input/env/ref bindings and authority; schema-to-template wiring test covers the shipped bytes |
| GitHub-owned workflow semantics | GRDXXA's four exact-byte runs before release admission |

## Decisions

### Recorded Decisions

| Decision | Choice | Why |
| --- | --- | --- |
| Use GitHub-native controls | One workflow with inline validation, exact checkout, pinned actions, and explicit read-only permissions | The agreed non-malicious customer boundary needs no custom trust service or API pre-check |
| Make outcomes machine-readable | Upload one fixed-name JSON artifact with `rejected`, `passed`, `failed`, or `incomplete`; use a closed rejection-reason enum | Consumers never mistake cancellation for a test conclusion; missing artifact means reporting infrastructure failed |
| Exercise boundaries, not a GitHub emulator | Read ordered `run:` scripts and their literal `env:` keys from the real YAML; supply dispatch inputs and step outcomes at the boundary; execute the scripts in a real temporary Git workspace | This proves Safeword-owned behavior deterministically while GRDXXA proves GitHub expression, `uses:`, and `if: always()` semantics against exact bytes |
| Pin runner protocol v1 | Use the current published-release candidate, `safeword@0.78.3`, and change workflow bytes only through FFXB81 | Installed customer workflows need stable, reviewable commands rather than `latest`; npm and its transitive dependency resolution are explicitly outside this non-malicious boundary |

The CLI already defines `project test`, lanes `done | full`, and execution modes
`local | remote-preferred`; a focused source-contract test anchors the workflow
argv to that catalogue as a drift warning; GRDXXA's real runs prove the published
0.78.3 command. Version 0.78.3 is already published, so exact-byte
admission does not depend on publishing the release under construction. Existing customer copies remain
pinned and operable; FFXB81 owns any later opt-in workflow upgrade.

Remote runs intentionally use the admitted workflow protocol version rather
than whichever Safeword happens to be installed on the dispatching laptop or in
the customer lockfile. That makes equal workflow bytes execute equal runner
logic; project test commands still come from the checked-out revision.

The workflow is reversible for a customer because it is optional and removable.
Its published protocol version is a compatibility commitment, not a reversible
implementation detail. No ADR is needed for this single optional workflow.

BR373S defines result-artifact schema v1. S2TF4J consumes it for dispatch result
reporting; future schema changes require coordination with that ticket's parser
and the managed workflow upgrade path.

## Design alignment

| Principle | Consequence | Proof |
| --- | --- | --- |
| 1. Structure enforces; instructions suggest | The schema catalogues but omits the candidate until explicit lifecycle code installs admitted bytes | [Focused contract evidence](.project/tickets/BR373S-protect-remote-test-runners/test-definitions.md#rule-remote-runnertbu1r3-repository-code-receives-only-the-admitted-read-only-authority-and-immutable-workflow-dependencies) |
| 5. Correct and safe; then clear; then simple | One workflow, one small evaluator, and four result states | [Complete RED/GREEN/REFACTOR ledger](.project/tickets/BR373S-protect-remote-test-runners/test-definitions.md) |

The always-omitted generator is an existing schema capability already used for
explicit-command-only assets. The evaluator belongs beside schema/template
validation rather than in the runtime execution-choice module.

## Known deviations

- The contract evaluator is implemented and exercised by focused Vitest and
  Cucumber coverage, but BR373S does not call it from a production admission
  path. GRDXXA owns exact-byte release admission; dispatch and artifact
  consumption remain assigned to their companion tickets.
- Local tests do not emulate GitHub expression, step-condition, or action
  internals. They read the real YAML's shell and environment declarations, then
  provide boundary outcomes. GRDXXA proves the remaining GitHub semantics with
  exact candidate bytes before release admission.
- Empty-value cases drive the validation shell directly. GitHub rejects truly
  absent required inputs before creating a run; that platform rejection starts
  neither checkout nor tests and has no Safeword result because no job existed.
- The workflow pins the Safeword package version, not every transitive npm
  artifact. This is acceptable under the explicit non-malicious environment
  assumption.
- Result reporting remains in the test job. Isolating it from malicious test
  code would require a second job, but customer code and maintainers are an
  explicit non-adversarial boundary for this ticket.
- Job timeout and concurrency remain customer policy; this ticket changes
  correctness and repository authority only.
- The checked-out revision's project test configuration must remain readable by
  runner protocol v1. A future incompatible project-config format activates the
  managed workflow upgrade path rather than silently changing installed bytes.

## Doc impact

skip: BR373S remains unavailable until GRDXXA admission and HWZZJ8 public wiring;
HWZZJ8 owns customer documentation.

## Assessment triggers

- Customer code or repository maintainers become an adversarial boundary.
- A second workflow version activates FFXB81's upgrade path.
- GitHub changes dispatch, token permissions, checkout inputs, or action syntax.
