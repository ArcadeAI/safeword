# Keep native plugins current for builders

## Intake Brief

- **Requested by:** The Safeword maintainer, extending the native-plugin work from GitHub issue 1785 and the post-0.70 hardening series.
- **Cost of inaction:** Claude users remain on an old exact tag until they manually reinstall, while Codex users can currently receive unreleased commits because the configured marketplace follows the repository's default branch.
- **Reversibility:** Cross-cutting release and migration contract. The implementation is reversible in code, but a moved public channel affects every opted-in installation and therefore must be promoted only by the verified release path.

## Surfaces

Affected:

- Claude Code
- OpenAI Codex
- Safeword CLI

Unaffected:

- Claude Code Cloud — native local marketplace persistence is not guaranteed there
- OpenAI Codex Cloud — user-level local plugin marketplaces do not apply there
- Cursor — its existing project-file auto-upgrader is unchanged

## Jobs To Be Done

### keep-native-plugins-current.TBU1 — Receive verified stable improvements without reinstalling

**Persona:** Technical Builder (TBU)

> When Safeword publishes a stable release, I want my trusted Claude Code or
> Codex installation to update through the agent's normal lifecycle, so I
> receive fixes without manually reinstalling or consuming unreleased code.

#### keep-native-plugins-current.TBU1.R1 — An eligible stable installation advances only to the latest verified stable Safeword release through its host's normal update lifecycle

#### keep-native-plugins-current.TBU1.R2 — An explicitly selected prerelease or exact-version installation remains pinned outside the stable channel

#### keep-native-plugins-current.TBU1.R3 — A host-level update opt-out remains authoritative and is never bypassed by Safeword

#### keep-native-plugins-current.TBU1.R4 — The first eligible upgrade installs the native Codex plugin, creates the enrollment bootstrap, and transactionally backs up and removes every recognized legacy Codex asset

#### keep-native-plugins-current.TBU1.R5 — A later developer's first Codex task enrolls only that developer's profile from the committed bootstrap without rewriting the repository

### keep-native-plugins-current.NTB1 — Stay protected without learning plugin release mechanics

**Persona:** Non-Technical Builder (NTB)

> When I use my agent after a Safeword release, I want it to stay on the latest
> verified stable Safeword and plainly tell me if I need to reload, so I remain
> protected without understanding tags, marketplaces, or plugin caches.

#### keep-native-plugins-current.NTB1.R1 — After stable-channel enrollment, ordinary releases require no repeated Safeword installer command

#### keep-native-plugins-current.NTB1.R2 — When a host cannot activate an updated plugin in the current session, it gives one plain reload or next-session action

#### keep-native-plugins-current.NTB1.R3 — A failed background update leaves the last known-good plugin available

#### keep-native-plugins-current.NTB1.R4 — A failed channel migration gives one resumable recovery action instead of silently leaving protection absent

#### keep-native-plugins-current.NTB1.R5 — An eligible pre-plugin project enters the native-plugin path during ordinary Safeword maintenance without a dedicated migration command or human confirmation

#### keep-native-plugins-current.NTB1.R6 — Every Codex task checks stable-plugin readiness at startup and prominently explains any unready state before work begins

#### keep-native-plugins-current.NTB1.R7 — Until exact profile-, project-, version-, and task-bound native proof exists, every task prominently warns that Safeword protection is not active without preventing the builder from continuing

#### keep-native-plugins-current.NTB1.R8 — A readiness warning says in plain language what is missing, explains that work may continue without Safeword protection, and gives exactly one action that restores protected work

#### keep-native-plugins-current.NTB1.R9 — Failed automatic enrollment names the understandable cause and gives one retry action while leaving the builder free to continue unprotected

### keep-native-plugins-current.SWM1 — Keep the installed base current without support churn

**Persona:** Safeword Maintainer (SWM)

> When Safeword publishes a stable release, I want supported local Claude Code
> and Codex plugin installations to move to it through their normal update
> lifecycle, so known-version drift does not become recurring support work.

#### keep-native-plugins-current.SWM1.R1 — One stable channel identifies the same released Safeword version for Claude Code and Codex

#### keep-native-plugins-current.SWM1.R2 — The stable channel advances only after a verified non-prerelease npm publication succeeds

#### keep-native-plugins-current.SWM1.R3 — A prerelease, failed publication, or failed channel promotion leaves the previous stable release authoritative

#### keep-native-plugins-current.SWM1.R4 — Migration rewrites only a trusted official Safeword declaration and preserves unrelated host configuration

