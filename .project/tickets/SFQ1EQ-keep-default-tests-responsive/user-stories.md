# User Stories: Keep default tests responsive

## Maintainer feedback loop

As a Safeword maintainer, I want configuration-generation tests to avoid real
package installation so that the default test command gives timely feedback
without weakening the assertions relevant to my change.

### Acceptance criteria

- Config-only Cursor, hook, and project-detection scenarios exercise setup with
  dependency installation disabled.
- Their existing generated-file and package-manifest assertions remain intact.
- The default lane contains no scenario whose purpose is to prove dependencies
  were physically installed.

## Release confidence

As a release verifier, I want real installation behavior retained in an explicit
slow lane so that faster local feedback does not create a coverage gap.

### Acceptance criteria

- The non-git installation scenario still proves base dependencies are installed.
- That proof runs through `test:slow`, not the default Vitest configuration.
- The slow-lane scenario remains opt-in and clearly named as installation proof.
