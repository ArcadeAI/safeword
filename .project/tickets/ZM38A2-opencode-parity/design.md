# Design: OpenCode parity

**Related:** [spec.md](./spec.md) | [test-definitions.md](./test-definitions.md)

## Architecture

Keep one host-neutral lifecycle coordinator and put host-specific behavior behind
typed adapters. OpenCode adds two native surfaces: declarative project catalogue
stubs and one managed profile plugin. The plugin translates stable OpenCode
lifecycle events into Safeword's existing guard envelope; the CLI owns profile
installation, evidence, status, and exact-version conformance.

No new runtime dependency or persistence abstraction is introduced. Existing
schema reconciliation remains authoritative for project files; the OpenCode
profile transaction reuses the durable-write and lock patterns already proven
for Codex.

## Components

### Integration registry

**What:** Declares selection, owned/shared surfaces, lifecycle capabilities,
profile support, evidence policy, and the existing `observe`, `install`,
`uninstall`, and `effects` operations for Claude, Codex, OpenCode, and Cursor.

**Where:** `packages/cli/src/lifecycle/integrations.ts`

```typescript
interface IntegrationAdapter {
  readonly id: AgentIntegration;
  readonly defaultSelected: boolean;
  readonly project: ProjectSurfaceDescriptor;
  readonly profile?: ProfileDescriptor;
  readonly capabilities: LifecycleCapabilities;
  observe(context: LifecycleContext): Promise<CliResult>;
  install(context: LifecycleContext): Promise<CliResult>;
  uninstall(context: LifecycleContext): Promise<CliResult>;
  effects(context: LifecycleContext): Promise<Effects>;
}
```

**Tests:** SWM1.R1–R3 and origin-main compatibility fixtures.

### OpenCode profile boundary

**What:** Resolves the documented config root, classifies ownership without
following managed-path symlinks, and atomically installs/removes the plugin,
identity, and bounded evidence under one profile lock.

**Where:** `packages/cli/src/opencode/profile.ts`, `identity.ts`, `evidence.ts`

```typescript
interface OpenCodeIdentityV1 {
  readonly schema_version: 1;
  readonly safeword_version: string;
  readonly plugin_path: 'plugins/safeword.js';
  readonly plugin_sha256: string;
  readonly runtime_path: string;
  readonly dispatcher_path: string;
  readonly dispatcher_sha256: string;
}

interface PlatformEnvironment {
  readonly platform: 'unix' | 'windows';
  readonly env: Readonly<Record<string, string | undefined>>;
}

type ProfileOwnership =
  | 'absent'
  | 'managed'
  | 'managed-drift'
  | 'partial'
  | 'collision';
```

**Tests:** TBU1.R1/R3 resolver, collision, atomicity, concurrency, read-only
status, and cross-project uninstall scenarios.

Profile and catalogue targets are both preflighted before either commits.
Profile installation then commits before project reconciliation starts. A known
collision or profile failure changes neither surface; a later catalogue-commit
failure retains the already-committed machine-wide guard and reports the project
surface incomplete rather than rolling back protection used by other projects.

### Generated OpenCode plugin and dispatcher

**What:** Stays inert outside marked projects, maps covered OpenCode inputs into
the independently pinned Safeword guard envelope, invokes the identity-bound
dispatcher without a shell, and records bounded observations. Marker uncertainty
self-disables; confirmed-project mapping or dispatcher failures deny closed.

Project enrollment reuses `.safeword/SAFEWORD.md` through the existing
`hasSafewordProjectMarker` helper. Marker lookup has a 50 ms fail-open deadline
and is rechecked per event so enrollment changes take effect without restart.
Only after a project is confirmed marked, the first handled hook races
`client.global.health()` against a 100 ms fail-open deadline and caches the
settled optional version for that plugin process. Unmarked projects make no SDK
call, and timeout leaves activation version absent.

**Where:** `packages/cli/src/opencode/plugin.ts`, `dispatcher.ts`, generated
`plugins/safeword.js`

