# Impl Plan: Activate Safeword upgrades coherently in Codex

> The rc.1 live gate disproved the original next-task-only activation premise.
> The corrected proof plan below requires a different Codex app-server identity.

**Status:** implemented

## Approach

Every automated scenario follows one RED → GREEN loop: register its Cucumber
step wiring and focused Vitest proof first, run both to observe the intended
failure, implement the smallest production change, then rerun both. The two
host-lifecycle scenarios are `@live @manual`: Safeword cannot inspect an already
loaded task or perform the desktop app lifecycle. Their automated supporting proof is
limited to Safeword-owned facts—exact immutable bundle commands, installed
version/digest, pending marker, and SessionStart proof.

The resume correction keeps that proof model unchanged. Native `SessionStart`
proof for `source: resume` is accepted only when its existing version, manifest,
activation, profile, task, and canonical-worktree bindings all match. The project
bootstrap polls that proof for at most 500 ms to absorb concurrent hook ordering;
no matching proof after the bound remains honestly unverified.

The machine contract becomes `CodexMigrationResultV2` with `schema_version: 2`.
This avoids changing the meaning of a schema-1 enum in place. Public CLI docs,
fixtures, and all consumers in this repository move together; v1 remains a
historical contract and is not emitted with the renamed state.

## Live host runbook

Run the two `@live @manual` scenarios before release and record the transcript in
`manual-evidence.md` beside this plan.

1. Publish the candidate as an exact prerelease/test version and make its
   matching plugin marketplace commit reachable from the configured Git
   marketplace. Record `codex --version`; use the release-supported Codex
   version documented by this repository. Start with the latest stable
   Safeword plugin as the old version and the published prerelease as the
   distinct candidate. A local unpublishable branch is not sufficient for this
   live check because it would bypass the production Codex installation path.
2. In a running Codex task, open `/hooks` and record the Safeword hook command's
   exact package version and manifest identity from the installed plugin's
   `hooks.json`. Keep this task open.
