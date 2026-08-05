# Design: One coherent Safe Word command model

**Guide:** `.safeword/guides/design-doc-guide.md`
**Related:** Feature spec: `spec.md` | Scenarios: `packages/cli/features/unified-first-time-install.feature` | R/G/R ledger: `test-definitions.md`

## Architecture

The public lifecycle becomes a thin typed protocol over one domain request: operation (`install`, `status`, `doctor`, `plan`, or `uninstall`) plus an agent selection. A side-effect-free planner resolves the selected project and profile surfaces, declares their file/package/configuration/network/destructive/manual effects, and binds destructive work to the current observations. The executor consumes that plan, delegates to existing reconciliation and host-profile collaborators, and returns one aggregate result with per-surface outcomes.

Compatibility is normalized before dispatch. The catalogue remains the source of truth for canonical commands, aliases, option translations, help visibility, capability metadata, and compatibility guidance. Canonical handlers never branch on `setup`, `remove`, `--stage`, or another legacy spelling.

```text
Commander argv
  → command catalogue + compatibility normalizer
  → LifecycleRequest
  → lifecycle planner
      → project/core schema projection
      → optional Cursor schema projection
      → Claude profile observation
      → Codex profile observation
  → policy preflight (selector, offline, exact plan, no-input)
  → lifecycle executor
  → per-surface outcomes → aggregate CliResult → human/JSON renderer
```

## Components

### Component 1: Agent selection parser

**What:** Parse and normalize the shared `--agents=<comma-separated agents>` contract before any observation or mutation.
**Where:** `packages/cli/src/cli-protocol/agent-selection.ts`
**Interface:**

```typescript
type Agent = 'claude' | 'codex' | 'cursor';

interface AgentSelection {
  project: true;
  agents: readonly Agent[];
}

function parseAgentSelection(value: unknown): AgentSelection | SelectionError;
```

Omitted means Claude + Codex. Values are deduplicated. `none` is project-only and exclusive. Errors name every accepted value and occur before planning.

**Dependencies:** none.
**Tests:** selector outline, duplicate values, unknown value, and `none` exclusivity.

### Component 2: Schema ownership projection

**What:** Produce disjoint reconciliation views for core project state and opt-in Cursor state while preserving unselected/user-owned content.
**Where:** `packages/cli/src/schema.ts` and `packages/cli/src/claude-plugin/delivery-schema.ts`
**Interface:**

```typescript
type ProjectSurface = 'core' | 'cursor';

function schemaForProjectSurfaces(
  cwd: string,
  surfaces: readonly ProjectSurface[],
  operation: 'install' | 'uninstall',
): SafewordSchema;
```

The ownership partition lives beside `SAFEWORD_SCHEMA`, not as path lists in command code. Cursor-owned `.cursor/**`, `.safeword/hooks/cursor/**`, and shared Cursor skill materialization are excluded from default install and preserved by an uninstall that does not select Cursor. Claude legacy delivery continues to layer through `schemaForClaudeDelivery`.

**Dependencies:** `SAFEWORD_SCHEMA`, Claude delivery mode, reconciliation engine.
**Tests:** byte-for-byte default Cursor preservation, no missing `.cursor` creation, explicit Cursor reconciliation, and third-party-content preservation.

### Component 3: Lifecycle planner

**What:** Observe selected surfaces and produce one deterministic plan before apply.
**Where:** `packages/cli/src/commands/lifecycle.ts`
**Interface:**

```typescript
type LifecycleOperation = 'install' | 'uninstall';
type LifecycleSurface = 'project' | 'claude' | 'codex' | 'cursor';

interface SurfacePlan {
  surface: LifecycleSurface;
  effects: Effects;
  preconditionDigest: string;
  manualActions: readonly NextAction[];
}

interface LifecyclePlan {
  request: LifecycleRequest;
  plan: CliPlan;
  surfaces: readonly SurfacePlan[];
}
```

Project effects reuse reconciliation dry-runs plus setup-stage declarations. Profile effects come from current typed observations and supported host commands. Manual activation remains structured plan data and is encoded in configuration effects without changing the schema-v1 effect categories.

