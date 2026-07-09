# Spec: Test Codex plugin migration

## Intent

Safe Word's current Codex support is project-local: setup writes Codex skills,
Codex hook configuration, and hook scripts into the repo. The migration target is
plugin-backed Codex support where reusable Safe Word behavior is delivered
through a Codex plugin and the Safe Word CLI over `bunx` or `npx`, leaving
customer repos with only their own project data and any minimal configuration
that still belongs there.

This ticket establishes the BDD test harness for that migration before the
production migration lands. It should make the risky contracts observable:
plugin discovery, skill visibility, hook lifecycle behavior, package contents,
and upgrade cleanup from the old project-local shape.

## Intake Brief

- **Requested by:** alex (TheMostlyGreat), after research into Safe Word's current Codex install model and OpenAI Codex plugin mechanics.
- **Cost of inaction:** the migration could appear to work in source tests while failing where it matters: Codex may not discover the plugin, skills may surface under unexpected names, hooks may not be trusted or invoked, package-runner entrypoints may be missing from the published artifact, or old installs may keep depending on repo-local `.safeword/hooks` and `.agents/skills`.
- **Reversibility:** two-way door for the test harness itself; one-way-adjacent for the migration it protects because it changes the customer install contract and removes repo-local assets that current users may have customized.

## References

- Current project-local Codex install: `README.md` and `packages/website/src/content/docs/getting-started/quick-start.mdx`.
- Current schema-owned Codex hook patches and skill files: `packages/cli/src/schema.ts`.
- Current Codex project config template: `packages/cli/templates/codex/config.toml`.
- Current Codex hook adapters: `packages/cli/templates/hooks/codex/`.
- Current live smoke precedent: `packages/cli/tests/smoke/codex-parity.live.test.ts`.
- Verification lane guidance: `packages/cli/templates/guides/verification-lanes-guide.md`.
- Official Codex plugin docs: https://developers.openai.com/codex/plugins and https://developers.openai.com/codex/plugins/build.
- Official Codex hooks docs: https://developers.openai.com/codex/hooks.
- Official Codex skills docs: https://developers.openai.com/codex/skills.
- Official Codex CLI docs: https://developers.openai.com/codex/cli/reference and https://developers.openai.com/codex/noninteractive.

## Personas

- Technical Builder (TB) — installs Safe Word into real projects and should not get a repo filled with reusable Safe Word implementation files just to use Codex well.
- Safeword Maintainer (SM) — needs a reliable, cheap-to-diagnose harness before changing the install model across every Codex user.

## Surfaces

Affected:

- OpenAI Codex

Unaffected:

- Claude Code — this ticket does not change Claude Code's project-local assets, plugin bootstrap, or hooks.
- Cursor — this ticket does not change Cursor rules, commands, or hooks.
- OpenAI Codex Cloud — local Codex plugin install and local hook execution are the tested contract unless Codex Cloud support is explicitly added later.

## Vocabulary

- **Codex plugin** — an installable Codex extension containing skills, hooks, apps, MCP servers, or assets, installed from a marketplace into Codex's plugin cache.
- **Plugin-scoped skill name** — the explicit Codex name for a bundled plugin skill, such as `safeword:bdd`; this ticket treats scoped names as the canonical Codex contract.
- **Local marketplace** — a test-only Codex marketplace root used to install the Safe Word plugin without publishing it remotely.
- **Package-runner entrypoint** — a command such as `bunx safeword@... codex-hook pre-tool-quality` or `npx safeword@... codex-hook pre-tool-quality` that runs Safe Word logic from the package instead of from repo-local hook scripts.
- **Project-local Codex install shape** — today's Safe Word Codex assets in the customer repo, especially `.agents/skills`, `.codex/config.toml`, and `.safeword/hooks/codex`.
- **Prompt surface** — the model-visible Codex prompt input, including available skills and project instructions, inspectable through `codex debug prompt-input`.

## Decisions

- Codex skill invocation names are plugin-scoped: `safeword:<skill>`. The migration will not install repo-local alias skills solely to preserve bare names such as `$bdd`.

## Jobs To Be Done

### test-codex-plugin-migration.TB1 — Use Safe Word in Codex without inheriting its implementation tree

**Persona:** Technical Builder (TB)

> When I enable Safe Word for Codex in one of my repos, I want Codex to get the
> Safe Word skills and gates from a plugin and CLI package, so my repository
> does not have to carry reusable Safe Word implementation files.

#### test-codex-plugin-migration.TB1.R1 — A fresh repo can install and enable the Safe Word Codex plugin without `.agents/skills` or repo-local `.safeword/hooks`

#### test-codex-plugin-migration.TB1.R2 — Safe Word Codex skills are visible to the agent from the plugin with stable, intentional invocation names

#### test-codex-plugin-migration.TB1.R3 — Safe Word Codex hooks execute the packaged CLI entrypoints and preserve the existing deny, allow, context, and continuation semantics

#### test-codex-plugin-migration.TB1.R4 — Upgrading an old project-local Codex install leaves user-owned project data intact while removing or ignoring obsolete Safe Word implementation assets

### test-codex-plugin-migration.SM1 — Trust the migration through targeted evidence, not a fragile monolith

**Persona:** Safeword Maintainer (SM)

> When I change Codex support from repo-local files to a plugin-backed package,
> I want a layered test harness that proves each boundary independently, so a
> failure tells me whether packaging, plugin discovery, prompt surfacing, hook
> execution, live Codex behavior, or migration cleanup broke.

#### test-codex-plugin-migration.SM1.R1 — Static and release checks prove the plugin manifest, marketplace entry, bundled files, and packed package contents are valid

#### test-codex-plugin-migration.SM1.R2 — An isolated plugin install harness proves Codex can discover, install, enable, and expose the Safe Word plugin under a temp CODEX_HOME

#### test-codex-plugin-migration.SM1.R3 — Deterministic hook contract tests exercise exact Codex hook JSON against packaged CLI entrypoints without involving the model

#### test-codex-plugin-migration.SM1.R4 — A single opt-in live Codex smoke proves real `codex exec` invokes the installed plugin hooks, while model-mediated cost and flake stay out of default verification

## Rave Moment

skip: test infrastructure. The persona-facing moment belongs to the production
Codex plugin migration; this ticket builds the evidence ladder that makes that
future change safe.

## Outcomes

- A maintainer can run a fast default suite and know whether the plugin package, manifest, skills, hooks, and migration rules are structurally sound.
- A maintainer can run an isolated local Codex plugin install test without mutating their real `~/.codex`.
- A maintainer can run deterministic hook-entrypoint tests that fail before any live model run is needed.
- A maintainer can opt into one live Codex smoke that proves Codex itself loads the plugin and invokes the hooks.
- A technical builder upgrading from the old Codex install shape keeps project-owned data and no longer depends on bulky repo-local Safe Word implementation files.

## Open Questions

- Package-runner policy: should plugin hooks call `bunx` first with `npx` fallback, a generated wrapper, or a pinned package command selected during setup? defer: implementation design can choose the exact command after scenarios prove the package-runner boundary; this ticket's scenarios require no repo-local hook paths.
- Hook trust product flow: tests can use `--dangerously-bypass-hook-trust`, but what exact user-facing trust step should the production migration document or automate where allowed? defer: production migration documentation decision; this ticket proves trusted automation and records that user trust remains a separate product step.
