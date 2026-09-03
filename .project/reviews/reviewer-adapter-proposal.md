# Reviewer adapter proposal

Status: proposal under quality review, not an implementation specification.

User goal: use Cursor as an independent reviewer and make future agents easy
to add through a standardized contract. This review concerns the proposal,
not the merged PR or the eight pending test-repair commits.

Build a reviewer-adapter contract plus a shared conformance suite, with Cursor
proving that it works.

Each trusted, bundled adapter describes vendor-specific mechanics:

- Discovery: executable identity, version, supported capabilities.
- Models: optional catalogue support and exact model-selection syntax. An absent
  catalogue is unknown, not an incompatible runtime or proof the model is absent.
- Invocation: argument construction, required configuration isolation and credential
  names. The shared runner applies filtering, creates disposable resources, launches
  processes and owns cleanup; adapters do not manage an independent lifecycle.
- Results: unwrap vendor envelopes into an UNVERIFIED payload, preserving the exact
  returned dispatch and reviewer identity fields (including absence or contradiction).
  Never fill in, default, correct or overwrite those fields from requested settings.
  Retain original output for the shared parser and provenance checks. The common
  validator validates the extracted payload before it becomes accepted review evidence.

Safeword, not the adapter, keeps control of ranking, deadlines, cleanup,
provenance validation, and whether a review qualifies as independent.
Here, cross-agent independence means a different agent runtime in a separate
headless process, not a guarantee of different model weights or uncorrelated judgment.
Keep runtime identity, requested model and observed model evidence distinct. Never
infer actual backend identity from a requested model, alias, catalogue, or the model's
own prose. Missing trustworthy model evidence stays unknown. A same-model Cursor
review can be cross-agent but must not be described as cross-model; preserve existing
cross-agent classification and enforce any separately requested cross-model policy
only on sufficient evidence. No new model-ranking or automatic model-strength policy.

Returned identity checks complement, not replace, trusted executable resolution and
dispatch binding. An identity string alone does not attest binary or backend identity.

Adding another agent should mean one adapter, one registry entry, and passing
the common tests, without editing the routing engine. This is an acceptance target,
not an achieved property. Move vendor argument/probe/parser/credential data behind
adapters; derive accepted reviewer IDs, type/schema enums and config validation from
one registry. Keep default route sequences as policy data, separate from adapter
execution. Registering an ID must reach parsing, inspection and execution together.
No user-supplied executable plugins or arbitrary command strings.

Cursor is selectable as a reviewer and may have explicit author-key rankings. Every
accepted author ranking must be honored, never silently discarded because no default
plan exists. Without an explicit Cursor-author ranking, report how to configure one;
do not invent or change legacy author defaults. Future registrations declare whether
author configuration is supported; unsupported keys fail visibly.

The locally installed Cursor CLI exposes headless JSON output, model selection,
and read-only modes. These are promising, but enforcement must be tested rather
than assuming flags guarantee it. Cursor support is gated on a bounded real-runtime
experiment: run a neutral packet in disposable configuration/workspace roots, isolate
ambient rules/plugins/hooks/MCP configuration, deny review tools, and provide only
required authentication through an explicitly tested mechanism. Prove these controls
before treating that Cursor version as compatible. Do not rewrite the user's profile,
copy broad home directories, or use force/automatic approvals to make the probe pass.
If a required control cannot be established, report unsupported with the concrete
reason; do not claim successful Cursor support. This is a build feasibility gate,
not a claim that a particular isolation-root flag already exists.

Avoid a general plugin-loading system. ACP could become an adapter transport
later, not a requirement for every agent.

Premortem: a new adapter advertises safety it does not enforce; shared failure
tests and real-runtime conformance checks must catch that.

## Migration and proof

First characterize and migrate the existing three adapters without changing observable
behavior. Preserve configured order and scope precedence, legacy model overrides,
primary/alternate/default model handling, retry versus runtime-wide failure behavior,
the shared deadline, degraded/required outcomes, output bounds and process containment.
Preserve credential-free non-inference inspection, deny-by-default environment filtering,
and existing per-vendor isolation (including OpenCode deny-all and plugin/update disables).
An uncontained process halts the chain; ordinary unavailable routes follow existing policy.

The common suite must exercise real config-to-registry-to-runner-to-result wiring,
mocking only external processes/clock boundaries. Include missing/contradictory identity,
wrong dispatch, malformed/truncated/oversized output, failure classification, timeout and
cleanup, exact model selection, unknown catalogue, configuration precedence and ordering.
Each adapter additionally needs vendor-specific fixtures and a recorded live headless
round-trip plus adversarial tool/config-isolation checks on its supported version.
Skipped live evidence is a visible limitation, not a conformance pass. Fake binaries
prove Safeword's decisions; they cannot prove the real vendor enforces isolation.

Acceptance: all existing routes retain their characterized behavior; a configured Cursor
route completes a real bound review with honest provenance and containment evidence;
Cursor author config is honored or visibly rejected; onboarding needs no new vendor
branches outside its adapter/registration and documented policy data. A short onboarding
walkthrough validates the developer-effort claim. No claim of Cursor safety is made yet.

Proposed scope: migrate the existing three reviewers to the contract, add Cursor,
and preserve current defaults while making Cursor selectable in local rankings.