**Dependencies:** reconciliation planning, project/profile observations, SHA-256 plan identity.
**Tests:** every install/uninstall selection, no-mutation preview, offline preflight, stale plan, and undeclared-effect refusal.

### Component 4: Lifecycle executor and result aggregation

**What:** Apply a current authorized plan across independent surfaces and preserve truthful partial results.
**Where:** `packages/cli/src/commands/lifecycle.ts` and `packages/cli/src/cli-protocol/result.ts`
**Interface:**

```typescript
interface SurfaceOutcome {
  surface: LifecycleSurface;
  state: 'healthy' | 'changed' | 'action_required' | 'failed' | 'not_selected';
  result?: CliResult;
}

function combineSurfaceResults(
  operation: LifecycleOperation,
  outcomes: readonly SurfaceOutcome[],
): CliResult;
```

Install order is project → Claude → Codex → Cursor, continuing after an independent profile failure. Uninstall removes selected profile integrations first and project state last, preserving unselected agent assets. There is no cross-host rollback; completed effects remain reported, and recovery targets only the failed surface.

**Dependencies:** `convergeSetup`, Claude profile installer/uninstaller, Codex profile installer/uninstaller, reconciliation.
**Tests:** idempotence, drift repair, partial failure, targeted retry, aggregate severity, and per-surface rendering.

### Component 5: Catalogue compatibility normalizer

**What:** Translate retained command and option spellings into a canonical invocation before the handler runs.
**Where:** `packages/cli/src/cli-protocol/catalog.ts` and `packages/cli/src/cli-protocol/register.ts`
**Interface:**

```typescript
interface CompatibilityTranslation {
  command: string;
  options?: Readonly<Record<string, unknown>>;
  ignoredOptions?: Readonly<Record<string, string>>;
  replacement: string;
  retention: 'indefinite';
}
```

Commander continues to hide compatibility commands/options from ordinary help. The catalogue publishes the exact replacement and indefinite retention policy. `setup --yes` becomes a recognized redundant option with explicit guidance rather than consent.

**Dependencies:** Commander 15 registration, typed command catalogue, deprecation findings.
**Tests:** exhaustive alias inventory, nontrivial differential fixtures, ordinary help, capabilities, and no removal date.

### Component 6: Lifecycle observers and renderer

**What:** Keep status concise, make doctor diagnostic, and render per-surface outcomes consistently for humans and JSON consumers.
**Where:** `packages/cli/src/commands/status.ts`, `packages/cli/src/commands/doctor.ts`, and `packages/cli/src/cli-protocol/result.ts`
**Interface:**

```typescript
function observeLifecycleStatus(request: LifecycleRequest): Promise<CliResult>;
function diagnoseLifecycle(request: LifecycleRequest): Promise<CliResult>;
```

Status aggregates readiness and one next action. Doctor includes causes, coverage, profile proof, and recovery evidence. Both expose the same selected scope and surface states in `data.surfaces`.

**Dependencies:** project health, Claude status, Codex status, Cursor reconciliation observation.
**Tests:** distinct catalogue fixtures/output, NTB summary, TBU verbose/JSON evidence, and pending activation.

## Data Model

`LifecycleRequest` is the single input to every lifecycle handler:

```typescript
interface LifecycleRequest {
  operation: 'install' | 'status' | 'doctor' | 'plan' | 'uninstall';
  selection: AgentSelection;
  offline: boolean;
  noInput: boolean;
  suppliedPlan?: string;
  confirmed: boolean;
}
```

The public schema-v1 `CliResult` remains the envelope. Per-surface detail is additive under `data`:

```typescript
interface LifecycleData {
  command: string;
  operation: string;
  selected_agents: readonly Agent[];
  surfaces: readonly {
    name: LifecycleSurface;
    selected: boolean;
    state: string;
    evidence?: unknown;
  }[];
  plan?: Record<string, unknown>;
}
```

No persistent agent-selection setting is introduced. Omitted selection always means the documented Claude + Codex default; explicit selectors are invocation-scoped.

## Component Interaction

### Install

