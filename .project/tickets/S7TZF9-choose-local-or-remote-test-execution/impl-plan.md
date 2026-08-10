# Impl Plan: Choose local or remote test execution per contributor

**Status:** planned

## Approach

The riskiest remaining assumption is that a new public `project test` command
can execute the real `test-plan` result without creating a second
command-selection table. Prove that before any further preference work with a
CLI integration test that supplies a temporary project, resolves `test` or
`verify` through `resolveTestPlan`, and substitutes only the child-process
boundary.

This child defines two deliberately small seams for later children:

- The optional shared preference is the top-level `testExecution` property in
  `.safeword/config.json`, with the same `local | remote-preferred` values as the
  command and personal scopes. It selects intent only; it does not install a
  provider, authorize dispatch, or make remote mode durable by itself.
- Remote availability is a typed observation made before dispatch. In this
  child the production observer always returns `unavailable: not-installed`;
  S2TF4J replaces that observer with provider discovery. A malformed or partial
  provider will be `unavailable`, never dispatchable.

Build order:

1. Add `project test` through the public CLI protocol. Reuse `resolveTestPlan`
   and run its resolved entries locally when remote execution is unavailable;
   integration tests substitute only spawn and assert the exact resolver output
   is used for `done` and `full`.
2. Specify the local adapter contract in tests: inherit stdin/stdout/stderr and
   environment, use each plan entry's cwd, execute entries in resolver order,
   stop at the first non-zero result, preserve numeric exits, map spawn errors
   and signal-only termination to a stable Safe Word failure, and treat an empty
   plan as a successful no-op.
3. Complete execution-mode parsing and precedence tests for
   command/personal/project/built-in selection. The project value is read only
   from `.safeword/config.json`; unsupported project values are absent rather
   than personal-config safety failures.
4. Complete `project test-execution status` through the public CLI protocol,
   with a real temp-project wiring test for scope/origin output, typed remote
   availability, and no mutation.
5. Parse personal JSON with a small token-aware top-level object parser so
   duplicate logical keys (including escaped spellings) are rejected before
   schema validation. Tests cover every scenario row: malformed JSON, duplicate
   keys, unknown keys, unsupported schema versions, and unsupported modes.
6. Harden personal-file reading against static unsafe paths with no-follow open,
   `fstat` regular-file and single-link checks on the opened descriptor, and
   resolved-parent containment. Refuse an existing personal config unless
   `git check-ignore` proves it is ignored and untracked. Tests cover absence,
   valid ignored data, unignored/tracked data, final-component symlinks, hard
   links, directories, and an already-escaping parent.

Personal configuration is authored explicitly by the contributor. Setup,
upgrade, status, and test never create it or modify ignore files. Documentation
will tell contributors to keep the namespace `personal/` directory ignored;
the read path enforces that privacy invariant without mutation. Automatic
ignore reconciliation is outside this child because it would violate the
command no-mutation contract and has no scenario-defined trigger.

Concurrent same-user replacement of an ancestor directory is not a security
boundary this portable Node CLI can prove without `openat`. This child promises
rejection of unsafe state observable when the request begins; it does not claim
protection from a local actor racing the same user's process. The docs state
that boundary rather than implying a stronger guarantee.

Scenario proof mapping: command override and personal precedence use unit plus
CLI integration tests; worktree isolation and unsafe config use filesystem
integration tests; status and fallback use CLI wiring tests. Safeword CLI is
the sole affected surface; all agent runtimes invoke it unchanged.

## Decisions

| Decision | Choice | Alternatives considered | Rejected because |
| --- | --- | --- |
| Personal storage | `<namespace-root>/personal/config.json`, optional, contributor-authored, and accepted only when Git proves it ignored and untracked | home-directory global config; automatically created personal config; documentation-only privacy | It is inspectable and worktree-local, while read-only commands enforce that it cannot be accidentally shared. |
| Precedence | command → personal → project → built-in local | personal before command; implicit remote default | One-run intent must win, and safe local remains the absence default. |
| Local execution | Reuse `resolveTestPlan` output | parallel runner-selection table | Two resolver contracts would drift and could run different commands. |
| Project preference | Optional top-level `.safeword/config.json#testExecution` intent only | provider installation as the preference; a second config file | It reuses the existing project config without claiming that a provider exists. |
| Remote availability | Typed pre-dispatch observer; always `not-installed` in this child | infer from preference; probe GitHub on every command | Preference is not capability, and this child has no network or dispatch authority. |
| Filesystem threat boundary | Reject static unsafe state with no-follow open, descriptor metadata, containment, and Git-ignore proof | claim race-free containment using string paths; native `openat` addon | Portable Node cannot bind an ancestor directory descriptor to the final open; concurrent same-user races are documented out of scope. |

The bounded constraint carried from BBNZ68 is that personal state must remain
worktree-local, inspectable, optional, and lower precedence than a one-run flag.

## Design alignment

| Principle | Consequence | Proof | Conflict |
| --- | --- | --- | --- |
| Optimize for the NTB without constraining the TBU | Safe local default and plain source/status output; explicit override remains available | `packages/cli/tests/cli-protocol/test-execution-wiring.test.ts` | |
| 1. Structure enforces; instructions suggest | Invalid personal config fails before execution rather than relying on a warning | `packages/cli/tests/cli-protocol/test-execution-wiring.test.ts` | |
| 3. Add, never replace | Read-only test commands do not edit project config or ignore files | `packages/cli/features/steps/choose-local-or-remote-test-execution.steps.ts` | |

Architecture decisions: None recorded yet for this execution preference seam.

## Known deviations

skip: Remote installation, dispatch and runner trust are intentionally deferred to X2Z8MN, S2TF4J and BR373S.

## Doc impact

Update CLI help plus README/customer guidance with the exact project and
personal JSON shapes, explicit contributor ownership of ignore rules, fallback
wording, and local process behavior.

## Assessment triggers

Revisit when a second remote provider is added, project-wide remote preference
becomes independently useful, or worktree-local configuration proves confusing
in user testing.
