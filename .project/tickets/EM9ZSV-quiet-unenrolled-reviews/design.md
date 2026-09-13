# Design: Point-of-need Safeword project contexts

**Guide:** `.safeword/guides/design-doc-guide.md`
**Related:** `spec.md`, `dimensions.md`, `test-definitions.md`

## Architecture

Safeword will resolve a logical project context before any stateful workflow reads or writes project data. Resolution is read-only: inspect the current repository marker, enrolled ancestors, and the exact global partition. A current local context wins; an existing checkout-global context wins over an unrelated enrolled ancestor; otherwise an interactive adapter offers the containing project, current-repository setup, and automatic private global storage. Any outcome other than builder-approved local setup selects global storage without a second prompt.

Global storage is a real context, not a cache and not a union filesystem. Git projects use a two-level identity derived from canonical paths returned by Git: the common Git directory identifies shared project knowledge and the worktree Git directory identifies mutable execution state. Non-Git directories use their canonical path for both identities. Only hashes appear in storage directory names.

```text
stateful workflow / owned-path boundary
                  |
                  v
       project-context resolver
       /       |        |       \
   local   exact global ancestor  unresolved
     |          |          |         |
     |          |       one choice <-+
     |          |          |
     +----------+----------+
                |
                v
   ProjectStorageContext
   workspaceRoot + namespaceRoot + stateRoot
                |
       workflow reads / writes

later explicit install
  global snapshot -> canonical plan -> conflict check -> hydrate + verify
                                                    -> activation receipt last
```

## Components

### Component 1: Project identity and private global store

**What:** Derive stable-within-scope project and worktree identities and map them to owner-private storage outside the repository.

**Where:** `packages/cli/src/project-context/identity.ts`, `packages/cli/src/project-context/global-store.ts`

```typescript
interface ProjectIdentity {
  kind: 'git' | 'directory';
  projectKey: string;
  worktreeKey: string;
}

interface GlobalProjectPaths {
  partitionRoot: string;
  namespaceRoot: string;
  stateRoot: string;
}

function resolveProjectIdentity(cwd: string): ProjectIdentity;
function resolveGlobalProjectPaths(identity: ProjectIdentity): GlobalProjectPaths;
```

For Git, `projectKey` hashes the canonical absolute `git rev-parse --git-common-dir` result and `worktreeKey` hashes the canonical absolute `git rev-parse --absolute-git-dir` result. For non-Git directories both hash the canonical directory. The user data root is `XDG_DATA_HOME/safeword` when valid, `~/.local/share/safeword` on Unix otherwise, and `LOCALAPPDATA/Safeword` on Windows with a user-profile fallback. Directories are created owner-only where the platform supports POSIX modes; files use durable writes and owner-only modes.

**Tests:** identity reuse/isolation, linked worktrees, non-Git paths, invalid or unavailable user data roots, path-hash privacy, permissions, and real Git-process wiring.

### Component 2: Project-context resolver and route catalogue

**What:** Select one authoritative storage context before state access and prove that every shipped state-access route crosses the boundary.

**Where:** `packages/cli/src/project-context/resolver.ts`, `packages/cli/src/project-context/catalogue.ts`, `packages/cli/src/project-context/types.ts`, with a generated hook-side adapter registered in `packages/cli/src/schema.ts`

```typescript
interface ProjectStorageContext {
  authority: 'local' | 'global' | 'containing-project';
  workspaceRoot: string;
  namespaceRoot: string;
  stateRoot: string;
}

type ContextResolution =
  | { kind: 'ready'; context: ProjectStorageContext }
  | { kind: 'choice-required'; choices: readonly ContextChoice[] }
  | { kind: 'global-unavailable'; recovery: string };

function resolveProjectContext(need: ProjectStateNeed): ContextResolution;
```

