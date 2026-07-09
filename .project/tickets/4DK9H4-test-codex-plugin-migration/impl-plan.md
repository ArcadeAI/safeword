# Impl Plan: Test Codex plugin migration

**Status:** planned

## Approach

Riskiest assumption: Codex can install a Safe Word plugin from a local marketplace under an isolated `CODEX_HOME` and expose plugin-scoped skills plus plugin-bundled hooks without writing Safe Word implementation assets into the customer repo. The cheapest proof is the pair of scenarios "Fresh repo installs the plugin without repo-local Safe Word implementation assets" and "Plugin skills expose the approved scoped invocation names"; if those fail, the rest of the migration should stop.

Build order:

1. Package the Codex plugin as a published package asset. Add a package-contained Codex plugin root, marketplace fixture builder, manifest validation, and package-content release checks. Prove with static/release tests before touching install behavior.
2. Add packaged Codex hook entrypoints. Add a `safeword codex-hook <event>` CLI surface that reads exact Codex hook JSON on stdin and delegates to the existing Safe Word hook behavior from package code. Prove with subprocess integration tests against packed/dist code, mocking only the package-runner subprocess boundary where needed.
3. Build the isolated Codex plugin install harness. The harness creates a temp `CODEX_HOME`, temp git repo, local marketplace snapshot, and uses real `codex plugin add/list --json` plus `codex debug prompt-input`. Prove the real Codex CLI sees the plugin without mutating the developer's real Codex home.
4. Migrate project-local Codex install cleanup through schema/reconcile. Remove or deactivate Safe Word-owned `.agents/skills`, `.codex/config.toml` hook commands, and `.safeword/hooks/codex` dependencies while preserving user-owned skills, config, tickets, and learnings.
5. Add the opt-in live smoke last. Reuse the existing live-smoke pattern: skip by default, require an explicit env flag, run real `codex exec --json --dangerously-bypass-hook-trust`, and record known Codex runtime interception boundaries without making them default-suite blockers.

Scenario proof plan:

