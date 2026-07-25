# Design: Host JavaScript toolchain dispatch

**Related:** [spec.md](./spec.md) | [test-definitions.md](./test-definitions.md) | [feature source](../../../features/honor-host-toolchains.feature)

## Architecture

The shared post-edit `lintFile` entry point becomes the single dispatch boundary for JavaScript and TypeScript files. Before Safeword's current ESLint/Prettier branch, it resolves a recognized Biome-backed owner from the edited file's canonical ancestry. A recognized, runnable owner consumes the file with its own adapter; an unavailable recognized owner returns a warning without a generic JavaScript fallback. All other owners retain the current lint path.

```text
agent edit → lintFile → resolveHostToolchain(file, canonical root)
  ├─ Ultracite owner → local ultracite fix/check
  ├─ direct Biome owner → local biome check --write/check
  ├─ recognized but unavailable → warning, no fallback
  └─ no recognized owner → existing ESLint/Prettier policy
```

## Components

### Component 1: Host-toolchain resolver

**What:** Resolves the nearest supported configuration directory and its safe executable context for one edited file.

**Where:** `packages/cli/templates/hooks/lib/host-toolchain.ts`

**Interface:**

```ts
type HostToolchain =
  | { kind: 'ultracite'; cwd: string; executable: string; relativeFile: string }
  | { kind: 'biome'; cwd: string; executable: string; relativeFile: string }
  | { kind: 'unavailable'; owner: 'ultracite' | 'biome'; cwd: string }
  | { kind: 'outside-root'; file: string; root: string };

function resolveHostToolchain(file: string, projectRoot: string): HostToolchain | undefined;
```

**Dependencies:** Node filesystem/path APIs only; canonical paths via `realpathSync`.

**Tests:** R1/R4/R6/R7 resolution, precedence, filename, containment, and local-binary cases.

### Component 2: Host-toolchain runner

**What:** Executes the chosen adapter as `Bun.spawn` argv arrays with owner cwd and a sanitized environment, then returns diagnostics or warnings to `lintFile`.

**Where:** `packages/cli/templates/hooks/lib/host-toolchain.ts`

**Interface:**

```ts
async function runHostToolchain(owner: Extract<HostToolchain, { executable: string }>): Promise<LintResult>;
```

**Dependencies:** Resolver result; `Bun.spawn` with `shell: false` semantics; removes `BIOME_CONFIG_PATH` and `BIOME_BINARY`.

**Tests:** R1/R3/R5/R6 exact commands, error propagation, exclusions, and no fallback.

## Data Model

No persistent data model. Resolver results are ephemeral, fully canonicalized command descriptions for one file edit.

## Component Interaction

`lintFile` first excludes Safeword-managed paths, then calls the resolver for JavaScript extensions. A runnable result goes to the runner; `unavailable` and `outside-root` return warnings; `undefined` retains the existing ESLint/Prettier behavior. Claude and Cursor already call `lintFile`; Codex routes PostToolUse edits through the same shared entry point.

## User Flow

1. An agent edits `apps/web/src/a.ts`.
2. The hook finds the nearest in-project Biome config, recognizes Ultracite first when its preset is extended, and resolves only `node_modules/.bin` ancestors up to the canonical Safeword root.
3. The hook runs the owner's checked fix/check sequence from that owner directory, with a relative operand and no ambient Biome overrides.
4. Remaining host diagnostics are surfaced through the existing hook result channel.

## Key Decisions

### Dedicated resolver/runner module

**What:** Add a small host-toolchain module instead of growing root-only formatter detection in `lint-config.ts`.

**Why:** Per-file canonical ancestry, executable lookup, and command dispatch are different responsibilities from session warning detection. The new pure-ish resolver makes nested-workspace and containment tests deterministic.

**Trade-off:** One more template file and explicit shared types.

### Owner-relative command context

**What:** Execute in the configuration directory and pass a `--`-guarded owner-relative file operand.

**Why:** Biome configuration resolution and VCS-root interpretation are cwd-sensitive; its CLI documents `--config-path`/`BIOME_CONFIG_PATH` as overrides. [Biome CLI](https://biomejs.dev/reference/cli/) [Biome configuration](https://biomejs.dev/reference/configuration/)

**Trade-off:** The hook must calculate relative paths and reject canonical paths outside the project.

## Implementation Notes

**Constraints:** Do not edit host configuration, dependencies, editor settings, or hooks. Do not use PATH, `bunx`, `npx`, or download-capable resolution for a recognized owner.

**Error handling:** A host check's non-zero output becomes `LintResult.errors`; a missing local binary becomes one actionable `LintResult.warning`; unsupported formatters remain on the pre-existing branch.

**Gotchas:** Ultracite is selected before direct Biome when config `extends` contains `ultracite/core` or `ultracite/biome/`; clear both Biome override variables for either adapter; use canonical containment rather than string prefixes.

**Open questions:** None.

## References

- [Biome CLI](https://biomejs.dev/reference/cli/)
- [Biome configuration](https://biomejs.dev/reference/configuration/)
- [Ultracite CLI and presets](https://github.com/haydenbleasel/ultracite)
