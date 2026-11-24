# Per-file host JavaScript toolchain ownership

**Status:** Accepted
**Date:** 2026-07-24

**What.** The shared post-edit JS/TS hook looks for a recognized host toolchain from the edited file’s canonical directory up to the canonical Safeword project root. A recognized Ultracite Biome preset takes precedence over direct Biome. The hook runs only the owning toolchain’s local executable, sets `cwd` to the owner directory, and passes the owner-relative path after `--`. It removes `BIOME_CONFIG_PATH` and `BIOME_BINARY` from the child environment.

**Why.** Checking only the root selects the wrong policy in nested, mixed-language workspaces. PATH lookup, package runners, and inherited Biome overrides can select a different tool or configuration than the project declared.

**Trade-off.** The hook owns path/config parsing and executable lookup instead of delegating to package runners. Unsupported formatters remain on the existing no-Prettier path until a dedicated adapter and scenarios are added.

**Alternatives.** Root-wide formatter detection: rejected because it crosses workspace boundaries. Generic package-manager invocation: rejected because it can download or select a global binary. Shell commands: rejected because filenames are operands, not code.

**Implementation.** `packages/cli/templates/hooks/lib/host-toolchain.ts` and the shared `lintFile` entry point; ticket 13E3EN.