Authority is root-level. An active local namespace never falls through to individual global files; missing local authored knowledge therefore retains today's missing-knowledge behavior. If the local overlay is absent, the preserved global context becomes authoritative as a whole. Existing enrolled projects without a global partition remain active without a new receipt.

**Tests:** all R1/R5 precedence and regression scenarios, positive and negative catalogue parity, independent filesystem observation, configured namespaces, and installed-artifact/real-command entry points.

### Component 3: Enrollment and resume coordinator

**What:** Present the native host choice, validate that acceptance came from builder input, enter the existing lifecycle preview/apply boundary, and resume the initiating operation exactly once from the selected context.

**Where:** `packages/cli/src/project-context/coordinator.ts`, `packages/cli/src/cli-protocol/` handlers, and thin Claude/Codex/OpenCode/Cursor adapters

```typescript
interface EnrollmentPorts {
  choose(choices: readonly ContextChoice[]): Promise<ChoiceResult>;
  previewLocalInstall(intent: InstallIntent): Promise<CliPlan>;
  approve(plan: CliPlan): Promise<ApprovalResult>;
  apply(plan: CliPlan): Promise<CliResult>;
}

type EnrollmentOutcome =
  | { kind: 'resume'; context: ProjectStorageContext; installResult?: CliResult }
  | { kind: 'stop'; recovery: string };
```

The operation owns an in-memory consume-once resume token. It rechecks the current marker and required setup after the choice to handle concurrent installation. Decline, noninteractive silence, interruption, agent-authored acceptance, and install cancellation all converge on the same global selection. Global-store failure stops plainly and never writes the repository.

**Tests:** R2–R4 decision tables, host input provenance, bounded effect observation, concurrent drift, partial/failed install results, duplicate resume triggers, and one real pinned Claude flow.

### Component 4: Plan-driven hydration and overlay activation

**What:** Extend the canonical install plan with compatible global data, surface conflicts, verify every planned local record, and activate local authority only after verification.

**Where:** `packages/cli/src/project-context/hydration.ts`, `packages/cli/src/lifecycle/project-install.ts`, `packages/cli/src/reconcile.ts`

```typescript
interface OverlayActivationReceipt {
  schemaVersion: 1;
  partitionKey: string;
  snapshotDigest: string;
}

interface HydrationPlan {
  effects: readonly PlannedEffect[];
  conflicts: readonly HydrationConflict[];
  activationReceipt?: OverlayActivationReceipt;
}
```

Hydration maps global knowledge into the selected local namespace and the current worktree's mutable state into local Safeword state. Identical destinations are no-ops. A differing destination is a named plan conflict and receives no overwrite choice until the builder resolves it. The global snapshot is read-only throughout install; the activation receipt is the final planned local effect and is written only after verification. Cancellation or failure leaves global authoritative and unchanged. Later local writes never update global.

**Tests:** every R6 source/completion/overlay/namespace partition, plan-effect identity, conflict and corruption handling, activation-last ordering, and local/global byte snapshots.

## Data Model

```text
<user-data>/safeword/project-contexts/v1/<projectKey>/
  partition.json                 # schema and non-secret hash identity metadata
  knowledge/                     # shared by linked worktrees
  worktrees/<worktreeKey>/state/ # mutable state isolated per worktree

<repository>/.safeword/project-overlay-v1.json
  schemaVersion
  partitionKey
  snapshotDigest
```

Global content is a preserved pre-install snapshot after local activation. The local namespace and local state are the only write targets while the overlay is active. The activation receipt proves only that the planned snapshot was hydrated and verified; it is not a synchronization cursor.

## Component Interaction

1. A catalogued workflow declares a state need, or an installed host boundary identifies a Safeword-owned target.
2. The resolver performs only current-marker, ancestor-marker, and exact-global checks.
3. A ready local/global/containing context is returned immediately. Otherwise the host adapter presents one choice when interactive.
4. Only recorded builder acceptance enters canonical install preview and approval. Every other result creates or reuses global storage.
5. The coordinator re-resolves after the choice, verifies the initiating requirement, and consumes the resume token once.
6. A later explicit install adds hydration effects to the ordinary plan. The installer refuses unresolved conflicts, verifies local bytes, writes the activation receipt last, and leaves global bytes untouched.