#### keep-native-plugins-current.SWM1.R5 — A malformed, newer, or third-party declaration is left untouched and reported as requiring explicit resolution

#### keep-native-plugins-current.SWM1.R6 — The enrollment bootstrap is the only Codex compatibility asset retained after the first upgrade; it is inert after current native SessionStart proof

#### keep-native-plugins-current.SWM1.R7 — Concurrent Safeword operations against one Codex profile serialize and converge idempotently without exposing partial marketplace or plugin state

#### keep-native-plugins-current.SWM1.R8 — Enrollment state lives only in each Codex profile, so one developer's installation neither marks nor mutates another developer's state

#### keep-native-plugins-current.SWM1.R9 — Concurrent release workflows may advance the stable channel monotonically and can never move it backward

## Terms

- **Eligible stable installation:** A supported local Claude Code or Codex installation using the official Safeword marketplace, with network access and its host's native updater enabled.
- **Eligible pre-plugin project:** A configured project with a recognized, unmodified Safeword legacy installation, a supported local host, and the prerequisites needed to install that host's native plugin. Ambiguous or user-edited legacy assets are ineligible for automatic removal.
- **Stable channel:** The movable official Git ref advanced by Safeword's verified stable-release workflow.
- **Trusted official declaration:** A marketplace declaration whose normalized source is the ArcadeAI/Safeword repository and whose ref is the stable channel, the legacy default branch, or a valid Safeword release tag that would not require a downgrade. Repository-name matches, forks, malformed refs, and newer exact tags are not trusted for automatic migration.
- **Channel migration:** The one-time conversion of a trusted exact-tag or default-branch marketplace declaration to the stable channel.
- **Ordinary Safeword maintenance:** A current `setup` or `upgrade` run, including the existing project auto-upgrader where that updater is already active. A previously released Codex-only legacy hook cannot acquire new behavior until a current Safeword CLI maintenance run occurs.
- **Pre-plugin handoff:** The first eligible upgrade installs the upgrader's native plugin, commits the minimal enrollment bootstrap, and transactionally backs up and removes the finite recognized Codex legacy allowlist. Each later developer enrolls independently through the bootstrap.
- **Enrollment bootstrap:** The single small committed Codex compatibility hook retained after migration. At SessionStart it ensures the local profile has the stable plugin and prominently warns until a later task produces current identity-bound SessionStart proof. Once proof is current, it is an inert no-op.
- **Codex profile lock:** An atomic, owner-identified, time-bounded lock under `CODEX_HOME` that serializes Safeword marketplace and plugin mutations across Codex tasks and processes; stale ownership is recoverable and a non-owner never removes a live lock.

## Concurrency Contract

- Repository maintenance uses one lock rooted in Git's common directory, so worktrees and concurrent tasks share the same exclusion boundary.
- Codex profile enrollment and channel migration use a separate profile lock because `CODEX_HOME` is shared across repositories and Codex processes.
- A process that loses either race performs no mutation, then observes the winner's completed state or reports one retry action.
- Bootstrap enrollment state and proof are local-profile and canonical-project evidence; no installed marker is committed to the repository.
- Release promotion uses a non-forced compare-and-swap/fast-forward update under globally serialized stable-release workflow concurrency.

## Codex Readiness Message Contract

The bootstrap reports readiness at SessionStart:

> Safeword is installed for your Codex profile but is not active in this task
> yet. You can continue, but Safeword will not protect this task. Start a new
> Codex task in this repository to work with Safeword active.

It does not intercept edits or shell commands. When enrollment failed, the
startup warning names the plain-language cause, states that work may continue
without Safeword protection, and gives exactly one retry command.

## Rave Moment

skip: table-stakes — invisible, trustworthy updates are expected maintenance rather than a shareable peak.

## Open Questions

None.

## Decision Record

Recommend **a release-promoted `stable` Git ref consumed by both hosts' native
updaters** because it gives one audited publication boundary without adding a
second updater. Exact tags plus a package hook were close on immutability but
duplicate host lifecycle machinery and cannot make loaded skills current in the
same prompt. Tracking the default branch is smaller but exposes unreleased
commits, which is already the Codex failure mode.

**Premortem:** The channel fails six months from now because npm publishes but
the ref cannot advance; make promotion a separate no-project-code release job,
fail visibly, and leave the prior stable ref untouched on any error.

**Evidence:** Claude Code documents background marketplace auto-update plus
explicit reload semantics; current Codex source performs configured Git
marketplace auto-upgrade and cache refresh at startup.
