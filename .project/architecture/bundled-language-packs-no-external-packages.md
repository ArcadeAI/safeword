# Bundled Language Packs (No External Packages)

**Status:** Accepted
**Date:** 2025-12-26

**What.** Safeword ships language packs with the CLI.

**Why.** One distribution keeps each pack in sync with the CLI and avoids maintaining a package-version matrix.

**Trade-off.** Adding a language requires a Safeword release.

**Alternatives.** Separate npm packages would require coordinating versions. User-defined packs were deferred until needed.

**Implementation.** `packages/cli/src/packs/*.ts`
