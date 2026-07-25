# Test Definitions: Honor host JavaScript toolchains during agent edits

Feature source: `features/honor-host-toolchains.feature`

test-definitions.md is the R/G/R ledger.

## Rule: honor-host-toolchains.SWM1.R1 — Host toolchain owns fixes

### Scenario: An Ultracite Biome project uses its configured checked flow

- [x] RED — reconstructed against isolated `f8cf83556` baseline: importing the required `host-toolchain.ts` dispatch seam fails because the module did not exist.
- [x] GREEN — real subprocess records local Ultracite `fix -- <file>` then `check -- <file>` with owner cwd and sanitized environment.
- [x] REFACTOR — shared resolver/runner keeps host ownership, command construction, and environment isolation in one seam.

### Scenario: A direct Biome project is not rewritten by a Safeword JavaScript policy

- [x] RED — reconstructed against isolated `f8cf83556` baseline: importing the required `host-toolchain.ts` dispatch seam fails because the module did not exist.
- [x] GREEN — `lintFile` subprocess fixture invokes only local Biome `check --write` then `check` for a direct owner.
- [x] REFACTOR — direct-Biome dispatch reuses the same bounded resolver and runner.

### Scenario: An Ultracite preset wins over direct-Biome detection

- [x] RED — reconstructed against isolated `f8cf83556` baseline: importing the required `host-toolchain.ts` dispatch seam fails because the module did not exist.
- [x] GREEN — commented `.biome.jsonc` with current `ultracite/biome/core` resolves Ultracite before direct Biome.
- [x] REFACTOR — ownership precedence remains localized to config parsing rather than caller-specific branches.

### Scenario: Each supported Biome configuration filename selects direct Biome

- [x] RED — reconstructed against isolated `f8cf83556` baseline: importing the required `host-toolchain.ts` dispatch seam fails because the module did not exist.
- [x] GREEN — table-driven resolver tests cover `biome.json`, `biome.jsonc`, `.biome.json`, and `.biome.jsonc`.
- [x] REFACTOR — table-driven configuration-name coverage keeps filename support compact.

### Scenario: A dash-prefixed source filename uses exact shell-disabled direct-Biome argv

- [x] RED — reconstructed against isolated `f8cf83556` baseline: importing the required `host-toolchain.ts` dispatch seam fails because the module did not exist.
- [x] GREEN — real Bun subprocess captures exact direct-Biome argv, owner cwd, and cleared Biome overrides.
- [x] REFACTOR — argument-array execution is shared by both adapters.

### Scenario: A dash-prefixed source filename uses exact shell-disabled Ultracite argv

- [x] RED — reconstructed against isolated `f8cf83556` baseline: importing the required `host-toolchain.ts` dispatch seam fails because the module did not exist.
- [x] GREEN — real Bun subprocess captures exact Ultracite `fix` then `check` argv in owner cwd.
- [x] REFACTOR — argument-array execution is shared by both adapters.

### Scenario: A host configuration that excludes an edited file does not trigger a competing fallback

- [x] RED — reconstructed against isolated `f8cf83556` baseline: importing the required `host-toolchain.ts` dispatch seam fails because the module did not exist.
- [x] GREEN — a Biome config excluding the file still receives only the selected host commands; no generic fallback is entered.
- [x] REFACTOR — recognized-owner handling remains one no-fallback branch.

## Rule: honor-host-toolchains.SWM1.R2 — Existing Ultracite remains project-owned

### Scenario: An existing Ultracite installation remains byte-for-byte owned by the project

- [x] RED — reconstructed against isolated `f8cf83556` baseline: importing the required `host-toolchain.ts` dispatch seam fails because the module did not exist.
- [x] GREEN — snapshot fixture preserves existing Ultracite config, dependency declaration, editor settings, and agent hooks across edit-time dispatch.
- [x] REFACTOR — no-churn fixture remains independent of dispatch implementation details.

## Rule: honor-host-toolchains.SWM1.R3 — Host diagnostics reach the agent

