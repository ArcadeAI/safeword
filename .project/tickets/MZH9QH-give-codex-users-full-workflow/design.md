# Design: Give Codex users the full Safe Word workflow

**Related:** [Feature spec](./spec.md) | [Test definitions](./test-definitions.md)

## Architecture

Safe Word will derive the checked-in Codex plugin catalogue from the canonical
`packages/cli/templates/skills/` source. The generated directory remains a
normal package asset, so Codex installs it into its profile cache and never
needs a workflow tree in the target repository. A release contract compares the
generated result with the committed plugin, then verifies the packed tarball;
an isolated live test verifies the installed cache rather than the source tree.

Migration becomes intentionally two-step. `safeword migrate codex-plugin`
installs and enables the profile plugin but never edits legacy hooks. After the
builder reviews those hooks through Codex `/hooks`, an explicit
`--remove-legacy-hooks` action removes Safe Word-owned hook blocks only. Codex,
not Safe Word, remains the authority for hook trust.

```text
canonical templates/skills/
        | deterministic allowlisted generation
        v
codex-plugin/skills/ -- bun pm pack --> installed Codex profile cache
        |                                   |
        | release/package contracts         | real isolated session
        v                                   v
source drift rejected                 scoped skills; no project workflow tree

migrate codex-plugin --> profile plugin enabled; legacy hooks retained
  + --remove-legacy-hooks --> Safe Word legacy blocks removed after confirmation
```

## Components

### Component 1: Catalogue transformer

**What:** Read canonical skills and produce a deterministic virtual file set for
`codex-plugin/skills/`.

**Where:** `packages/cli/src/codex-plugin/catalogue.ts`

**Interface:**

```ts
type PluginFile = Readonly<{ path: string; content: string }>;

type Catalogue = Readonly<{
  files: readonly PluginFile[];
  skills: readonly string[];
  metadataCharacters: number;
}>;

function generateCodexCatalogue(canonicalSkillsDirectory: string): Catalogue;
function assertCommittedCatalogueMatches(catalogue: Catalogue, pluginDirectory: string): void;
```

The transformer walks regular Markdown files in sorted order. Each canonical
`SKILL.md` becomes an entry with only Codex-supported `name` and `description`
metadata. Each companion Markdown file moves under the owning skill's
`references/` directory. It permits only source-only metadata removal,
`safeword:<skill>` invocation rewrites, and rewritten sibling-reference paths.
Unknown metadata or reference forms fail until a maintainer extends the
allowlist deliberately.

**Dependencies:** Node filesystem/path APIs and the existing `yaml` dependency.

**Tests:** `workflow-maintenance.SWM1.R1` plus the source side of `R2` and
`R3`, including `tests/persona-code-policy.test.ts` against the generated BDD
reference paths rather than retired repository-local Codex workflow files.

### Component 2: Generated plugin artifact

**What:** Materialize the virtual catalogue as a checked-in package asset, not a
customer-runtime dependency.

**Where:** `packages/cli/scripts/generate-codex-plugin.ts` and
`packages/cli/codex-plugin/skills/`

**Interface:**

```ts
function writeCodexCatalogue(input: {
  canonicalSkillsDirectory: string;
  outputDirectory: string;
}): void;
```

The writer replaces only the generated `skills/` subtree. It does not modify
the manifest or hooks. Contributors run the explicit script after changing a
canonical skill; release tests reject a stale committed artifact. The tarball
therefore contains the exact catalogue that tests inspected.

**Dependencies:** Component 1 and the existing `codex-plugin/` bundle.

**Tests:** committed-artifact comparison, package inventory, and metadata budget
contracts.

### Component 3: Staged migration command and safe legacy cleanup

**What:** Separate plugin installation from destructive legacy-hook cleanup.

**Where:** `packages/cli/src/cli.ts`,
`packages/cli/src/commands/migrate-codex-plugin.ts`,
`packages/cli/src/codex-plugin/legacy-hooks.ts`, and command tests.

**Interface:**

```ts
type CodexMigrationOptions = Readonly<{ removeLegacyHooks?: boolean }>;

function migrateCodexPlugin(cwd?: string, options?: CodexMigrationOptions): void;
```

