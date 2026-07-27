# User Stories: Trustworthy mixed JS/TS architecture coverage

## Story 1: See every top-level source module

As a developer relying on `architecture.generated.md`, I want mixed `src/` and
`lib/` trees to list both module directories and loose source files so that the
document does not silently omit important parts of the system.

### Acceptance criteria

- Given a source root containing a directory and a differently named source
  file, when Safeword generates the architecture document, then both concepts
  appear as modules.
- Given `foo/` and `foo.ts` in the same source root, when Safeword generates the
  document, then `foo` appears once and references `foo/`.
- Given an existing document references `foo.ts`, when `foo/` is added and the
  document heals, then the reference changes to `foo/`.
- Given the same source tree on repeated runs, the module order and fingerprint
  are deterministic.

## Story 2: Know which generated prose is editable

As a developer maintaining architecture descriptions, I want the architecture
guide to distinguish fully derived root indexes from prose-preserving module
documents so that I can edit durable purpose prose without guessing whether a
heal will overwrite it.

### Acceptance criteria

- The guide states that root package indexes are fully machine-owned.
- The guide states that module headings, references, fingerprints, and status
  markers are machine-owned.
- The guide states that module purpose prose is human-owned and preserved across
  heals while its module remains present, while structural changes can mark it
  stale and module removal replaces it with an orphan marker.

## Out of scope

- Recursive discovery below the immediate source root.
- Seeding purpose prose from comments or `package.json`.
- Changing the recognized source extensions or intentional config/declaration
  exclusions.
