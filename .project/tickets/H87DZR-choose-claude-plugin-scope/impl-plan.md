# Impl Plan: Choose where Safeword runs in Claude

**Status:** implemented

## Approach

The riskiest assumption is that Claude can retain user- and project-scoped
declarations for the same plugin while sharing one physical marketplace cache.
The cheapest load-bearing slice is the existing fresh-install/overlap scenario:
install at user scope, add the same plugin at project scope in an isolated
repository, and observe two declarations without treating the shared cache as
one scope owning the other. An isolated Claude 2.1.170 probe already confirmed
that shape: `plugin list --json` returned separate `user` and `project` entries
with one shared `installPath`, and the project entry carried `projectPath`.
Implementation keeps that real-host trial as release acceptance because the
documented scope contract does not explicitly guarantee same-name overlap.

Build in the following order, leaving each slice green before starting the
next:

1. **Approve the architecture boundary before production changes.** Add an
   accepted decision that supersedes the user-only installation and global
   proof parts of “Generated Native Claude Plugin with Live Proof and Project
   Contraction.” It restates the retained contract: generated native delivery,
   supported Claude CLI mutation, exact cache verification, live execution
   proof, and confirmed project-only legacy cleanup. The replacement decision
   defines project as the default declaration scope, user as the explicit
   alternative, the cache as shared Claude-owned state, overlap as
   action-required, and proof as current-project authority.
2. **Expose one typed scope choice at the CLI boundary.** Add a
   `ClaudePluginScope` of `project | user`, make `project` the catalog and
   handler default, pass the selected scope through typed install input/output,
   and reject missing, `local`, or unknown values before observation or
   mutation. Extend CLI protocol unit/integration tests for parsing, JSON, and
   human output. This is the primary integration proof for TBU1.R1; Cucumber
   proves the public default and explicit choice end to end.
3. **Reconcile scoped declarations without confusing them with shared cache.**
   Replace the first-match profile observation with collection of every
   Safeword plugin entry. Select a project declaration only when its canonical
   `projectPath` equals the current canonical repository; select the user
   declaration independently.

   Use one shared canonical-project contract in the CLI and generated hook
   runtime. The CLI candidate is a nonempty `CLAUDE_PROJECT_DIR` when present;
   otherwise it is `git -C <cwd> rev-parse --show-toplevel`, falling back to
   `cwd` only when the directory is not a Git worktree. The hook candidate is
   the required nonempty `CLAUDE_PROJECT_DIR` with no `cwd` fallback. Both
   require an existing directory and resolve it with `realpath`; the CLI runs
   every project-scoped Claude subprocess from that canonical root. Each
   observed project `projectPath` is independently resolved with `realpath`
   before comparison. A missing, nonexistent, non-directory, or unresolvable
   candidate/`projectPath` never applies and makes selected-project
   verification or cleanup fail closed. Unit and subprocess integration tests
   cover repository subdirectories, symlink aliases, non-Git directories,
   absent hook identity, and unresolvable/mismatched entries.

   Observe marketplace state in two layers. The selected scope's documented
   settings file—project `.claude/settings.json` or the Claude profile's user
   settings—is authoritative for whether that scope declares the `safeword`
   marketplace and its exact official source. `marketplace list --json` is
   authoritative only for the resolved shared checkout and cannot satisfy a
   missing selected-scope declaration. For the selected scope: refuse a
   same-name malformed or non-official declaration; add the exact official
   marketplace with `--scope` when absent; leave it unchanged when exact; then
   re-read both the selected declaration and shared checkout before plugin
   convergence. Observe the other scope before and after and require its
   declaration to be byte-identical. Apply the same selected-scope absent,
   conflict, exact, mutation, re-observation, and preservation algorithm to
   plugin enablement, while plugin payload health remains a shared-cache
   postcondition.

   Continue to use supported `claude plugin` and `claude plugin marketplace`
   commands for all writes. Safeword never writes Claude settings or cache
   files directly. The subprocess fake models only Claude's command boundary
   and supports multiple scoped marketplace/plugin declarations; filesystem
   integration tests assert unrelated project/profile bytes and the other
   declarations are preserved. These are the primary integration proofs for
   TBU1.R2 and TBU1.R3, with unit tests for pure selection and refusal logic.
   The Cucumber scenarios cover fresh, upgrade, disabled, malformed, newer,
   failed, verified, and repeated convergence in both scopes.