Without the option, the command preflights Bun/Codex, adds the marketplace and
plugin, verifies the exact plugin is enabled, preserves project configuration,
and prints `/hooks` then `--remove-legacy-hooks` recovery steps. With the
option, it verifies that the already-installed plugin is still enabled and
removes only Safe Word-owned hook stanzas. Cleanup never refreshes or reinstalls
the plugin: that could change a hook definition after the user reviewed it.
Neither path reads, writes, or claims to verify Codex trust state.

Cleanup first parses TOML with a direct `smol-toml` dependency solely to reject
malformed input before mutation. A separate fail-closed raw-text scanner then
recognizes only unquoted complete headers for the current Codex event list and
their `.hooks` arrays. It accepts a candidate handler only when it contains one
bare `command` assignment with a single-line TOML string; `smol-toml` decodes
the actual value before it can match one of the four known Safe Word command
markers. Comments, unrelated fields, quoted/dotted keys, multiline values,
duplicate commands, and unrecognized interleaving can never make a handler
owned: unsupported candidate syntax aborts cleanup without mutation.

The scanner deletes only owned handler byte ranges. It removes a parent group
only if its complete non-comment content is the known Safe Word scaffold and
all nested handlers are owned; otherwise it retains every non-deleted byte,
including comments, CRLF, and a missing final newline.

Before a change, cleanup writes the exact pre-mutation bytes to a same-directory
temporary file, fsyncs it, and creates `.codex/config.toml.safeword.bak` through
an exclusive same-filesystem link. If that backup already exists or the link
races, cleanup fails without changing the config rather than misrepresenting a
stale backup as this operation's recovery point. The new config is written to a
second same-directory temporary file with the original mode, fsynced, and
atomically renamed into place. A parse, scan, backup, write, or rename failure
leaves the original config intact; post-backup failures leave an exact recovery
backup and no temporary files.

**Dependencies:** Codex plugin CLI at the process boundary, Node filesystem
APIs, and a direct `smol-toml` parser dependency used only for validation.

**Tests:** `codex-workflow.TBU1.R2` and `TBU1.R3`.

### Component 4: Distribution and trust proofs

**What:** Verify source, packed tarball, isolated cache, and real Codex runtime
boundaries separately.

**Where:** release tests, `features/steps/give-codex-users-full-workflow.steps.ts`,
`tests/commands/migrate-codex-plugin.test.ts`, and
`tests/smoke/codex-parity.live.test.ts`

**Interface:** no production interface; this is the executable delivery
contract.

The release test creates a real `bun pm pack` tarball, extracts it, and builds a
temporary marketplace whose plugin source is the extracted package's
`codex-plugin/` directory. It parses `plugin add --json`, requires its
`installedPath` to resolve as a non-symlink child of the isolated profile cache,
then removes the tarball, marketplace, and extraction. Only then does it start
a new isolated Codex session and inspect that cache. A fixture project copy and
a deleted cache asset must produce the named missing-cache failure. That makes
source, marketplace, and project copies unable to hide a missing cache asset.

The automated no-bypass `codex exec --json` smoke asserts an absent unique hook
marker, because that machine-readable path currently does not include Codex's
interactive warning. Its Bunx shim reads the installed package version from
`packages/cli/package.json`; it must never hard-code a release version. The required manual acceptance starts the interactive
Codex TUI from the isolated profile and records the visible `Hooks need review`
screen with `/hooks` remediation, then changes the actual installed cache
definition after trust to confirm Codex asks for review again. The procedure
records `codex --version` and the `installedPath` returned by `plugin add`.
No private trust state or trust-bypass flag is used as trust evidence; a
separate bypassed session may prove only packaged command dispatch.

The Cucumber step file stays thin: it creates fixtures and calls the public CLI
or release-contract helpers, while assertions remain observable package, cache,
or project outcomes. Both interactive-warning scenarios are `@live @manual`,
so ordinary `test:bdd` remains local and deterministic.

**Dependencies:** real `codex`, an authenticated local profile, and Bun for the
opt-in live lane.

**Tests:** `codex-workflow.TBU1.R1`, `TBU1.R4`, and
`workflow-maintenance.SWM1.R2` through `R4`.

## Data Model

No persistent Safe Word data is added. The new model is an in-memory catalogue
of path/content pairs. Its invariants are unique sorted paths, one entry point
per source skill, one reference destination per companion file, and an explicit
allowlist explanation for every output difference.

## Component Interaction