| Scenario | Primary proof | Why this proof is enough |
| --- | --- | --- |
| Fresh repo installs the plugin without repo-local Safe Word implementation assets | Integration: temp git repo + temp `CODEX_HOME` + real `codex plugin add/list --json`; assert repo tree unchanged. | This is the user-visible install contract and exercises real Codex plugin state. |
| Invalid local marketplace fails before claiming plugin install success | Integration: same harness with broken marketplace JSON. | Proves failure classification at the Codex marketplace boundary. |
| Plugin skills expose the approved scoped invocation names | Integration: real `codex debug prompt-input` under temp `CODEX_HOME`. | Prompt input is the model-visible skill surface. |
| Bare-name compatibility shims are treated as repo-residue | Static/integration: inspect fresh repo tree and docs/examples after install. | Prevents accidental fallback to repo-local alias skills. |
| PreToolUse denial runs through the packaged CLI entrypoint | Integration: spawn packed `safeword codex-hook pre-tool-use` with exact Codex JSON fixture. | Exercises real entrypoint wiring and existing phase-gate behavior. |
| SessionStart context runs through the packaged CLI entrypoint | Integration: spawn packed `safeword codex-hook session-start` with exact Codex JSON fixture. | Proves standing instructions come from package behavior, not repo-local hook files. |
| PreToolUse allow runs through the packaged CLI entrypoint | Integration: spawn packed `safeword codex-hook pre-tool-use` with a valid-ticket fixture. | Covers the non-denial branch through the same entrypoint. |
| PostToolUse additional context runs through the packaged CLI entrypoint | Integration: spawn packed `safeword codex-hook post-tool-use` and assert Codex `PostToolUse` additional context JSON. | Proves advisory/context output shape through real packaged wiring. |
| UserPromptSubmit additional context runs through the packaged CLI entrypoint | Integration: spawn packed `safeword codex-hook user-prompt-submit` with queued context fixture. | Proves prompt-turn context survives the package boundary. |
| Stop continuation runs through the packaged CLI entrypoint | Integration: spawn packed `safeword codex-hook stop` with stop fixture and assert `decision: block`. | Proves Codex continuation output through real packaged wiring. |
| Plugin hook commands never point at repo-local hook scripts | Static: parse plugin `hooks/hooks.json` and command builder output, including Windows override if present. | Detects the main regression without launching Codex. |
| Old project-local Codex install migrates to plugin-backed Codex support | Reconcile integration: fixture with today's installed shape, then upgrade. | Reconcile is the production migration engine. |
| User-authored Codex skills survive the migration | Reconcile integration with user `.agents/skills/company-workflow/SKILL.md`. | Proves user-owned repo assets are not confused with Safe Word assets. |
| Customized Codex config is not clobbered while stale Safe Word hooks are removed | Reconcile integration with custom config plus old Safe Word hook commands. | Proves cleanup and preservation in the same file. |
| Release check proves the packed package contains the plugin and hook entrypoints | Release/static: inspect `bun pm pack` tarball or equivalent packed directory. | Source-tree checks cannot prove publish contents. |
| Missing packaged hook dependency blocks the release contract | Unit/integration: package inspector fixture with a referenced file omitted. | Keeps packaging failures out of live smoke runs. |
| Plugin install harness mutates only the isolated Codex home | Integration: compare real Codex home plugin list before/after, mutate temp `CODEX_HOME`. | Guards the developer machine and CI runner. |
| Disabled plugin is reported as unavailable to the prompt surface | Integration: temp `CODEX_HOME` with installed disabled plugin, inspect prompt input. | Proves enabled state, not install state alone. |
| Exact Codex JSON fixtures cover every plugin hook command | Static/integration: enumerate manifest commands and fixture table, then spawn each command. | Prevents untested hook event additions. |
| Malformed Codex hook input fails open through the packaged entrypoint | Integration: feed malformed stdin and assert silent success plus unchanged self-report spool. | Malformed input is an edge case at every hook boundary. |
| Opt-in live smoke observes a plugin-installed hook denial | Live smoke: real `codex exec --json --dangerously-bypass-hook-trust` under temp `CODEX_HOME`. | Only Codex itself can prove hook invocation in a real agent run. |
| Untrusted plugin hooks are reported as not active for normal Codex runs | Integration/live-lite: installed plugin without trust, run verification without bypass and assert trust-required report. | Codex docs state plugin hooks are skipped until trusted; this makes that boundary visible. |
| Default verification skips the live Codex smoke with an explicit reason | Unit/integration: run default suite/harness with env flag absent. | Keeps CI cheap and deterministic by default. |

Wiring requirements:

- Every new CLI command gets at least one subprocess test from the built or packed CLI. Mock only the outer process/package-runner boundary, never the internal Safe Word hook modules.
- Every plugin manifest command gets a static command-source test and at least one dynamic fixture run through the packaged entrypoint it names.
- Every Codex CLI harness test uses a temp directory and a temp `CODEX_HOME`; the only external executable boundary is `codex` itself.

## Decisions