1. Catalogue normalizes the command and options.
2. Selection parser rejects invalid input.
3. Planner computes all selected effects without mutation.
4. Offline policy refuses if the plan contains network work.
5. Executor applies each authorized surface, retaining completed effects if a later surface fails.
6. Aggregator renders project, Claude, Codex, and Cursor outcomes plus exact activation/retry actions.

### Uninstall

1. Planner observes selected ownership and profile identities.
2. Without an exact identity, the command returns the plan and changes nothing.
3. Confirmation recomputes observations; a changed digest makes the plan stale.
4. Executor uses supported Claude/Codex plugin removal commands, then removes selected project ownership through reconciliation.
5. Recovery/backup details remain surface-specific and unrelated content is preserved.

## User Flow

1. A new user runs `safeword install`.
2. Safe Word configures the project, installs Claude and Codex, and leaves Cursor untouched.
3. The summary says what is ready and separately asks for Claude reload and Codex restart/new task where proof is pending.
4. A power user can run `safeword install --agents=cursor`, `safeword status --agents=claude`, or `safeword plan uninstall --agents=codex` without learning alternate command families.
5. Old scripts continue to run and receive one exact canonical replacement.

## Key Decisions

### Decision 1: One typed lifecycle plan and executor

**What:** Preview and apply share one request and surface plan.
**Why:** The accepted typed-CLI architecture requires plan/effect integrity; the current project-only plan cannot prove profile, Cursor, manual activation, or partial-failure behavior.
**Trade-off:** More orchestration code and observation adapters, but no duplicated profile implementation.

### Decision 2: Catalogue normalization for all compatibility

**What:** Translate aliases and legacy options before canonical dispatch.
**Why:** Commander 15 can hide commands/options and parse strict values, while Safeword’s catalogue—not Commander—owns effects, fixtures, capabilities, and structured compatibility.
**Trade-off:** The catalogue schema becomes richer; canonical handlers become smaller and legacy-free.

### Decision 3: Cursor ownership is an explicit schema partition

**What:** Define core and Cursor project ownership beside `SAFEWORD_SCHEMA` and compose only selected partitions.
**Why:** Filtering only `.cursor/**` would still install Cursor-specific hooks and skill materialization under `.safeword/**`; command-local path filters would violate schema-as-source-of-truth.
**Trade-off:** Schema tests must prove every owned path belongs to the right partition.

### Decision 4: Preserve honest partial success instead of rollback

**What:** Continue independent selected surfaces and report completed effects; retry only failed integrations.
**Why:** Claude/Codex profile managers are external, non-transactional boundaries, and existing architecture already rejects rewriting their private state for rollback.
**Trade-off:** A failed install can leave a deliberate partial state, so summaries and recovery must be precise.

## Implementation Notes

**Constraints:**

- Published runtime remains Node-compatible; Bun stays a development/subprocess prerequisite where already required.
- Global `--json` remains the only canonical machine envelope.
- Existing aliases and option spellings remain executable indefinitely.
- No direct edits to private Claude/Codex profile files; use supported host commands.
- Never run more than one Vitest process.

**Error handling:**

- Selector and offline errors happen before mutation.
- Destructive apply requires the exact current plan identity.
- A surface failure is recorded with its completed effects and targeted recovery; independent later surfaces may still run.
- An observed effect absent from the authorized plan blocks that surface before mutation and returns a fresh-plan action.

**Gotchas:**

- Core removal must retain prerequisites owned by an unselected Cursor installation.
- `setup --yes` is compatibility syntax, not destructive consent.
- Host installation is not activation; Claude reload and Codex app restart/new task remain action-required until proof.
- Architecture `--stage` currently means both index input and staged output, while `--staged` means index input only.

**Open questions:** none.

## References

- `ARCHITECTURE.md`, “Typed CLI Execution and Discovery”
- `ARCHITECTURE.md`, Codex/Claude profile delivery decisions
- `packages/cli/src/cli-protocol/`
- `packages/cli/src/reconcile.ts` and `packages/cli/src/schema.ts`
- [Command Line Interface Guidelines](https://clig.dev/)
- [Commander 15.0.0 documentation](https://github.com/tj/commander.js/blob/v15.0.0/Readme.md)

