# Impl Plan: Preserve Codex hook behavior through the plugin CLI

**Status:** implemented

## Approach

Riskiest assumption: the packaged CLI can reuse the legacy adapters' shared hook
logic without requiring repo-local `.safeword/hooks/codex/*` files in customer
projects. The cheapest proof is a failing subprocess test against the built CLI
for the PreToolUse denial and PostToolUse state paths; if those cannot run from
package code, the plugin migration is not behavior-preserving.

Build order:

1. Add a parity audit fixture that compares legacy Codex adapter behavior to
   `safeword hook codex <event>` and records preserve/redesign/defer decisions.
2. Move Codex payload translation and shared-hook spawning into package-owned
   code that ships with the CLI. Keep the old template adapters as compatibility
   wrappers unless schema/reconcile tests prove a new plugin-backed install no
   longer needs them; do not remove support needed by legacy repo-local installs.
3. Expand packaged PreToolUse to translate all supported Codex edit/shell
   payloads, call the shared quality gate, preserve Codex `$explain` wording,
   and maintain skill/review-stamp identity bridge files.
4. Expand packaged PostToolUse to run the shared quality accumulator and skill
   nudge behavior, forwarding the first additionalContext payload exactly as
   Codex expects and staying quiet for non-nudge edits.
5. Expand packaged Stop to reuse the legacy architecture nudge, retro extraction,
   retro filing, self-report, and fail-open no-continuation behavior.
6. Expand packaged SessionStart to call the shared auto-upgrade core before
   returning SAFEWORD.md context, with notices appended to successful
   additionalContext output and no exit-code blocking.
7. Make UserPromptSubmit emit a package-owned timestamp on every prompt, merge
   the one-time packaged retro nudge when drafts are spooled, and append optional
   project-owned queued context.
8. Run deterministic BDD/integration verification first, then the opt-in live
   trusted plugin smoke through isolated `CODEX_HOME`.

## Scenario proof plan

| Scenario | Primary proof | Why this proof is enough |
| --- | --- | --- |
| Packaged PreToolUse denies the same blocked edit as the legacy adapter | `packages/cli/features/steps/codex-plugin-hook-parity.steps.ts` subprocess test against built CLI with exact Codex apply_patch payload. | Proves the public package command blocks the same user-visible edit path. |
| Packaged PreToolUse records skill and review-stamp run identity | Same step file; inspect namespace bridge files after shell-command payloads. | These files are the hidden proof path used by later gates. |
| Packaged PostToolUse accumulates quality state through the shared hook | `packages/cli/tests/integration/codex-post-tool-quality.test.ts` plus BDD subprocess coverage against `dist/cli.js`. | Proves shared quality state survives the package boundary. |
| Packaged PostToolUse forwards language skill nudges | BDD subprocess fixture plus focused hook integration if existing `packages/cli/tests/hooks/skill-nudge-agents.test.ts` needs extension. | Proves advisory output shape and nudge behavior. |
| Packaged PostToolUse stays quiet for edits without a language nudge | Same BDD step file with markdown-only edit. | Guards against context spam. |
| Packaged Stop emits architecture continuation before filing continuation | BDD subprocess fixture using existing `quality-state` and retro draft helpers from integration tests. | Proves continuation precedence and one-continuation behavior. |
| Packaged Stop runs retro extraction invisibly | BDD subprocess fixture with injected retro child command and transcript fixture. | Proves the extraction path is invoked without depending on model output. |
| Packaged Stop fails open with valid JSON | BDD direct subprocess malformed-input test. | Guards the lifecycle boundary every Stop run crosses. |
| Packaged SessionStart runs auto-upgrade before emitting package-owned SAFEWORD context | `packages/cli/features/steps/auto-upgrade-codex.steps.ts` extension or BDD step with shared auto-upgrade core controlled as no-op. | Proves single-dispatcher sequencing without repo-local instructions. |
| Packaged SessionStart includes upgrade notices without exit-code blocking | `packages/cli/tests/hooks/auto-upgrade-core.test.ts` plus CLI subprocess exit-code coverage. | Preserves Codex notice semantics without blocking session startup. |
| Packaged UserPromptSubmit emits timestamp and queued Safe Word prompt context | BDD direct subprocess test with `.project/codex-prompt-context.txt`. | Proves queued context remains project-owned data alongside package-owned timestamp context. |
| Packaged UserPromptSubmit emits a timestamp with no queued prompt context | BDD direct subprocess test with no queue file. | Guards the required timestamp behavior without inventing project context. |
| Event-by-event parity map covers every legacy adapter behavior | Static BDD step over a checked-in parity map or table exported from tests. | Prevents future behavior from disappearing without a decision. |
| Plugin manifest commands all use the packaged hook command | Existing `schema.test.ts`, release contract checks, and BDD manifest assertion. | Catches accidental fallback to repo-local hook scripts. |
| Hidden compatibility alias preserves the packaged hook contract | BDD subprocess test comparing alias output to public command output for the same payload. | Proves old command strings remain safe during rollout. |
| Live vetted plugin run observes package-backed lifecycle dispatch | Existing opt-in live smoke lane in `steps/test-codex-plugin-migration.steps.ts`, extended as needed. | Real Codex proves plugin lifecycle dispatch end to end; deterministic PreToolUse tests prove the denial contract separately. |