| Decision | Choice | Alternatives considered | Rejected because |
| --- | --- | --- | --- |
| Codex plugin asset location | Add a package asset directory such as `packages/cli/codex-plugin/` and include it in `packages/cli/package.json` `files`. | Put plugin files under `packages/cli/templates/`; reuse root `plugin/`. | `templates/` files are schema-managed project templates, but this plugin must not install into repos. Root `plugin/` is Claude Code bootstrap material, not npm package content. Codex plugins are package/distribution units per OpenAI docs: https://developers.openai.com/codex/plugins/build. |
| Hook execution surface | Add `safeword codex-hook <event>` packaged CLI entrypoints and make plugin hook commands call those via the selected package runner. | Keep repo-local `.safeword/hooks/codex/*.ts`; bundle full hook scripts inside the plugin only. | Repo-local hooks are the behavior being removed. Plugin-only scripts would create a second runtime copy instead of proving the published CLI path. Codex plugin hooks can load from plugin roots and receive plugin env vars, but they still require trust: https://developers.openai.com/codex/hooks. |
| Package-runner command policy | Centralize command rendering in one helper; test `bunx safeword@<version> codex-hook <event>` as the default and render an `npx --yes safeword@<version>` variant for environments that select npm. | Hard-code `bunx` everywhere; hard-code `npx` everywhere; shell fallback embedded ad hoc in every hook command. | A helper keeps command strings testable and avoids duplicated shell snippets. The exact production selector can evolve without changing the behavior contract. |
| Plugin install proof | Use a local marketplace snapshot plus real `codex plugin add/list --json` under temp `CODEX_HOME`. | Inspect files only; mutate the developer's real `~/.codex`. | File inspection cannot prove Codex sees the plugin. Real home mutation is unsafe; `CODEX_HOME` is the documented Codex state root: https://developers.openai.com/codex/environment-variables. |
| Prompt-surface proof | Use `codex debug prompt-input` to assert `safeword:<skill>` visibility. | Assert the skill files exist in the plugin folder. | Skill files existing does not prove Codex includes them in model-visible context. Codex skills are activated from the prompt skill list: https://developers.openai.com/codex/skills. |
| Live proof lane | Keep live `codex exec --json` opt-in and parse JSONL events. | Run live Codex in every default verification; skip live coverage entirely. | Default live runs are costly/flaky, but JSONL is the documented machine-readable live signal: https://developers.openai.com/codex/noninteractive. |
| Migration cleanup | Use schema/reconcile deprecations and targeted config cleanup to remove Safe Word Codex implementation dependencies while preserving user-owned repo content. | Write a separate migration script outside reconcile. | Reconcile is Safe Word's existing source of truth for install/upgrade/uninstall behavior and already has user-preservation tests. |

## Arch alignment

- Honors `ARCHITECTURE.md` "Reconciliation Engine": project-local cleanup runs through schema/reconcile, not a one-off migrator.
- Honors `ARCHITECTURE.md` "Build & Distribution": publishable behavior must exist in package files and dist entrypoints, then be checked through release/package tests.
- Honors `ARCHITECTURE.md` "Test Structure": default proof belongs in vitest integration/release lanes; live Codex proof stays in the existing opt-in live smoke lane.
- Honors `ARCHITECTURE.md` "BDD as a Solo-Agent Adaptation of the Three-Practice Model": scenario-gate assigns proof layer and build order before TDD starts.
- Honors `ARCHITECTURE.md` "Architecture Review Gate": design choices cite current external docs in the Decisions section so later gates can audit the evidence trail.

## Known deviations

- Plugin assets are intentionally outside `packages/cli/templates/` and therefore outside `SAFEWORD_SCHEMA.ownedFiles`; they are package assets, not repo-installed templates. Release/package contract tests replace schema registration for this directory.
- The scenario-gate independent review is logged as a deliberate skip for this run because the available sub-agent tool policy only permits spawning when the user explicitly asks for delegation. The local `/review-spec` pass still ran and found no must-fix issues after the precision edits.
- The first implementation will verify local marketplace installation, not remote marketplace publishing. Remote marketplace policy remains outside this ticket.

## Assessment triggers

- Codex changes plugin marketplace, manifest, hook trust, `hooks/hooks.json`, `codex plugin --json`, or `codex debug prompt-input` behavior.
- Codex removes or changes `--dangerously-bypass-hook-trust` or JSONL output from `codex exec --json`.
- Safe Word adds a new Codex hook event, skill, or continuation behavior that is not enumerated by the manifest-to-fixture coverage check.
- Package managers change `bunx` or `npx` package execution semantics enough that the command-rendering helper no longer launches the published CLI reliably.
- Windows support becomes a release requirement for plugin hooks; command rendering must then prove `commandWindows` coverage alongside POSIX commands.
- Codex Cloud support becomes explicit; this plan only proves local Codex plugin and hook execution.
