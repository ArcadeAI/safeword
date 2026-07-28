# Design: One predictable Safeword CLI

## Context

Safeword currently registers commands directly in `cli.ts`; command modules
print and sometimes terminate the process themselves. That makes prose,
machine output, effects, prompting, and exit semantics properties of each
command rather than properties of the CLI. The public surface has also grown
organically, mixing user workflows with hook and migration helpers.

## Decision

Adopt one execution pipeline:

`Observe → Plan → Confirm → Apply → Verify → Report next action`

The pipeline exchanges immutable `Plan` and `Result` values. Command handlers
may observe domain state and apply a confirmed Plan, but may not render output
or terminate the process. A declarative command catalog supplies public name,
family, aliases, effect class, prompt/network policy, and handler. Human and
JSON renderers are the only presentation boundary.

## Contracts

```ts
type EffectClass = 'observe' | 'plan' | 'mutate' | 'destructive' | 'hook';
type ResultState = 'healthy' | 'changed' | 'action-required' | 'failed';

interface Plan {
  readonly schemaVersion: 1;
  readonly id: string;
  readonly command: string;
  readonly preconditionDigest: string;
  readonly effects: {
    readonly files: readonly FileEffect[];
    readonly packages: readonly PackageEffect[];
    readonly configuration: readonly ConfigurationEffect[];
    readonly network: readonly NetworkEffect[];
    readonly destructive: readonly DestructiveEffect[];
  };
  readonly findings: readonly Finding[];
  readonly requiresConfirmation: boolean;
  readonly verification: readonly Verification[];
}

interface Result {
  readonly schemaVersion: 1;
  readonly ok: boolean;
  readonly state: ResultState;
  readonly changed: boolean;
  readonly findings: readonly Finding[];
  readonly effects: Effects;
  readonly errors: readonly {
    readonly code: string;
    readonly message: string;
    readonly retryable: boolean;
  }[];
  readonly recovery: readonly {
    readonly command: string;
    readonly description: string;
    readonly requiresHuman: boolean;
  }[];
  readonly nextActions: readonly NextAction[];
}
```

`Effects` always contains `files`, `packages`, `configuration`, `network`, and
`destructive`, even when empty.
`NextAction` contains `command`, `mutates`, and `requiresHuman`. Stable finding
codes carry errors and deprecations without parsing prose.

Internal TypeScript uses camelCase. JSON v1 serializes
`schema_version`, `next_actions`, `requires_human`, and the canonical state
values `healthy`, `changed`, `action_required`, and `failed`. JSON fixtures,
not TypeScript property spelling, define the wire contract.

## Command catalog

The catalog is the source of truth for help, capabilities, global policy
checks, and Commander registration metadata. Each public entry includes a
deterministic invocation fixture: argv, environment preconditions, and the
expected effect class. The same fixture drives capabilities examples and
subprocess contract tests.

Canonical public surface:

- bare `safeword` / `status`
- `setup`
- `plan`
- `doctor`
- `remove`
- `project …`
- `tracker …`
- `codex …`
- `ticket …`
- `retro …`
- `capabilities`

Complete compatibility inventory:

| Current command | Canonical destination | Classification |
| --- | --- | --- |
| `setup` | `setup` | canonical |
| `check` | `status` | deprecated alias |
| `upgrade` | `setup` | deprecated alias |
| `diff` | `plan` | deprecated alias |
| `reset` | `remove` | deprecated alias |
| `sync-config` | `project sync-config` | deprecated alias |
| `architecture` | `project architecture` | deprecated alias |
| `sync-learnings` | `project sync-learnings` | deprecated alias |
| `sync-tickets` | `project sync-tickets` | deprecated alias |
| `codify` | `project codify` | deprecated alias |
| `test-plan` | `project test-plan` | deprecated alias |
| `lint-gherkin` | `project lint-gherkin` | deprecated alias |
| `sync-tracker` | `tracker sync` | deprecated alias |
| `connect` | `tracker connect` | deprecated alias |
| `self-report` | `retro signals` | deprecated alias |
| `retro` | `retro run` | deprecated alias |
| `retro-reconcile` | `retro reconcile` | deprecated alias |
| `migrate codex-plugin` | `codex migrate` | deprecated alias |
| `codex …` | `codex …` | canonical family |
| `ticket new` | `ticket new` | canonical family |
| `boundary` | none | hidden hook helper |
| `hook codex` | none | hidden hook helper |
| `codex-hook` | none | hidden compatibility helper |
| `feature-directories` | none | hidden helper |

