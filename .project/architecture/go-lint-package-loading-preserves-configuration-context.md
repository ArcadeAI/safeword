# Go lint package loading preserves configuration context

**Status:** Accepted
**Date:** 2026-10-21

Go post-edit lint loads the complete, nonrecursive package from the edited file's
canonical directory. A single-file package omits sibling declarations, and a
repository-root loader loses nested-module imports (#4733, #5105, #5427).

The shared hook calls the internal `hook go-lint` CLI action through the existing
pinned CLI resolver using the call-time project root. The executor resolves the
original configuration's base before changing directories, writes a temporary `cfg`-mode copy at that base, and anchors documented resource paths
to their original locations. The executor parses YAML and TOML with bundled libraries and leaves customer config files untouched. This separates Go package loading from
configuration path policy without imposing a new mode on customer files.

Only the edited file is formatted. Package lint is check-only, and feedback names
the package and actual source paths, retains infrastructure warnings, and notes
that findings may predate the edit. No recursive module scan or diagnostic filter
can hide a genuine typecheck failure.

The compatibility cost is an ephemeral config file and removal of Go linter
autofixes. Cleanup runs on ordinary completion and handled termination signals;
abrupt termination can leave a recognizable orphan. If the executor cannot resolve or write to the original module base, it warns and skips linting with the wrong configuration.
Arbitrary third-party plugin filesystem operations are not virtualized.

Implementation and proof: [prevent-false-go-lint-errors](../../.project/tickets/HWVKKQ-prevent-false-go-lint-errors/ticket.md),
`src/commands/go-lint.ts`, `src/go-lint/`, shared lint hooks, and real package/config
fixtures with the oldest supported v2 and current linter in the CI matrix.
