# Impl Plan: Keep native Safeword plugins current

**Status:** implemented

## Approach

The riskiest assumption is that one project SessionStart bootstrap can enroll a missing Codex profile, report that the current task is unprotected, and remain non-blocking. Prove that first with an integration test that executes the real bootstrap handler against an isolated `CODEX_HOME`, observes one stable-ref marketplace install, asserts exit success plus the loud warning, and confirms no PreToolUse hook exists.

Build in five slices:

1. **Task-bound proof and stable source model:** extend the existing native Codex SessionStart proof with the canonical project and hook input `session_id`, stored profile-locally by project. The bootstrap reads the same current SessionStart input and accepts only exact project/session/version/manifest proof; installation metadata and prior-task proof cannot silence it. Then centralize the official repository, `stable` ref, exact-tag classification, and trust rules. Unit-test official legacy refs, stable, prerelease/exact pins, newer pins, malformed sources, and opt-outs. Wire Claude installation to `stable` while preserving explicit exact-tag acceptance fixtures; wire Codex marketplace add/migration to `--ref stable`.
2. **Codex enrollment bootstrap:** add a public SessionStart-safe bootstrap command that checks the inherited native proof above, installs when absent under a profile lock, and always returns success with either silence (current proof) or one prominent warning (unproven/failed). A real hook-order integration fixture proves native SessionStart proof is visible to the bootstrap in the supported ordering; if host ordering changes, the conservative result is a warning, never false silence. Integration-test fresh, pending, proven, prior-task proof, foreign-project proof, failure, and deterministically controlled two-process convergence. The project bootstrap contains no mutation-event hook.
3. **Automatic legacy handoff:** extend the existing finalization transaction so ordinary maintenance first validates the complete legacy plan, installs the profile plugin, then atomically backs up/removes recognized legacy assets and leaves only the SessionStart bootstrap plus preserved user configuration. Existing rollback tests support this; command-level tests prove no confirmation and no cleanup on install failure or ambiguity.
4. **Release promotion:** globally serialize release workflows and add a post-publication job that verifies a non-prerelease npm version before a normal, non-forced push of the release commit to `stable`. Release-contract tests prove prerelease/failure exclusion and reject force or backward movement. Adding this dormant workflow logic does not create or move the live `stable` ref in this task; it can execute only on a future authorized tag-triggered release.
5. **Docs and acceptance wiring:** update README and website installation/migration guidance, retain the host-owned lifecycle scenarios as manual acceptance, and cover Safeword-owned behavior in focused unit/integration tests. Run focused lanes, then the full suite and release contract.

Primary proof is integration at the CLI/host-process boundary with fake `claude` and `codex` executables; pure ref/trust and lock ownership rules use unit tests; workflow policy uses release-contract tests. Stable-channel Gherkin proves Safeword emits and preserves the correct declarations and opt-outs. Actual host fetch timing, last-known-good cache behavior, and current-session activation remain in manual/live smoke lanes because Claude and Codex own those behaviors.

Surface proof:

- Claude Code: native-plugin Gherkin lifecycle plus Claude manual acceptance.
- OpenAI Codex: bootstrap/migration integration tests and Codex live acceptance.
- Safeword CLI: public command catalogue/handler tests and setup/upgrade integration.

## Decisions

| Decision | Choice | Alternatives considered | Rejected because |
| --- | --- | --- | --- |
| Stable delivery | One movable `stable` Git ref advanced after verified npm publication | Exact tags plus a second Safeword updater; repository default branch | Exact tags cannot auto-advance; `main` exposes unreleased commits |
| Codex team enrollment | One committed SessionStart bootstrap invoking the current stable CLI | Retain all legacy hooks; require each developer to run install; commit enrollment markers | Legacy hooks are the junk being retired; manual enrollment creates support churn; profile state is developer-local |
| Unready behavior | Loud advisory that exits successfully and never installs mutation hooks | Fail closed; remain silent | The user explicitly requires work to continue; silence hides missing protection |
| Profile concurrency | Atomic owner-token lock under `CODEX_HOME` with bounded stale recovery | Repository lock; optimistic uncoordinated Codex CLI writes | Profiles are shared across repositories/processes and Codex config writes are not cross-process transactional |
| Migration transaction | Reuse the existing durable finalization backup/rollback engine | New migration journal; delete then install | Reuse preserves proven rollback; delete-first can strand users |
| Release ordering | Global workflow concurrency plus ordinary non-forced stable push | Per-tag concurrency; forced compare-and-swap | Per-tag jobs race; force can move the channel backward |

Figure-it-out evidence: current Claude documentation exposes marketplace auto-update and reload semantics; current Codex source refreshes configured Git marketplaces at startup; isolated Codex 0.146.0 probes showed a ref change requires marketplace remove/re-add and that the enabled plugin declaration survives marketplace removal. Recommend the shared `stable` ref because host-native refresh is the only design that updates both hosts without another updater. Exact tags were close on immutability but cannot satisfy automatic stable convergence. Premortem: this fails if release promotion advances before npm is actually resolvable, so promotion re-verifies the exact public version and leaves the previous ref untouched on any failure.

## Design alignment

| Principle | Consequence | Proof | Conflict |
| --- | --- | --- | --- |
| Optimize for the NTB without constraining the TBU | Enrollment is automatic and messages use one plain recovery action; explicit exact pins and opt-outs remain available | `packages/cli/features/keep-native-plugins-current.feature` | |
| Fire at boundaries, not every turn | Readiness runs only at SessionStart and never on edits or shell commands | bootstrap manifest/config tests | |
| Add, never replace | Only fingerprinted Safeword declarations/assets change; unrelated host configuration survives | migration and profile integration tests | |
| Clarity before correctness | Stable-source classification and bootstrap result states are named domain modules instead of scattered command strings | unit tests for the new modules | |

Architecture decisions honored: schema remains the authority for project-owned migration assets; reconciliation and the existing finalization journal own project mutation; native host caches own plugin payload delivery; release remains CI/OIDC-driven.

## Known deviations

The existing Codex migration contract requires an explicit command, current proof, and confirmation before cleanup. This feature deliberately supersedes that contract only for a fully recognized pre-plugin installation during ordinary maintenance, as required by the accepted scenarios. Ambiguous or edited content remains outside automatic cleanup.

The cross-host feature is tagged `@manual` because advancing the real public
stable ref, exercising Claude's startup updater, and observing Codex's host
cache are host/release behaviors that cannot be truthfully simulated by the
project Cucumber lane. Safeword-owned source selection, migration, locking,
proof binding, warning, and non-blocking behavior are automated in Vitest.

## Doc impact

- `README.md`: explain automatic stable updates and the advisory Codex bootstrap.
- `packages/website/src/content/docs`: document project/user Claude scope, Codex profile-local enrollment, legacy automatic handoff, opt-outs, and reload/restart timing.
- `packages/cli/tests/smoke`: update live acceptance for the stable channel while keeping prerelease trials exact-tagged.

## Assessment triggers

Revisit if Claude or Codex guarantees in-task plugin activation, Codex adds an atomic profile marketplace API or project-declared plugin dependency, GitHub adds a safer immutable-to-channel promotion primitive, or bootstrap startup cost becomes measurable in healthy proven tasks.