Every alias declares `introducedIn`, `retainedThrough`, and
`removalEligibleAfter`. Tests exercise release-line offsets one and two;
removal remains a separate breaking-change decision after the second line.

Hook helpers (`boundary`, `hook`, `codex-hook`, `feature-directories`) and
low-level migration compatibility remain registered but hidden.

## Output and process boundary

`runCli()` resolves global options, invokes the catalog entry, renders exactly
once, and returns an exit status. Only the executable adapter writes rendered
text and assigns `process.exitCode`. It never calls `process.exit`, allowing
buffers and cleanup to finish.

Human rendering:

1. outcome line;
2. `Changed: yes|no`;
3. concise findings;
4. at most one `Next: <command>`.

`--quiet` suppresses healthy/progress prose but never errors or the one
action-required next step. `--verbose` appends implementation detail after the
primary verdict. `--cwd` selects the project root without changing the parent
process working directory. `--offline` prevents any declared network adapter
from running. Global options normalize before parsing only until `--`, which
preserves all following command arguments verbatim.

Progress timing uses an injected monotonic clock and scheduler. Acceptance
tests advance virtual time deterministically and assert the progress adapter is
called by 100 ms; the existing subprocess performance lane retains its
tolerance-based wall-clock checks.

JSON rendering writes one envelope to stdout. Diagnostics are represented
inside the envelope; stderr is reserved for executable/bootstrap failures that
prevent envelope construction.

## Safety

- Catalog policy rejects effects returned by `observe`, `plan`, or `hook`
  commands that violate their declared class.
- `--no-input` and non-TTY runs never call a prompt adapter.
- A destructive Plan without explicit consent returns `action-required`.
- Network effects must be declared before execution; `--offline` rejects them.
- Apply records completed effects and recovery guidance if a later effect
  fails.
- Read-only tests snapshot the filesystem and replace package/network adapters
  with fail-fast witnesses.

## Compatibility and rollout

Aliases are catalog entries pointing to canonical handlers. Their Result gains
`CLI_ALIAS_DEPRECATED`, with `replacement`, `introducedIn`,
`retainedThrough`, and `removalEligibleAfter` metadata.
Capabilities lists aliases so agents can migrate without scraping help.

Compatibility preserves legacy option spellings, but never weakens the
destructive-plan boundary. In particular, `diff -v` remains accepted, while
`reset -y` without `--plan <id>` returns the exact current removal Plan and a
copyable canonical action instead of applying an unbound plan. Existing
automation can still discover and confirm the operation deterministically,
without allowing project drift between preview and apply to inherit stale
consent.

Release one introduces contracts, canonical names, aliases, and fixtures.
Release two keeps aliases and raises documentation prominence. Removal is
eligible only after two shipped release lines and a separate breaking-change
decision.

Confirmation binds to `Plan.id`, which hashes the command, normalized effects,
and `preconditionDigest`. Apply recomputes the precondition digest immediately
before mutation and refuses stale plans. Results record only effects completed
before a failure and include stable error plus recovery entries.

## Rejected alternatives

- **Renderer wrappers around existing printing commands:** cannot guarantee
  JSON-only stdout or semantic parity.
- **Machine-specific commands:** duplicate execution semantics and inevitably
  drift.
- **Immediate hierarchy cleanup:** breaks scripts and installed hooks.
- **Implicit repair from status:** violates the trust boundary and makes agent
  planning unsafe.
