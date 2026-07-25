# Impl Plan: Honor host JavaScript toolchains during agent edits

**Status:** planned

## Approach

The riskiest assumption is that a template hook can select an owner per edited file without reintroducing a PATH/download fallback or escaping a nested workspace. Slice 1 proves this cheapest: a subprocess integration test with a nested fixture, recording local stub executable argv/cwd/environment and a hostile global/PATH stub.

1. Add resolver unit tests and schema-registered `host-toolchain.ts`: pass the caller's canonical project root through `post-tool-lint`/Cursor/Codex → `lintFile` → resolver; cover four config filenames with comments/trailing commas in both JSONC names, `extends` string/array, Ultracite-over-Biome precedence, nearest owner, root-hoisted executable, and separate canonical escape fixtures for edited file, configuration, and executable. Primary proof: unit tests for deterministic filesystem partitions plus schema/reconciliation coverage proving the installed hook can import the registered module.
2. Add runner integration tests using executable stubs: exact `fix/check` and `check --write/check` argv, shell-disabled invocation, owner cwd, relative operands, cleared `BIOME_CONFIG_PATH`/`BIOME_BINARY`, no global/package-runner/download invocation, and ordered failure policy: a failed fix stops before check and surfaces its output; a failed check surfaces its output. Primary proof: Bun subprocess integration, because mocks would not prove process wiring.
3. Wire `lintFile` JavaScript branch to dispatch a resolved host before existing ESLint/Prettier; preserve unsupported-owner and non-JS branches. Inventory every affected runtime: Claude post-tool lint and Cursor after-file-edit already call `lintFile`; extend Codex's packaged `post-tool-use` dispatcher to invoke the same installed lint entry point for edited file targets. Add one wiring test per distinct runtime, including Codex hook-manifest/dispatcher proof.
4. Add regression tests for missing-local binary (including PATH/package-runner trap), no Ultracite config/dependency/editor/hook mutations, and generated-file exclusion. Update the test ledger through RED → GREEN → REFACTOR per scenario.
5. Apply and review the `ARCHITECTURE.md` ownership convention, then update `README.md` and website docs only if the hook behavior is publicly documented; otherwise record `skip: no existing customer-facing post-edit toolchain contract to amend` after documentation survey.

Affected surfaces: Safeword CLI is covered by template/reconciliation tests; Claude Code, OpenAI Codex, and Cursor are covered through their shared `lintFile` hook entry point. Cloud surfaces are unchanged by scope.

## Decisions

| Decision | Choice | Alternatives considered | Rejected because |
| --- | --- | --- | --- |
| Dispatch location | New schema-registered `lib/host-toolchain.ts`, called first by JS/TS `lintFile` | Extend root-only `lint-config.ts`; invoke from each IDE hook | Per-file ancestry plus execution is distinct from config presence; per-IDE calls would drift. Evidence: existing shared `lintFile` callers and [Biome configuration](https://biomejs.dev/reference/configuration/). |
| Host classification | JSONC-safe parse nearest supported Biome config; Ultracite preset wins | Detect package dependency only; direct Biome always wins | Dependencies are ambiguous, JSON.parse rejects supported configs, and precedence would violate existing Ultracite setups. Evidence: [Ultracite v6 preset guide](https://docs.ultracite.ai/upgrade/v6). |
| Execution | Absolute local executable + argv array, owner cwd, sanitized env | PATH/bunx/npx; shell command; `--config-path` | Only the first is deterministic, offline, and preserves owner-relative configuration. Evidence: [Biome CLI](https://biomejs.dev/reference/cli/) documents `check --write` and environment overrides. |

Figure-it-out record: options were (A) root formatter-detector extension, (B) per-IDE dispatch, (C) dedicated shared resolver/runner. C wins on correctness for nested canonical ownership and avoids IDE drift; A is smaller but structurally root-only, B duplicates security-sensitive execution. Premortem: a future adapter may make the module a generic formatter registry; mitigate by keeping only the two explicit adapters and adding an adapter only with scenarios.

## Arch alignment

Honors ARCHITECTURE.md's template/shared-hook architecture and the existing formatter-aware convention: host alternative formatters suppress Prettier without changing non-JS gates. Adds the project-wide per-file host-owner dispatch convention to ARCHITECTURE.md.

## Known deviations

Existing alternative formatter detection is root-wide; this feature deliberately uses edited-file ownership for direct Biome/Ultracite. This is required to prevent sibling-workspace inheritance in polyglot monorepos.

## Doc impact

`README.md` and `packages/website/src/content/docs`: defer assessment until implementation identifies an existing description of post-edit lint ownership; skip if neither documents it.

## Assessment triggers

Revisit when adding another executable-backed formatter adapter, supporting package-manager layouts beyond `node_modules/.bin`, Biome changes its configuration discovery/environment contract, or a supported hook runtime cannot execute argv arrays with an explicit cwd.
