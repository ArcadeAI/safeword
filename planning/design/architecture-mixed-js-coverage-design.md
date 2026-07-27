# Design: Trustworthy mixed JS/TS architecture coverage

**Related**: Feature Spec:
`planning/user-stories/architecture-mixed-js-coverage.md` | Test Definitions:
`planning/test-definitions/architecture-mixed-js-coverage.md`

## Architecture

Keep the current shallow architecture model, but make JS/TS enumeration a union
of eligible immediate child directories and source files. Build nodes in a map
keyed by module name: insert directories first, then files only when that name is
absent. Sort the final nodes by name. Fingerprints include both names and paths
so a file-backed node that becomes directory-backed cannot retain a stale code
reference. The renderer and prose reconciliation remain unchanged.

## Components

### Component 1: JS source-root enumerator

**What**: Produces the complete, deterministic set of top-level JS/TS concepts.
**Where**: `packages/cli/src/utils/architecture-skeleton.ts`
**Interface**:

```typescript
function enumerateJsSourceRoot(
  directory: string,
  pathFor: (entryName: string) => string,
): SkeletonNode[];
```

**Dependencies**: Existing source-file filters and extension-priority helpers.
**Tests**: Mixed tree, same-name collision, stable ordering.

### Component 2: Architecture guide contract

**What**: Explains the actual ownership boundary of generated docs.
**Where**: `packages/cli/templates/guides/architecture-guide.md`
**Tests**: Template-content assertions for root ownership, machine-owned
structure, and preserved human purpose prose.

## Component interaction

```text
source tree
  → union enumerator
  → canonical {name, path} nodes
  → deterministic document heal
```

## User flow

1. A developer has `src/consolidate/`, `src/consolidate.ts`, and
   `src/generate.ts`.
2. `safeword architecture` extracts `consolidate` once, backed by the directory,
   and `generate` backed by the file.
3. The generated document exposes both architectural concepts.
4. The developer may edit module purpose prose; a later structural heal
   preserves it and marks it stale when appropriate.

## Key decisions

### Decision 1: Union immediate directories and files

**What**: Enumerate both kinds, with directory-wins collision handling.
**Why**: Both files and directories are valid JS/TS module concepts. The current
either/or branch silently truncates common mixed layouts.
**Trade-off**: Existing mixed-package documents intentionally gain sections and
new fingerprints; this is corrective churn.

### Decision 2: Keep discovery shallow

**What**: Do not recursively infer architectural boundaries.
**Why**: The existing contract is a top-level skeleton. Recursion would invent a
new granularity policy and greatly expand output.
**Trade-off**: Nested concepts remain summarized by their top-level directory.

### Decision 3: Fingerprint canonical module identities

**What**: Hash each module's name and canonical path.
**Why**: Directory-wins changes both the selected node kind and its rendered
reference. A name-only fingerprint left an existing `src/auth.ts` reference
unchanged after `src/auth/` appeared.
**Trade-off**: The fingerprint schema moves once for existing documents. This is
required corrective churn to keep generated structural references trustworthy.

### Decision 4: Separate purpose seeding

**What**: Leave placeholders and prose initialization unchanged.
**Why**: Seeding needs provenance and root/leaf fingerprint rules that are
independent of enumeration correctness.
**Trade-off**: This change fixes structural trust but does not reduce placeholder
prose.

## Implementation notes

- Preserve the existing source extension precedence for same-name files.
- Treat a directory/file collision as one emitted concept, not dropped coverage.
- Update the existing “directories authoritative” regression test; it encodes
  the behavior being intentionally reversed.
- Edit the source template first. Sync the dogfooded `.safeword` copy through
  the normal upgrade mechanism only after focused tests pass.
