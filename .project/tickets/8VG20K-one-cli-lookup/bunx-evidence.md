# Evidence: bunx with an explicit version and a mismatched local install (Bun 1.3.14)

Probe, run from a directory whose node_modules/safeword is version 9.0.0 with a `bin` entry and a
node_modules/.bin/safeword that prints LOCAL:

- `bunx safeword@1.1.0 --version` printed `1.1.0` (the published package), not LOCAL.
- Against a local registry publishing safeword@1.2.3, `bunx safeword@1.2.3 architecture` run from the
  project executed the published 1.2.3 bin (marker "published").
- bunx's lockfile and install land in its own `$TMPDIR/bunx-<uid>-safeword@<version>` directory, not the project.

`packages/cli/tests/integration/action-hook-cli-version.test.ts` now asserts this through the real
session-architecture-heal hook and real `bunx` against a local registry; the mismatch row fails against the
lookup from before the version check.