4. **Run the load-bearing real-host gate.** Before status or cleanup depends on
   the model, use an isolated Claude profile and two temporary repositories to
   prove: user-old → user-current preserves and leaves project-current
   functional; project-old → project-current preserves and leaves user-current
   functional; `plugin uninstall --scope project` preserves and leaves user
   functional; and `plugin uninstall --scope user` preserves and leaves the
   current project's plugin functional. Reinstall between removal trials and
   assert scoped settings declarations, both `plugin list --json` identities,
   exact cache payload/root, and a helper invocation from the remaining scope.
   A failure stops implementation before status and cleanup are built. Keep
   these four directions in the manual release-candidate runbook because
   same-name cross-scope behavior is empirical rather than explicitly
   guaranteed by Claude's documentation.
5. **Make status explicit about applicability and overlap.** Have the observer
   return zero, one, or two applicable declarations instead of collapsing to a
   single plugin. Status ignores project entries belonging to other canonical
   repositories, falls back to user scope only when no current-project entry
   exists, and classifies two applicable declarations as `scope-overlap` even
   when their versions match. Human and machine output identify both entries
   and provide explicit project- and user-scope native removal commands;
   neither status nor install removes the other declaration. Integration tests
   and the NTB1.R1 Cucumber scenarios are the primary proof.
6. **Bind execution proof to the project that observed it.** Store one
   `${CLAUDE_PLUGIN_DATA}/execution-proofs-v2/<sha256>.json` per project, where
   `<sha256>` is the lowercase SHA-256 of the canonical project root's UTF-8
   bytes. Each schema-v2 file also contains that unhashed canonical root, exact
   plugin version, hook-manifest digest, canonical plugin root, event, session,
   and observation time; readers require both the filename digest and stored
   root to match the current canonical project. Hook dispatch creates the
   directory and writes only that project's file through a same-directory
   temporary file, durable flush, and atomic rename, so project B cannot erase
   project A's proof. A matching v2 file is authoritative; v1 remains readable
   as diagnostic history but never authorizes cleanup.

   “Current proof” has one deterministic predicate and no wall-clock TTL. The
   file must parse as schema 2; its filename digest and stored project root
   must match the current canonical project; its plugin version must equal the
   one exact applicable installed version and `SAFEWORD_SCHEMA.version`; its
   hook-manifest digest must equal both installed `identity.json` and the
   current generated manifest; its canonical plugin root must equal the
   `realpath` of that applicable entry's `installPath`; its event must be
   `SessionStart` or `UserPromptSubmit`; `session_id` must be a nonempty string;
   and `recorded_at` must be an ISO-8601 string that parses and round-trips
   through `Date.toISOString()`. `recorded_at` is diagnostic, not expiration
   authority. Any predicate failure is stale/unproven; an older v1 record never
   overrides either a valid or invalid current-project v2 record.

   Cleanup proceeds only when exactly one applicable declaration has a fresh
   current-project v2 proof; missing, stale, other-project, digest-colliding,
   or overlapping proof fails closed before legacy mutation. Unit tests prove
   key derivation, serialization, v1/v2 precedence, atomic replacement, and
   independent project A/B preservation. Cleanup integration tests assert that
   legacy removal preserves both scoped marketplace/plugin declarations,
   unrelated `.claude/settings.json` values, other projects' proof files, and
   profile state. Those tests plus NTB1.R2 Cucumber scenarios prove the
   authority boundary.
7. **Align generated delivery and customer guidance.** Clarify that project
   scope commits only Claude's marketplace/enablement declarations—not
   framework payload—and that explicit user scope remains. Regenerate the root
   Claude plugin after changing canonical runtime sources, then update every
   document named under Doc impact.
8. **Run final automated and live acceptance.** Remove `@wip` as each rule becomes
   implemented, run focused Cucumber and Vitest coverage after every slice,
   then run the full CLI suite. In fresh temporary Claude profiles and
   repositories, exercise default project install, explicit user install,
   each upgrade, same-name overlap, another-project filtering, preservation,
   project-bound proof, and cleanup refusal. Retain the existing real release
   candidate upgrade trial and add both scope paths to the manual acceptance
   runbook. No merge or release occurs as part of this ticket's implementation
   phase.

This ordering makes the uncertain host representation fail in slice 4 before
status or cleanup depends on it. It introduces no new service or framework:
scope selection, observation, status, and proof remain in their existing
Claude-plugin modules.

## Decisions