1. The generator reads canonical content and returns a virtual catalogue.
2. The writer materializes it in the package's plugin directory.
3. Release tests compare materialized files to that virtual catalogue and a
   real extracted `bun pm pack` tarball.
4. Migration installs the profile plugin and preserves legacy project hooks.
5. Codex itself skips untrusted plugin hooks; its interactive TUI sends the
   builder to `/hooks`.
6. Only the explicit cleanup command removes Safe Word legacy hooks.

## User Flow

1. The builder runs `bunx safeword@<version> migrate codex-plugin` in a legacy
   project.
2. Safe Word enables the profile plugin and states that existing hooks remain.
3. The builder starts Codex, opens `/hooks`, and reviews Safe Word's hooks.
4. The builder runs `bunx safeword@<version> migrate codex-plugin
--remove-legacy-hooks`.
5. Safe Word removes its legacy registrations while retaining custom Codex
   configuration.

## Key Decisions

### Decision 1: Generate a checked-in package artifact

**What:** A pure generator plus explicit writer produces committed plugin skills.

**Why:** Codex plugins package skills and optional references under the plugin
root, and an installed plugin takes effect in a new session. A static artifact
lets release and isolated-cache tests inspect exactly what users receive.
[Build plugins](https://learn.chatgpt.com/docs/build-plugins) and
[Plugins](https://learn.chatgpt.com/docs/plugins) document this model.

**Trade-off:** Contributors must run a generator after source-skill changes; the
release contract makes a missed step loud.

### Decision 2: Use a strict allowlisted transformer

**What:** Preserve source body text except three documented adaptations and
reject unfamiliar source shapes.

**Why:** Codex skills require `name` and `description`, permit `references/`,
and use an initial metadata list limited to 8,000 characters when context size
is unknown. A narrow transformer preserves canonical workflow meaning while
making Codex packaging explicit. [Build skills](https://learn.chatgpt.com/docs/build-skills).

**Trade-off:** New canonical syntax blocks generation until reviewed, rather
than flowing through silently.

### Decision 3: Make cleanup an explicit `--remove-legacy-hooks` action

**What:** Initial migration never removes project hooks; a named destructive
flag does so later.

**Why:** Codex plugin enablement does not trust bundled hooks. Codex skips them
until a user reviews them through `/hooks`, and its CLI has no supported trust
query. The descriptive flag states exactly what Safe Word can prove and what the
user must decide. [Hooks](https://learn.chatgpt.com/docs/hooks).

**Trade-off:** Migration has two commands. One command that installs a plugin
and deletes working legacy gates could leave users without enforcement.

### Decision 4: Layer release contracts under one real live smoke

**What:** Use fast source/package contracts for exhaustive inventory and one
opt-in isolated Codex session for cache/trust wiring.

**Why:** Static tests cover every generated file cheaply. Only a real Codex
session proves plugin loading and review-required non-execution. The process
boundary is Bunx/package installation; Safe Word collaborators remain real.

**Trade-off:** The live smoke consumes authenticated Codex resources and the
changed-hook regression remains manual until Codex ships a public automation API.

## Implementation Notes

**Constraints:** Bun only; no `npx` or Node fallback; source templates remain
canonical; Claude Code/Cursor behavior remains unchanged; no project-local
workflow assets; no Codex Cloud support; hooks remain version-pinned Bunx.

**Error handling:** Failed initial installation or a missing/disabled plugin
returns non-zero with remediation and leaves the project unchanged. Cleanup
checks enabled status and valid TOML before touching the project, writes an
accurate backup atomically, and refuses a second mutation with a stale backup.
Codex's interactive skipped-hook screen is the loud failure mode for stale or
unreviewed definitions; the migration command also tells the builder to use
`/hooks` before cleanup.

**Gotchas:** The bypassed smoke is not trust evidence. Cleanup must not add or
refresh a plugin because that could invalidate a prior manual hook review.

**Open questions:** None. The lack of a public trust API is a product constraint,
not a Safe Word implementation gap.

## References

- [Build plugins](https://learn.chatgpt.com/docs/build-plugins)
- [Build skills](https://learn.chatgpt.com/docs/build-skills)
- [Hooks](https://learn.chatgpt.com/docs/hooks)
- [Plugins](https://learn.chatgpt.com/docs/plugins)
- [Existing migration plan](../YH2ZRN-migrate-codex-to-plugin/impl-plan.md)