3. In a terminal, run the published candidate's exact install command (`bunx
   --bun safeword@<candidate-prerelease-version> codex install`). Record marketplace refresh,
   installed version, and the canonical pending marker identity.
4. Return to the same task and record that its loaded skills remain the old
   exact version. Review the candidate's exact changed hooks in Desktop Settings
   > Hooks or `/hooks` in the terminal TUI before restarting. This is the GREEN
   evidence for “Installing an upgrade does not change the running task” and
   ensures the resumed task's SessionStart is not skipped as untrusted.
5. Resume the task without fully restarting the app and confirm activation remains pending.
   Open `/hooks`, invoke SessionStart, and record the observed skill catalogue,
   hook manifest, activation-bound proof, and retained activation marker. This is the
   rejection evidence for “A same-app resume does not prove activation.”
6. With the changed hooks already trusted, fully restart Codex, resume the same task, and capture the exact task ID,
   skill catalogue, and hook manifest as GREEN evidence for coherent activation.
7. The evidence file must contain timestamp, old and candidate versions, Codex
   version, exact commands, running/same-app-resume/restarted-app-resume observations, marker/proof
   identities, and pass/fail for all three lifecycle checks. Do not mark a live check GREEN in
   `test-definitions.md` until that evidence exists.

## Scenario proof map

| Scenario owner | Primary RED/GREEN proof | Supporting proof | Why sufficient |
| --- | --- | --- | --- |
| R1 fresh add | `features/codex-plugin-next-task-upgrades.feature` through compiled CLI; `tests/commands/migrate-codex-plugin.test.ts` | recorded Codex command order | Exercises the real Safeword handler while replacing only the Codex boundary. |
| R1 add failure | same files | assertion that `plugin add` is absent | Proves fail-closed ordering and no partial install. |
| R1 Git refresh | same files | exact released version in verified plugin observation | Proves list → upgrade → install through the public command. |
| R1 refresh failure | same files | assertion that `plugin add` is absent | Proves stale metadata cannot reach installation. |
| R2 guidance | feature + command integration | `tests/codex-plugin/migration.test.ts` renderer equality | Locks human and typed state output to restart-bound activation semantics. |
| R2 running task | `@live @manual` on supported Codex release | automated command assertion that hook commands remain exact-version pinned | Only the host can prove loaded-task immutability; Safeword proves it never installs a dynamic dispatcher. |
| R2 host transition | `@live @manual` on supported Codex release | host-process, profile-proof, and SessionStart integration tests | Live gate proves same-app rejection and restarted-app coherent loading. |
| R2 pending status | feature + command integration | v2 state table in migration unit test | Proves status cannot claim current-task hot reload. |
| R3 matching proof | feature + filesystem/compiled-hook integration | pure status transition table | Proves durable proof precedes exact marker retirement. |
| R3 mismatch outline | feature + profile-proof integration for both rows | identity matcher unit assertions | Version and digest gates fail independently. |
| R3 later task | feature + repeated hook integration | status idempotence assertion | Proves proof remains current without recreating activation state. |
| R3 resumed-task isolation | bootstrap integration plus profile-proof filesystem tests | linked-worktree fixture and separate profile roots | Proves stale, cross-task, cross-profile, and cross-worktree proof remain non-current. |
| R3 concurrent proof | bootstrap integration with injected proof observations | fixed 500 ms attempt bound | Proves both hook orderings converge without turning absence into success. |
| R4 canonical upgrade | command + filesystem/compiled-hook integration | exact identity assertion | Proves a canonical v2 install safely supersedes v0.70 marker state. |
| R4 invalid legacy input | command + status integration for malformed/stale inputs | profile-proof unit assertions | Proves invalid legacy input is never promoted to current proof. |

All automated rows are owned jointly by
`packages/cli/features/steps/codex-continuity-cli.steps.ts` and the named
focused Vitest file. Commands per loop are `bun run test:bdd -- --tags
@codex-plugin-next-task-upgrades.TBU1.RN` and `bun run test <focused-file>` from
`packages/cli`.

## Build slices

1. **R1 marketplace loop:** executable Cucumber steps and failing command tests
   for absent, configured Git, add failure, and refresh failure; then implement
   marketplace list/upgrade/add/install ordering. Add focused non-scenario cases
   for configured non-Git fallback, marketplace-list failure, malformed list
   JSON, and older source metadata.
2. **R2 contract loop:** executable automated scenarios plus v2 renderer/state
   tests; then introduce result schema v2, task-language prose, and canonical
   activation state. Record the two `@live @manual` checks without pretending
   the subprocess fixture observes Codex task lifecycle.
3. **R3 proof loop:** executable steps and filesystem tests for matching,
   mismatching, and repeated proof; then implement exact marker retirement.
4. **R4 compatibility loop:** executable steps and filesystem tests for valid,
   existing-proof, malformed, and stale legacy markers; then add the exact-only
   dual reader.
5. **Cross-scenario refactor and docs:** run all four rule tags together, update
   README, website, bootstrap, and CLI reference; append the new superseding ADR
   and add reciprocal partial-supersession links to both older ADRs; then run
   full verification.

## Decisions

| Decision | Choice | Alternatives considered | Rejected because |
| --- | --- | --- | --- |
| Running-app behavior | Immutable exact-version bundle; activate when the same task resumes after a full app restart | `safeword@latest` dispatcher; hot-rewrite cached manifest; same-app task proof; requiring a new task | Dynamic behavior bypasses renewed hook review; same-app task activation was disproved live; resume already preserves the authentic task identity. |
| Concurrent proof observation | Recheck exact resumed-task proof for at most 500 ms | Treat the first miss as final; authorize from a profile-wide restart flag; add a challenge protocol | A bounded recheck absorbs host hook ordering without weakening proof; broader flags and caller-readable challenges do not prove the exact task and worktree. |
| Lifecycle proof | Two explicit `@live @manual` checks plus automated Safeword-owned supporting proof | Claim the fake Codex process proves task loading | A subprocess fixture cannot inspect host task state. |
| Marketplace refresh | List, upgrade known Git source, then add plugin | Always add; manually rewrite cache | Always-add obscures refresh semantics; cache mutation bypasses supported CLI operations. |
| Marker migration | New canonical marker plus legacy exact-identity reader | Rename without compatibility; keep misleading name forever | Hard rename strands v0.70 profiles; old terminology falsely implies reboot. |
| Status contract | Result schema v2 with `plugin_installed_app_restart_required` | Mutate the public schema-v1 compatibility field; retain the disproved enum | The canonical v2 state must match required user action while the public compatibility field remains stable. |

## Arch alignment

- **Restart-Bound Codex Plugin Activation** supersedes **Next-Task Codex Plugin
  Activation and Migration Result v2**, which already records its partial
  supersession of **Profile-Scoped Generated Codex Plugin and Staged Hook
  Migration** and **Typed CLI Execution and Discovery**. Unaffected
  version/digest proof, Expand → Prove → Contract, user review, and
  typed-discovery clauses remain accepted.

## Known deviations

The prior ADRs treated schema-1 migration states and restart lifecycle wording
as accepted. This feature deliberately supersedes those clauses with a v2
result and restart-bound activation contract; it preserves the public CLI protocol
envelope and all unrelated trust guarantees.

## Doc impact

- `README.md`: install and upgrade flow, running-app/restarted-app distinction.
- `packages/website/src/content/docs/reference/cli.mdx`: v2 command contract.
- `packages/website/src/content/docs/reference/hooks-and-skills.mdx`: plugin lifecycle.
- `packages/website/src/content/docs/getting-started/quick-start.mdx`: first install and migration flow.
- `packages/website/src/content/docs/getting-started/faq.mdx`: team/profile guidance.
- `ARCHITECTURE.md`: new superseding ADR plus reciprocal links from both older decisions.

## Assessment triggers

Reassess if Codex ships a documented production plugin hot-reload API, exposes
task/plugin identity directly, changes marketplace list/upgrade JSON, or adds a
trust-preserving way to reload changed hooks inside a running task.