## Decisions

| Decision | Choice | Alternatives considered | Rejected because |
| --- | --- | --- | --- |
| Behavior source | Reuse shared Safe Word hook modules from package code; keep the packaged CLI as the only plugin hook entrypoint. | Reimplement each gate directly inside `codex-hook.ts`; keep installing repo-local adapters. | Direct reimplementation drifts from Claude/Cursor behavior. Repo-local adapters violate the plugin migration goal. |
| Command name | Keep `safeword hook codex <event>` as the public command and `safeword codex-hook <event>` as hidden compatibility. | Revert to `codex-hook`; invent per-event commands. | The nested `hook codex` shape is clearer and already shipped on this branch with tests and CI green. |
| Hook trust | Do not attempt to bypass or automate Codex hook trust. | Treat install as enough; write managed hook config. | Current Codex docs say plugin hooks are skipped until reviewed/trusted unless they come from managed policy sources. |
| Live proof | Keep live smoke opt-in and isolated with temp `CODEX_HOME`. | Run live smoke in default CI; mutate real user Codex home. | Live runs are costly/flaky and real home mutation is unsafe. |

## Parity audit

| Event | Legacy behavior | Packaged CLI status before this ticket | Decision |
| --- | --- | --- | --- |
| PreToolUse | Translate Codex payloads; run shared quality gate; preserve denial output; record skill and review-stamp identities. | Partial: only direct intake-field denial and skill identity. | Preserve. |
| PostToolUse | Translate edit/shell payloads; run shared quality state accumulator; forward review additionalContext; run language skill nudge. | Partial: only reads a queued context file. | Preserve. |
| Stop | Run retro extraction invisibly; emit architecture continuation; emit retro filing continuation; fail open with `{}`. | Partial: only reads queued stop continuation file. | Preserve, while keeping queued continuation as an additive compatibility path if tests prove no conflict. |
| SessionStart | Emit package-owned SAFEWORD.md context and run Codex auto-upgrade through one dispatcher. | Partial: emits SAFEWORD.md only. | Preserve. |
| UserPromptSubmit | Emit timestamp context, surface packaged retro filing nudges, and append queued project context. | Timestamp and retro behavior were missing; queued context existed. | Preserve through one merged structured response. |
| Self-report crash capture | Attribute unexpected hook crashes to Codex without breaking the user turn. | CLI-level crash capture already exists; legacy adapter-local capture is not yet proven through packaged hook scenarios. | Defer: file a follow-up if implementation removes adapter-local crash capture or if quality review finds package-level crash attribution insufficient. |

## Arch alignment

- Keeps the reconciliation engine as the owner of install/upgrade cleanup; hook
  parity changes belong in packaged CLI code and schema/reconcile tests, not a
  one-off migration script.
- Keeps schema as the source of truth for any remaining project-local Codex
  config while moving reusable behavior out of customer repos.
- Keeps shared hook modules as the behavior source so Claude, Cursor, and Codex
  gates do not fork silently.
- Keeps live Codex proof opt-in, matching the existing test architecture where
  deterministic integration tests are the default and live model runs are a
  final smoke lane.

## Known deviations

- The old `safeword codex-hook <event>` command remains as a hidden
  compatibility alias even though the public command is `safeword hook codex
  <event>`. This is deliberate rollout safety and has its own scenario.
- Plugin hook trust is not automated. Codex owns trust policy, and this ticket
  only proves trusted plugin execution plus untrusted-boundary reporting where
  existing smoke tests cover it.
- Remote marketplace publishing is not part of this ticket; local marketplace
  installation is the proof boundary.
- Adapter-local self-report crash capture is deferred unless implementation
  removes package-level crash attribution or quality review finds a behavior
  loss; the parity scenarios focus on user-visible hook behavior and state.

## Doc impact

- Update README, website docs, and architecture docs only where the behavior
  contract changes from the current PR text. If implementation preserves the
  documented `safeword hook codex <event>` command and plugin install model
  without new user-facing steps, record `skip: no doc delta beyond existing PR
  docs` in verify evidence.

## Verification commands

- `bun run --cwd packages/cli build`
- `PATH="$PWD/node_modules/.bin:$PATH" ./node_modules/.bin/cucumber-js --profile default packages/cli/features/codex-plugin-hook-parity.feature features/test-codex-plugin-migration.feature packages/cli/features/auto-upgrade-codex.feature packages/cli/features/codex-retro-parity.feature`
- `bun run test tests/commands/setup-reconcile.test.ts tests/commands/upgrade-reconcile.test.ts tests/schema.test.ts tests/smoke/codex-parity.live.test.ts tests/integration/codex-post-tool-quality.test.ts tests/hooks/auto-upgrade-core.test.ts tests/hooks/retro-filing-gate.test.ts`
- `bun run lint`
- Opt-in live smoke with the existing Codex live flag after deterministic tests pass.

## Assessment triggers

- Codex changes plugin hook trust, hook manifest path rules, or hook output
  schemas.
- Safe Word adds a new Codex hook event, proof bridge, quality gate, or retro
  path.
- Package-manager execution through `npx` or `bunx` changes enough that plugin
  hook commands no longer launch the published CLI reliably.