## User Flow

1. The builder asks Safeword to build a feature in a new repository.
2. BDD reaches its first ticket write. Safeword asks once whether to set up the repository and explains that the exact changes will be shown first.
3. Accepting opens the ordinary bounded install plan. Approval installs, hydrates any prior global data, verifies it, and resumes BDD once.
4. Declining, giving no answer, interrupting, or cancelling creates the private global context and continues BDD there without another prompt.
5. If a later branch lacks the activated local overlay, Safeword silently uses the preserved global snapshot. When the local overlay is present, all new writes stay local.
6. If private global storage cannot be used, Safeword stops and names the recovery action; it never substitutes a repository write.

## Key Decisions

### Decision 1: Git-native two-level identity

**What:** Hash Git's common directory for shared knowledge and its worktree Git directory for mutable state; hash the canonical directory outside Git.

**Why:** This directly matches Git's own shared/per-worktree boundary and satisfies worktree sharing without a mutable identity registry.

**Trade-off:** Moving or copying a repository may select a new partition. Transparent arbitrary moves are explicitly out of scope; a future relink command can address demonstrated demand.

### Decision 2: Root-level shadowing, not a union overlay

**What:** Exactly one namespace/state pair is authoritative for an operation. An activated local context wins as a whole; otherwise global wins as a whole.

**Why:** Per-file fallback would resurrect stale global values when local files are intentionally absent and would contradict existing missing-authored-knowledge behavior.

**Trade-off:** A partial local tree cannot borrow individual files from global. Installation must hydrate and verify before activation.

### Decision 3: Hydration is part of canonical installation

**What:** Express copy/no-op/conflict/activation as disclosed lifecycle plan effects and preserve global bytes on every outcome.

**Why:** The existing plan identity is already Safeword's repository mutation authority. A second migrator or lazy copy path would evade reviewed effects.

**Trade-off:** Conflicts interrupt installation for an explicit resolution instead of guessing, which is the accepted synchronization-failure boundary.

### Decision 4: No new dependency

**What:** Use Node's crypto, filesystem, path, child-process, and existing durable-write/reconciliation primitives.

**Why:** The installed Node 22/24/26 contract and Git CLI expose every required primitive.

**Trade-off:** Cross-platform user-data path and permission behavior remain Safeword-owned code with focused tests.

## Implementation Notes

**Constraints:** Generated Codex plugin files are regenerated, never hand-edited. Template additions are registered in schema. Explicit install/status/doctor/plan/uninstall do not recursively prompt. Customer-owned lookalike paths are never adopted. Global directory names disclose no repository paths.

**Error handling:** Invalid Git discovery falls back only when the directory is genuinely non-Git; malformed Git output for a detected repository stops identity resolution. Global directory creation and permission failures return one recovery-oriented result. Hydration symlinks, unreadable sources, drift, and differing destinations fail closed before overlay activation.

**Gotchas:** The enrollment marker and overlay activation are different facts. A marker can exist after a partial install while global remains authoritative. Existing enrolled repositories with no global partition remain compatible. The global snapshot is not a backup of post-install local work.

**Open questions:** skip: no unresolved product or build decision remains.

## References

- [Git worktree shared and per-worktree metadata](https://git-scm.com/docs/git-worktree)
- [Git rev-parse path discovery](https://git-scm.com/docs/git-rev-parse)
- [XDG Base Directory Specification](https://specifications.freedesktop.org/basedir-spec/latest/)
- [VS Code workspace and global storage](https://code.visualstudio.com/api/extension-capabilities/common-capabilities)
- `ARCHITECTURE.md` — registry-native host boundaries, explicit enrollment, and user-private project contexts
