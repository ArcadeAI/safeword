# Design: Coherent cachebusted Codex plugin bundles

**Related:** [Feature spec](./spec.md) | [Scenarios](../../../features/keep-cachebusted-codex-plugins-operational.feature)

## Architecture

The existing Codex generator gains an explicit effective-version/output mode:

```text
bun scripts/generate-codex-plugin.ts \
  --version 0.83.1+codex.20260909051010 \
  --output /fresh/path/safeword-codex-plugin
```

The generator validates that the requested value is SemVer and names the same
core and prerelease as the package version. It then generates a complete bundle
in a fresh directory adjacent to the requested output. Only after the manifest,
package metadata, runtime, skills, templates, and hooks are complete is that
directory atomically moved into place. Default generation keeps using the
package version and the checked-in `packages/cli/codex-plugin` target.

```text
effective version
      |
      +--> plugin.json + package.json
      +--> Bun build define --> runtime/cli.js
      +--> catalogue adapter --> skill runtime paths
      +--> installed hook proof/status identity
```

## Components

### Component 1: Effective-version policy

**What:** Parse generator options and accept only the package version or that
same release identity with SemVer build metadata.

**Where:** `packages/cli/scripts/lib/codex-plugin-generation.ts`

**Interface:**

```typescript
interface CodexPluginGenerationOptions {
  checkOnly: boolean;
  effectiveVersion: string;
  outputDirectory?: string;
}

function parseCodexPluginGenerationOptions(
  arguments_: readonly string[],
  packageVersion: string,
): CodexPluginGenerationOptions;
```

**Dependencies:** Existing `isSafePackageVersion`; Node path/filesystem APIs.

**Tests:** Accepted base/suffixed values, malformed and different-release
rejections, incompatible flag combinations, and rejection before target creation.

### Component 2: Complete bundle generator

**What:** Feed one effective version to every version-bearing output and publish
a fresh custom bundle only after successful generation.

**Where:** `packages/cli/scripts/generate-codex-plugin.ts` and
`packages/cli/scripts/lib/build-plugin-cli-bundle.ts`

**Interface:** The existing bundle builder accepts an optional build-time
version. Default callers omit it and retain current bytes; a cachebusted Codex
build injects `__SAFEWORD_VERSION__`.

**Dependencies:** Existing catalogue writer and generated-tree reconciler.

**Tests:** Real generator subprocess, real generated runtime execution, and real
`codex plugin add` against the generated marketplace fixture.

## Component Interaction

1. Parse and validate options before any output target exists.
2. Build the bundled CLI with the effective version injected only when it differs
   from the package version.
3. Rewrite a copied plugin manifest and write package metadata with that version.
4. Generate skill commands with the same version and copy version-neutral hooks.
5. For a custom output, atomically publish the complete fresh directory; for the
   default release path, retain the existing reconciliation behavior.

## Key Decisions

### Decision 1: Explicit effective version, not cache discovery

**What:** The release/cachebuster caller supplies the exact effective version.

**Why:** Immutable bundle identity stays deterministic and two installed versions
cannot compete during runtime resolution.

**Trade-off:** The cachebuster must call Safeword's generator rather than rewrite
only the manifest.

### Decision 2: Build-time runtime identity

**What:** Inject `__SAFEWORD_VERSION__` into cachebusted runtime bundles.

**Why:** The runtime must report the same identity even though the source package
remains at the base npm version.

**Trade-off:** Cachebusted runtime bytes intentionally differ from the default
release runtime; default Codex and Claude bundles remain unchanged.

### Decision 3: Fresh output with atomic publication

**What:** Require a nonexistent custom output path and rename a completed adjacent
temporary directory into place.

**Why:** Invalid input or failed generation cannot leave a mixed-version bundle.

**Trade-off:** Callers must choose a fresh destination instead of updating one in
place.

## Upstream Codex contract

Codex should expose a task-bound `PLUGIN_ROOT` (or equivalent structured value)
to shell commands rendered from an installed skill. The value should identify
the exact immutable plugin directory whose catalogue entry activated that skill,
remain fixed for the task, and be unavailable to unrelated plugin content. Skill
commands could then use `bun "${PLUGIN_ROOT}/runtime/cli.js"`, matching the hook
contract and removing versioned home-directory paths from generated Markdown.

Host adoption is a non-dependency for this delivery. Safeword will continue to
generate exact versioned skill paths for the current Codex interface; the
proposal is independently adoptable later and would simplify that adapter.

## Implementation Notes

- Do not modify canonical Claude skills, Cursor wrappers, or shared runtime
  resolution.
- Do not use symlinks, mutable aliases, globs, or cache scans.
- Reject unknown/duplicate options and broad or existing custom output targets.
- The design-record scenario validates this section and its explicit
  non-dependency statement.

## References

- [OpenAI plugin structure](https://developers.openai.com/plugins/build/plugins)
- [OpenAI skill creation and restart behavior](https://learn.chatgpt.com/docs/build-skills)
- Existing immutable/restart-bound decision:
  `.project/tickets/4S2S8V-codex-plugin-next-task-upgrades/design.md`