The dispatcher is package-internal and absent from top-level help. Identity
binds its absolute install-time path and hash plus the installer's absolute
`process.execPath`. The dispatcher is Node/Bun-compatible, and the plugin invokes
the recorded runtime and dispatcher directly, without package-manager or network
resolution on the hook path. Status treats either missing path as one unavailable
dispatcher binding (`installed=false`, one reinstall action);
confirmed-project repair scenarios cover a missing, moved, changed, or pruned
binding.

**Tests:** TBU1.R2 integration plus the TBU1.R4 real-process sentinel control.

### Catalogue, conformance, and health

**What:** Generates thin plural-form command/agent stubs from canonical
inventories, runs the credential-free exact-version conformance fixture, and
projects installation, activation, blocking capability, and conformance into
one summary and at most one action.

**Where:** `packages/cli/src/opencode/catalogue.ts`, `conformance.ts`, `status.ts`

**Tests:** TBU1.R1/R4 and NTB1.R1–R3.

Conformance copies the current managed plugin bytes and matching identity hash
into its isolated profile. Armed and disarmed policies exist only in separate
temporary fixture projects; neither reads or changes the user's project policy.

The coordinator is constructed as `createLifecycleCoordinator(registry =
PRODUCTION_INTEGRATIONS)`, allowing contract tests to inject a sentinel registry
without adding it to production. The public `conformance` leaf declares
`effectClass: 'mutate'`, `promptPolicy: 'never'`, and `networkPolicy: 'never'`;
its only durable effect is the bounded profile evidence file.

## Data Model

The profile identity is the ownership source of truth. Activation is keyed by
canonical project hash; conformance is keyed by OpenCode version and plugin
hash; the single profile-error record contains only marker-resolution failure
metadata. All records are schema-versioned JSON, written atomically, validated
before use, and removed only within the explicit uninstall scope defined by the
feature scenarios.

## Component Interaction

`CLI command → integration registry → selected adapter → project reconciliation/profile transaction`

`OpenCode event → generated plugin → project classification → canonical guard dispatcher → allow/deny + bounded evidence`

`status → adapter observations → four OpenCode dimensions → one summary/action`

## User Flow

1. A builder runs `safeword install --agents=opencode`.
2. Safeword installs plural declarative catalogue stubs and the profile plugin
   without editing `opencode.json` or changing future defaults.
3. OpenCode loads the profile plugin; marked projects use Safeword's guard,
   while unrelated projects remain untouched.
4. `safeword status --agents=opencode` reports the four dimensions and, when
   needed, one concrete repair command.

## Key Decisions

### Keep the registry descriptive

**What:** Four existing operations plus descriptors; no host-specific operation
or generic plugin framework.

**Why:** It removes coordinator branching while preserving native trust and
migration behavior.

**Trade-off:** Adapters remain intentionally unequal where host APIs differ.

### Use files, not live IPC, for initial proof

**What:** Bounded identity/activation/conformance records under the resolved
profile root.

**Why:** The approved behavior needs current execution evidence, not exact-call
liveness, and atomic files reuse proven repository patterns.

**Trade-off:** Activation is recent observation rather than live-process proof.

## Implementation Notes

- TypeScript 5.9.3, Vitest 4.1.10, and Cucumber 13.2.1 remain the installed toolchain.
- Run only one Vitest process at a time.
- OpenCode 1.18.23 CLI/TUI is the required real-process baseline; Desktop and
  V2 remain unsupported.
- The stable plugin input has no host-version field. The generated module keeps
  top-level load inert, relies on OpenCode's isolated external-plugin loader,
  and earns support only through exact-version conformance.
- Profile paths are never followed through symlinks for ownership or deletion.
- No unresolved implementation questions remain; host-contract disagreement
  returns the ticket to scenario-gate.

## References

- [OpenCode plugin contract](https://github.com/anomalyco/opencode/blob/ef2880f379129aa048be9e9353e30aa168d42c17/packages/plugin/src/index.ts)
- [OpenCode config loader](https://github.com/anomalyco/opencode/blob/ef2880f379129aa048be9e9353e30aa168d42c17/packages/opencode/src/config/config.ts)
- [Architecture decision](../../../ARCHITECTURE.md#registry-driven-agent-integrations-with-native-trust-boundaries)
