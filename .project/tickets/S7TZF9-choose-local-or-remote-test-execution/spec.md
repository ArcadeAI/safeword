# Choose local or remote test execution per contributor

## Intent

Contributors should be able to keep tests on their own machine or prefer a
remote runner without changing the shared project configuration for everyone
else. Until remote execution is installed by its own feature, the same request
must resolve visibly and safely to the existing local test-plan command.

## Intake Brief

- **Requested by:** Alex, after local Vitest serialization made parallel agent sessions slow.
- **Cost of inaction:** Contributors either contend for one laptop-bound test process or manually remember ad-hoc remote workflows.
- **Reversibility:** Two-way door. The public command and private config format are additive; a contributor can remove the personal file or use a one-run override.

## References

- Parent epic: [BBNZ68](../BBNZ68-offload-tests-without-blocking-local-work/ticket.md)
- Parent contract: [execution preference](../BBNZ68-offload-tests-without-blocking-local-work/spec.md)
- Related local-capacity work: [2RZDMP](../2RZDMP-share-test-capacity-across-parallel-sessions/ticket.md)

## Personas

- Technical Builder (TBU)
- Non-Technical Builder (NTB)

## Surfaces

Affected:

- Safeword CLI

Unaffected:

- Claude Code, OpenAI Codex and Cursor — they invoke the same CLI behavior; no host-specific configuration is introduced.

## Vocabulary

- **Execution preference:** The requested `local` or `remote-preferred` mode before availability is evaluated.
- **Personal config:** Optional current-worktree file at `.safeword/config.local.json`; never created automatically and accepted only when Git proves it ignored and untracked.
- **Project preference:** Optional top-level `testExecution` value in `.safeword/config.json`; it records intent but does not install or prove a remote provider.
- **Remote availability:** A typed pre-dispatch observation. This child can report only `not-installed`; later provider work owns positive availability.
- **Effective mode:** The mode selected by precedence after command, personal, project and built-in scopes are evaluated.

## Jobs To Be Done

### choose-local-or-remote-test-execution.TBU1 — Keep my test choice private to my worktree

**Persona:** Technical Builder (TBU)

> When my machine is busy with other sessions, I want to select a test-execution preference for this worktree, so I can use the best available capacity without changing my teammates' project setting.

#### choose-local-or-remote-test-execution.TBU1.R1 — A contributor's explicit one-run choice wins without persisting

#### choose-local-or-remote-test-execution.TBU1.R2 — A valid personal preference wins over project default only in its current worktree

#### choose-local-or-remote-test-execution.TBU1.R3 — Invalid or unsafe personal configuration never executes tests or changes project state

### choose-local-or-remote-test-execution.NTB1 — Know what Safeword will do with my tests

**Persona:** Non-Technical Builder (NTB)

> When I ask Safeword to test my project, I want it to plainly say whether it used local or remote execution and why, so I can trust the result without learning its internals.

#### choose-local-or-remote-test-execution.NTB1.R1 — Status shows the selected mode, its source and remote availability

#### choose-local-or-remote-test-execution.NTB1.R2 — Remote preference falls back to the existing local plan only when remote execution is unavailable before dispatch

## Rave Moment

skip: child feature under BBNZ68; the epic owns the customer-facing remote-testing moment.

## Outcomes

- `safeword project test --lane done|full [--execution local|remote-preferred]` resolves one mode and runs the real local plan when remote execution is not installed.
- `safeword project test-execution status` shows command, personal, project and built-in scopes in precedence order, with origins and the winning mode.
- An optional `.safeword/config.local.json` accepts only `testExecution` set to `local` or `remote-preferred`; contributors author it explicitly, and Safeword refuses to use it unless Git proves it ignored and untracked.
- A malformed, unsafe, or escaping personal config fails closed before either plan execution or project mutation, even when a one-run command override would otherwise win precedence.
- Static unsafe paths are in scope. A concurrent same-user filesystem race is not a portable security boundary for this CLI and is not claimed.

## Open Questions

defer: Positive remote availability and durable provider installation are owned
by X2Z8MN and S2TF4J. The project preference defined here selects intent only.