### Scenario: A host check failure identifies the edited file to the agent

- [x] RED — reconstructed against isolated `f8cf83556` baseline: importing the required `host-toolchain.ts` dispatch seam fails because the module did not exist.
- [x] GREEN — `lintFile` subprocess returns the failing final Biome check diagnostic containing the edited filename.
- [x] REFACTOR — final-command diagnostics flow through the common result path.

## Rule: honor-host-toolchains.SWM1.R4 — Missing and unsupported owners fail safely

### Scenario: A recognized owner without a project-local executable leaves the file untouched rather than using a global or package-runner fallback

- [x] RED — reconstructed against isolated `f8cf83556` baseline: importing the required `host-toolchain.ts` dispatch seam fails because the module did not exist.
- [x] GREEN — `lintFile` returns an actionable local-install warning while a distinguishable PATH Biome remains uninvoked.
- [x] REFACTOR — local-binary absence is represented explicitly, avoiding fallback duplication.

### Scenario: An unsupported alternative formatter retains Safeword's existing no-Prettier behavior

- [x] RED — reconstructed against isolated `f8cf83556` baseline: importing the required `host-toolchain.ts` dispatch seam fails because the module did not exist.
- [x] GREEN skip: existing `lint-config.test.ts` proves alternative formatter ownership suppresses Prettier while the unchanged JS branch retains ESLint.
- [x] REFACTOR — the existing unsupported-formatter branch remains unchanged.

## Rule: honor-host-toolchains.SWM1.R5 — Safeword-generated files stay out of host dispatch

### Scenario: A Safeword-owned generated file is excluded from host dispatch

- [x] RED — reconstructed against isolated `f8cf83556` baseline: importing the required `host-toolchain.ts` dispatch seam fails because the module did not exist.
- [x] GREEN — `.safeword` JavaScript fixture returns without invoking the recognized local Biome executable.
- [x] REFACTOR — generated-path exclusion is a single early return.

## Rule: honor-host-toolchains.SWM1.R6 — Ambient settings cannot replace the selected owner

### Scenario: Biome environment overrides cannot escape the selected workspace owner

- [x] RED — reconstructed against isolated `f8cf83556` baseline: importing the required `host-toolchain.ts` dispatch seam fails because the module did not exist.
- [x] GREEN — direct-Biome runner subprocess proves `BIOME_CONFIG_PATH` and `BIOME_BINARY` are absent from child environment; Ultracite adapter shares that runner sanitization.
- [x] REFACTOR — environment sanitization is centralized in the runner.

## Rule: honor-host-toolchains.SWM1.R7 — Nested workspace dispatch stays within the project

### Scenario: A nested configuration inherits its root toolchain and root-hoisted executable

- [x] RED — `host-toolchain.test.ts` initially failed because the resolver module did not exist.
- [x] GREEN — nested owner resolution returns the canonical owner cwd, root-hoisted local executable, and owner-relative operand; a malformed contained nested config also stays nearest so Biome surfaces its diagnostic instead of falling back to a parent.
- [x] REFACTOR — canonical ancestry and owner-relative paths are resolved once.

### Scenario: A sibling workspace cannot become the edited file's host owner

- [x] RED — reconstructed against isolated `f8cf83556` baseline: importing the required `host-toolchain.ts` dispatch seam fails because the module did not exist.
- [x] GREEN — a sibling-local Biome executable is ignored; the root owner remains unavailable rather than crossing workspace boundaries.
- [x] REFACTOR — owner discovery is restricted to the edited file's ancestry.

### Scenario: A canonical path outside the Safeword project cannot become a host owner

- [x] RED — an edited-file symlink escape initially returned no warning and fell through to generic JavaScript checks.
- [x] GREEN — hook-level fixture now returns an actionable containment warning and invokes neither host nor generic formatter commands.
- [x] REFACTOR — root containment is represented as an explicit resolver outcome, keeping the no-fallback policy at one call site.