| Decision | Choice | Alternatives considered | Rejected because |
| --- | --- | --- | --- |
| Public installation interface | One `safeword claude install --scope project\|user` option, defaulting to `project` | Separate project/user commands; keep user default | Separate commands duplicate lifecycle behavior and invite drift; a user default cannot express a repository's dependency without an extra choice |
| Ownership model | Treat user/project declarations as independent while treating marketplace checkout and plugin bytes as shared Claude-managed cache | Assign the cache to one scope; copy plugin bytes into the repository | Claude reports both scopes against the same cache; cache ownership would make preservation impossible, while vendoring recreates framework churn |
| Observation | Collect all Safeword entries, match current project by canonical `projectPath`, and observe user scope independently | Select the first matching name; infer effective scope from settings alone | Claude lists other repositories' entries and overlap makes first-match incorrect; settings alone do not prove installed cache identity or health |
| Mutation boundary | Let supported Claude CLI commands write scoped settings and cache; read public settings/list output only for observation and preservation proof | Rewrite `.claude/settings.json` or private profile/cache files directly | Direct writes bypass Claude validation and could clobber concurrent or unrelated state |
| Overlap | Return `scope-overlap`, describe both entries, and offer explicit native uninstall actions | Prefer project silently; remove or migrate user automatically | Silent precedence hides ambiguity; automatic removal exceeds requested authority and can break other repositories |
| Execution authority | Write project-bound proof v2; treat global v1 proof as non-authorizing history | Continue global v1 proof; infer project identity from the plugin declaration | A shared user plugin can execute in many repositories, so neither a global timestamp nor declaration proves execution in the current project |
| Supported scopes | Implement `project` and `user`; reject `local` | Include Claude's local scope now | The requested product model is repository-shared or profile-wide; local adds an unrequested third persistence and collaboration contract |

The CLI choices follow Claude's documented scopes and storage boundaries:
[Discover and install plugins](https://code.claude.com/docs/en/discover-plugins),
[Plugins reference](https://code.claude.com/docs/en/plugins-reference), and
[Plugin marketplaces](https://code.claude.com/docs/en/plugin-marketplaces).
The same-name overlap behavior remains an empirically tested host dependency,
not a stronger documentation claim.

## Design alignment

| Principle | Consequence | Proof | Conflict |
| --- | --- | --- | --- |
| Optimize for the NTB without constraining the TBU | Project is the safe zero-choice default; plain-language overlap has a concrete next action; `--scope user` preserves explicit control | `features/choose-claude-plugin-scope.feature` | |
| 1. Structure enforces; instructions suggest | Cleanup code requires one applicable declaration and current-project proof instead of relying on a warning | `features/choose-claude-plugin-scope.feature` | |
| 3. Add, never replace | Selected-scope mutation preserves unrelated settings, repository files, profile state, and the other scope | `features/choose-claude-plugin-scope.feature` | |
| 5. Clarity before correctness | Scope, declaration, applicability, cache, and proof are separate named concepts; no speculative scope abstraction or cache owner is added | `.project/tickets/H87DZR-choose-claude-plugin-scope/spec.md` | |

The plan retains the existing architecture decisions to use Claude's supported
marketplace commands, generated native plugin delivery, live execution proof,
and confirmed project-only legacy cleanup. It deliberately supersedes only the
existing decision's user-only installation and globally scoped proof details.

## Known deviations

The proposed architecture section “Generated Native Claude Plugin with Live
Proof and Project Contraction” currently fixes installation at user scope and
stores one profile-global execution proof. Implementation must add a
superseding accepted decision before changing production behavior. Project
scope is compatible with the original reason for native delivery because it
commits small Claude declarations in `.claude/settings.json`, not Safeword's
framework tree. No other deviation is planned.

## Doc impact

- `README.md`: make project scope the quick-start default and show explicit
  user scope and overlap recovery.
- `plugin/README.md`: describe the generated plugin as compatible with both
  activation scopes and one shared Claude cache.
- `packages/website/src/content/docs/getting-started/quick-start.mdx` and
  `faq.mdx`: explain which scope to choose and what collaborators receive.
- `packages/website/src/content/docs/reference/cli.mdx` and
  `configuration.mdx`: document `--scope`, its default, settings ownership,
  status classifications, and unsupported local scope.
- `packages/website/src/content/docs/reference/hooks-and-skills.mdx`: explain
  project-bound execution proof and why overlap blocks cleanup.
- `packages/cli/tests/smoke/claude-plugin-manual-acceptance.md`: add isolated
  project, user, upgrade, overlap, applicability, and proof trials.

## Assessment triggers

Revisit this design if Claude exposes an effective-scope API, guarantees or
forbids same-name declarations across scopes, makes marketplace listing or
cache paths scope-specific, provides project identity directly to plugin
proof, changes `plugin list --json` scope/`projectPath` output, or moves project
declarations away from `.claude/settings.json`. Also reassess if Safeword later
chooses to support Claude's local scope or gains authority for an explicit
cross-scope migration command.
