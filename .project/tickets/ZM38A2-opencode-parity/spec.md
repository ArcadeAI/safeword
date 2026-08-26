# Spec: Give OpenCode builders full Safeword protection

<!-- safeword:inspiration-contract:v1 -->

## Intent

Make OpenCode a supported Safeword host so builders can use the same behavior-first workflows and automatic safeguards they rely on in Claude Code and OpenAI Codex, without overstating guarantees OpenCode cannot enforce.

## Intake Brief

- **Requested by:** Alex, Safeword maintainer
- **Cost of inaction:** OpenCode builders must switch agents or manually recreate Safeword's process, while Safeword cannot honestly claim cross-host parity and may silently leave users without expected guardrails.
- **Reversibility:** One-way door. It is additive in file terms but durable as a public contract: it expands Safeword's managed-file schema, reconciliation behavior, and compatibility obligations across future OpenCode releases.

## References

- GitHub's repository API resolves both the former `sst/opencode` name and current `anomalyco/opencode` name to canonical `anomalyco/opencode`; tag `v1.18.23` resolves to immutable commit `ef2880f379129aa048be9e9353e30aa168d42c17`, verified 2026-08-25.
- Immutable OpenCode `v1.18.23` sources: [project plugins are `.opencode/plugins/`](https://github.com/anomalyco/opencode/blob/ef2880f379129aa048be9e9353e30aa168d42c17/packages/web/src/content/docs/plugins.mdx#L22), [project commands are `.opencode/commands/`](https://github.com/anomalyco/opencode/blob/ef2880f379129aa048be9e9353e30aa168d42c17/packages/web/src/content/docs/commands.mdx#L83), and [project agents are `.opencode/agents/`](https://github.com/anomalyco/opencode/blob/ef2880f379129aa048be9e9353e30aa168d42c17/packages/web/src/content/docs/agents.mdx#L193); verified alongside `opencode-ai@1.18.23` and `@opencode-ai/plugin@1.18.23`.
- The same pinned runtime loaders literally scan both compatibility forms: [`{plugin,plugins}`](https://github.com/anomalyco/opencode/blob/ef2880f379129aa048be9e9353e30aa168d42c17/packages/opencode/src/config/plugin.ts#L19-L27), [`{command,commands}`](https://github.com/anomalyco/opencode/blob/ef2880f379129aa048be9e9353e30aa168d42c17/packages/opencode/src/config/command.ts#L13-L24), and [`{agent,agents}`](https://github.com/anomalyco/opencode/blob/ef2880f379129aa048be9e9353e30aa168d42c17/packages/opencode/src/config/agent.ts#L11-L22). Safeword uses the plural paths named by stable docs; real-process discovery remains the executable proof.
- Published `@opencode-ai/plugin@1.18.23` stable types expose both `sessionID` and `callID` to `shell.env`, `tool.execute.before`, and `tool.execute.after`; package tarball inspected 2026-08-25.
- Pinned runtime source executes [`tool.execute.before` before the built-in tool and `tool.execute.after` after it](https://github.com/anomalyco/opencode/blob/ef2880f379129aa048be9e9353e30aa168d42c17/packages/opencode/src/session/tools.ts#L101-L123), while the shell tool passes the same context identifiers to [`shell.env`](https://github.com/anomalyco/opencode/blob/ef2880f379129aa048be9e9353e30aa168d42c17/packages/opencode/src/tool/shell.ts#L415-L423); verified 2026-08-25.
- The pinned OpenCode test harness already proves the credential-free conformance mechanism: its [`testProviderConfig`](https://github.com/anomalyco/opencode/blob/ef2880f379129aa048be9e9353e30aa168d42c17/packages/opencode/test/lib/test-provider.ts) configures `@ai-sdk/openai-compatible` against a loopback URL with a deterministic tool-capable model, its [`TestLLMServer`](https://github.com/anomalyco/opencode/blob/ef2880f379129aa048be9e9353e30aa168d42c17/packages/opencode/test/lib/llm-server.ts) serves `/v1/chat/completions` and queues exact tool calls, and its [CLI process fixture](https://github.com/anomalyco/opencode/blob/ef2880f379129aa048be9e9353e30aa168d42c17/packages/opencode/test/lib/cli-process.ts) launches the real CLI with that provider. Safeword's conformance harness will vendor the minimum protocol fixture from those pinned sources rather than depend on OpenCode's test package or a model credential.
- The pinned config loader merges explicit `plugin` entries from `opencode.json` and then adds auto-discovered project plugins through [`ConfigPlugin.load`](https://github.com/anomalyco/opencode/blob/ef2880f379129aa048be9e9353e30aa168d42c17/packages/opencode/src/config/config.ts#L423-L465); [`deduplicatePluginOrigins`](https://github.com/anomalyco/opencode/blob/ef2880f379129aa048be9e9353e30aa168d42c17/packages/opencode/src/config/plugin.ts#L55-L69) removes only the same plugin identity, retaining the later project-local discovery. Verified 2026-08-25.
- Stable plugin initialization receives an OpenCode SDK [`client`](https://github.com/anomalyco/opencode/blob/ef2880f379129aa048be9e9353e30aa168d42c17/packages/plugin/src/index.ts#L56-L66), and the pinned SDK exposes [`session.messages`](https://github.com/anomalyco/opencode/blob/ef2880f379129aa048be9e9353e30aa168d42c17/packages/sdk/openapi.json#L6092-L6199) with typed tool-part states (`pending`, `running`, `completed`, `error`) for challenge-independent liveness checks; verified 2026-08-25.
- OpenCode commit `ef2880f379129aa048be9e9353e30aa168d42c17` carries the [MIT License](https://github.com/anomalyco/opencode/blob/ef2880f379129aa048be9e9353e30aa168d42c17/LICENSE); verified 2026-08-25.
- Pinned OpenCode [`v1.18.23` skills documentation](https://github.com/anomalyco/opencode/blob/ef2880f379129aa048be9e9353e30aa168d42c17/packages/web/src/content/docs/skills.mdx#L13-L30) documents both `.claude/skills/**/SKILL.md` and `.agents/skills/**/SKILL.md` compatibility sources; the required real-process discovery test is the executable fallback if a later release changes either alias.
- [OpenCode official repository issue #12472](https://github.com/anomalyco/opencode/issues/12472) and [issue #17412](https://github.com/anomalyco/opencode/issues/17412), checked 2026-08-25 for the stable plugin API's session-idle continuation gap
- Safeword's existing Claude Code, OpenAI Codex, and Cursor integrations

## Personas

- Technical Builder (TBU)
- Non-Technical Builder (NTB)
- Safeword Maintainer (SWM)

## Surfaces

Affected:

- OpenCode
- OpenAI Codex — its packaged-plugin adapter joins the shared integration contract without restoring retired project-owned Codex skills.
- Claude Code — its adapter joins the shared host contract with externally compatible behavior.
- Cursor — its adapter joins the shared host contract with externally compatible behavior.
- Safeword CLI
- GitHub Actions Execution Sandbox — a required fail-don't-skip OpenCode parity lane provisions the pinned host and verifies immutable upstream references.

Unaffected:

- Claude Code Cloud — cloud-host-specific lifecycle and deployment behavior are outside this local-host integration.
- Claude Code on the Web — the browser entry point is outside this local-host integration.
- OpenAI Codex Cloud — local host selection owns managed-entry removal, and any resulting repository change is observed through OpenAI Codex rather than a separate cloud adapter.
- Cursor Cloud Agents — cloud-agent lifecycle and environment behavior are outside this local-host integration.
- Closeout Cleanup Guard — destructive closeout authorization is unchanged.
- Retro Filer — retrospective transport and acknowledgements are unchanged.
- GitHub Pull Request Conversation — review receipt publication is unchanged.
- GitHub Pull Request Review — review lifecycle and inline comments are unchanged.
- Railway Hosted Relay — hosted retro transport is unchanged.

## Vocabulary

- **Agent integration:** Safeword's connection to a coding-agent application such as Claude Code, OpenAI Codex, OpenCode, or Cursor. It does not mean the computer, operating system, server, or AI model.
- **Integration adapter:** The internal implementation of the shared installation, reconciliation, status, and lifecycle contract for one agent integration.
- **Canonical skill source:** The authored `packages/cli/templates/skills` catalogue. Claude and OpenCode consume its existing `.claude/skills` project delivery; Codex consumes a generated packaged-plugin delivery. Safeword does not restore its retired `.agents/skills` copies.
- **Activation evidence:** A versioned, project-bound observation written when the installed host integration actually loads or handles a lifecycle event. It proves that observation, not continuous liveness or tamper resistance.
- **Conformance evidence:** The result of a credential-free real-process check that proves a pinned host version loads Safeword, discovers the native catalogue, invokes the pre-tool guard, and prevents a sentinel side effect.
- **Lifecycle capability:** A host-declared boundary of `block`, `observe`, or `unavailable` for a named event. Status never promotes observation into blocking.
- **Native catalogue bridge:** OpenCode discovers canonical workflow bodies through its documented `.claude/skills` compatibility loader. Safeword generates thin managed Markdown stubs in `.opencode/commands` and `.opencode/agents` that select those skills without copying their bodies; no symlinks or duplicate workflow source are used.
- **Truthful parity:** The same user outcome across hosts, with weaker host capabilities reported explicitly instead of presented as equivalent enforcement.

## Product Inspiration

<!-- prettier-ignore -->
| Reference | Checked on | Source version / edition | Customer-value evidence | Principle to borrow | Non-copy boundary | Decision impact |
| --- | --- | --- | --- | --- | --- | --- |
| [Codex hooks](https://learn.chatgpt.com/docs/hooks) | 2026-08-25 | Current Codex documentation | Codex makes hook provenance visible, requires review of non-managed hook hashes, and marks changed definitions for review before they run. | Install executable enforcement intentionally at profile scope and expose activation evidence separately from project content. | Do not copy Codex's configuration grammar, trust UI, or claim that a host hook is a complete security boundary. | changed: move OpenCode enforcement from a committed project plugin to a profile plugin while keeping project workflows declarative. |
| [OpenCode plugins](https://dev.opencode.ai/docs/plugins/) | 2026-08-25 | OpenCode 1.18.23 stable documentation and pinned source | OpenCode supports global and project plugins, runs every loaded hook sequentially, and demonstrates `tool.execute.before` denial as the native way to protect a tool boundary. | Use OpenCode's native global plugin and blockable pre-tool hook rather than emulate another host's transport. | Do not copy automatic project-plugin execution, flatten observational lifecycle events into blocking guarantees, or depend on the beta V2 API. | changed: ship a stable-1.x capability adapter with real denial and conformance; defer the OpenCode-only IPC receipt system. |

The transferable principle is separation of executable trust from portable
workflow content. Safeword should intentionally install a profile plugin, keep
skills/commands/agents as reviewable project assets, and describe each host by
what its native lifecycle can actually prove.

## Jobs To Be Done

### opencode-parity.TBU1 — Use Safeword without switching agents

**Persona:** Technical Builder (TBU)

> When I build software in OpenCode, I want Safeword's workflows and guardrails to install and run as a supported integration, so I can keep my chosen agent without giving up the engineering process I trust.

#### opencode-parity.TBU1.R1 — Selecting OpenCode installs its native Safeword catalogue and guard without changing the default host selection

#### opencode-parity.TBU1.R2 — Covered OpenCode tool calls are denied before execution when they violate an active Safeword gate

#### opencode-parity.TBU1.R3 — Install, upgrade, status, and uninstall preserve user-owned OpenCode content and shared-host assets

#### opencode-parity.TBU1.R4 — A credential-free real-process check proves supported OpenCode versions load Safeword, discover its catalogue, and honor denial

### opencode-parity.NTB1 — Know whether OpenCode is truly protected

**Persona:** Non-Technical Builder (NTB)

> When I direct OpenCode without auditing every technical step, I want Safeword to plainly distinguish enforced protection from advisory guidance, so I can trust the status it reports and respond when protection is incomplete.

#### opencode-parity.NTB1.R1 — OpenCode health says what is installed, what was observed, and what boundary can block in plain language

#### opencode-parity.NTB1.R2 — Every incomplete or unsupported OpenCode state yields one truthful summary and at most one concrete next action

#### opencode-parity.NTB1.R3 — Observational lifecycle events and stale evidence never appear as current blocking protection

### opencode-parity.SWM1 — Add hosts through one explicit contract

**Persona:** Safeword Maintainer (SWM)

> When I add or evolve an agent host, I want one declarative adapter and parity contract to define its owned files, shared assets, lifecycle capabilities, and proof, so I can extend Safeword without scattering host-name branches or creating conflicting ownership.

#### opencode-parity.SWM1.R1 — Every agent integration declares owned files, shared assets, lifecycle capabilities, activation evidence, and conformance through one adapter contract

#### opencode-parity.SWM1.R2 — Aggregate reconciliation removes a shared managed asset only when no selected host consumes it

#### opencode-parity.SWM1.R3 — Cross-integration contract tests fail when an adapter overstates a capability or bypasses the common lifecycle

## Rave Moment

“I switched Safeword to OpenCode, and the same forbidden action was blocked
before it ran—without copying workflows or teaching the agent a new process.”

It beats the expectation that changing agents means rebuilding guardrails by
hand. The one-sentence peer test is: “Safeword made OpenCode behave like the
same careful teammate after one explicit install.”

## Candidate Design

- OpenCode is an explicit host selection; the Claude-plus-Codex default remains unchanged.
- Executable enforcement is an intentionally installed profile plugin under OpenCode's global configuration root. Project files contain only declarative commands and agents plus the existing `.claude/skills` delivery that OpenCode natively discovers.
- A shared integration-adapter contract describes owned files, shared assets, install/observe/uninstall operations, lifecycle capabilities, activation evidence, and conformance evidence for Claude Code, OpenAI Codex, OpenCode, and Cursor.
- OpenCode stable 1.x uses `tool.execute.before` for blockable policy checks, `tool.execute.after` and session events for observation, and `shell.env` only to carry host identifiers needed by the existing event-proof pattern.
- Status keeps installation, activation, blocking capability, and conformance as independent dimensions. Human output derives one deterministic healthy/action-required/advisory summary and at most one next action.
- A credential-free real-process fixture proves the pinned stable baseline loads the profile plugin, denies a sentinel tool call before its side effect, and discovers one command, agent, and canonical skill.
- Exact-call IPC receipts, sockets/named pipes, liveness sweepers, executable-chain digests, plugin-exclusivity claims, beta V2 support, and committed executable project plugins are deferred.

## Resolved Engineering Contracts

### Integration adapter

One registry entry per integration declares `id`, `defaultSelected`, project
surface filters, profile support, lifecycle capabilities, activation evidence,
and conformance policy. Its operations are `observe(context)`,
`install(context)`, `uninstall(context)`, and `effects(context)`, all returning
the existing `CliResult`/`Effects` protocol. The lifecycle coordinator iterates
the registry; host names do not create new coordinator branches. Existing
Claude and Codex migration logic stays behind their adapters, Cursor remains a
project-only adapter, and OpenCode owns both project catalogue assets and its
profile plugin. CLI `upgrade` is install-over-existing state and therefore uses
the adapter's `install(context)` operation rather than defining a fifth adapter
operation.

The normalized lifecycle vocabulary is `session_start`, `prompt_submit`,
`pre_tool`, `post_tool`, and `stop`, each declared as `block`, `observe`, or
`unavailable`. A contract test rejects duplicate IDs, undeclared owned paths,
blocking claims without a blockable hook, and profile operations without a
profile descriptor.

The project reconciliation surface is not an integration adapter. Lifecycle
results always place that surface first, followed by selected integration
adapters in the literal declaration order Claude, Codex, OpenCode, Cursor.
Contract tests inject a conforming
sentinel adapter so a hard-coded host-name branch cannot satisfy coordination.
Claude/Codex/Cursor compatibility fixtures are captured once from origin/main,
canonicalized with sorted entries, project-relative paths, a fixed clock, and a
Safeword-version placeholder, and reviewed as immutable regression inputs. They
are not regenerated merely to approve a changed adapter result.

### Selection and reconciliation

`--agents` is the authoritative selection for that invocation. Omitting it
retains the existing `claude,codex` default byte-for-byte; Safeword does not
infer or persist a new OpenCode selection from PATH, user config, or stray
files, including Safeword-managed assets left by a prior explicit OpenCode
installation. Install, status, and plan inspect only selected integrations.
Repository-wide
uninstall keeps its existing compatibility sweep for legacy Cursor assets and
adds an OpenCode sweep only when Safeword-managed OpenCode project assets are
present; it never installs or probes OpenCode during that sweep.
Profile-root resolution completes before any OpenCode project or profile
mutation. If no root can be resolved, install, uninstall, and status report
action-required without creating, removing, or changing OpenCode assets, and
conformance reports action-required without creating evidence. On Unix,
`USERPROFILE` alone is not a fallback when `HOME` is unavailable.
If a root resolves but the atomic staging destination is not writable, install
reports action-required and leaves no partial plugin, staging file, identity,
project mutation, or changed user content.

Within selected adapters' declared surfaces, project assets are derived as the
union of those selected adapters' schema filters. Reconciliation does not
inspect or remove an unselected adapter's owned surface merely because its
assets are absent from that union. An inspected asset is removed only when it
is Safeword-owned and absent from the applicable selected-surface union.
The `.claude/skills` delivery is retained whenever Claude or OpenCode consumes
it, while Codex continues to use its packaged plugin. User-authored siblings
and modified managed files follow the existing reconciliation conflict rules.

### OpenCode catalogue

OpenCode receives one `.opencode/commands/<name>.md` stub for every entry in
the canonical action-command inventory and one `.opencode/agents/<name>.md`
stub for every canonical Safeword subagent. Each subagent inventory entry
declares exactly one procedure target, removing any choice at generation time.
Generation is data-driven from the
same inventories used by Cursor/Claude, so a new workflow cannot land on one
surface only. A command stub contains OpenCode frontmatter plus one instruction
to load the exact named skill and pass `$ARGUMENTS`; an agent stub contains
OpenCode frontmatter plus one instruction to load its inventory-declared
procedure target. Schema and parity tests compare the complete derived sets.

OpenCode loads the workflow bodies from `.claude/skills`, a documented stable
compatibility source. Safeword-owned `.agents/skills` remains retired.

### Enforcement coverage

The stable plugin maps OpenCode `bash`/`shell` input `command`, `edit`/`write`
input `filePath`, and `patch` input `patchText` (extracting each
`*** Add File`, `*** Update File`, and `*** Delete File` target) into the
existing canonical PreToolUse envelope. It invokes the version-pinned Safeword pre-tool dispatcher with
`SAFEWORD_AGENT_RUNTIME=opencode` and exit-code denial mode. Exit 0 allows;
exit 2 throws the sanitized denial reason before the native tool executes; any
spawn, parse, timeout, or unexpected-exit failure denies closed. Unknown tools
are still observed but are classified as uncovered rather than blocking.
The plugin spawns the dispatcher directly without a shell and transports all
host-controlled tool input only as structured envelope data; it never
interpolates a command or path into a shell command line.

The conformance sentinel asks the real CLI to call `bash` with a command that
would create a randomized file under a temporary directory while an armed test
policy denies it. Passing requires a surfaced denial and absence of that file.
The same run proves a command, an agent, and a skill are discoverable.

### Profile plugin ownership

The managed plugin is `<config-root>/plugins/safeword.js`, where config root is
non-blank `OPENCODE_CONFIG_DIR` when set, otherwise non-blank
`$XDG_CONFIG_HOME/opencode`, otherwise the documented cross-platform
`~/.config/opencode` convention (`USERPROFILE/.config/opencode` on native
Windows, taking precedence over a simultaneously set `HOME`).
Tests always inject the
root; install never edits `opencode.json`.

The plugin and `safeword/identity-v1.json` are staged beside their destinations,
fsynced where supported, and atomically renamed under a profile lock so an
interrupted or concurrent install never exposes a partial plugin. Identity
binds schema version, Safeword version, plugin SHA-256, and managed relative
path. An existing unrecognized file at the managed path is preserved and
reported action-required. Recognized drift is repaired on install; uninstall
removes only a hash-matching managed plugin and identity, preserves collisions
or user changes, and prunes only empty Safeword-owned directories.
When the plugin bytes were modified after installation, uninstall preserves
both those bytes and the unchanged identity, reports managed drift, and leaves
future repair as an explicit action rather than silently choosing for the user.

Partial profile states are explicit. If canonical plugin bytes exist without an
identity, install may reconstruct the matching identity, while uninstall and
status preserve the plugin and require identity repair. If the identity path is
unreadable or unrecognized, every lifecycle operation preserves both paths and
reports the identity collision. If a valid recognized identity exists without
its bound plugin, install restores the plugin atomically, uninstall removes the
orphan identity and bounded OpenCode evidence, and status reports the single
install action without mutation.

### Evidence and status

Activation evidence is
`<config-root>/safeword/activation-v1/<project-sha256>.json` with schema version,
Safeword version, plugin hash, canonical project hash, OpenCode version when
available, event, session ID hash, call ID hash when the event is call-bound,
and `observed_at`. For a marked project, the plugin writes it atomically after
load with event `plugin_load` and after each handled hook. A project-less load
does not create activation evidence. It is current only when its
schema/version/plugin/project bindings match the installed identity and it is
no older than seven days; malformed, mismatched, future-dated, and older
records are stale observations, never blocking proof.

Conformance evidence is
`<config-root>/safeword/conformance-v1/<opencode-version>-<plugin-hash>.json` and
records schema version, exact OpenCode and Safeword versions, platform/arch,
plugin hash, the four catalogue/denial booleans, `checked_at`, and the final
result. It contains no prompts, commands, paths, environment, or model output.
Evidence is accepted only when schema, Safeword version, OpenCode version,
plugin hash, platform, and architecture match the current execution boundary.
It does not expire by age alone; a changed executable boundary or plugin
invalidates it and requires conformance to run again. `checked_at` is diagnostic
and future-dated conformance is not rejected solely for clock skew because age
is not an acceptance dimension.

The global plugin first resolves a canonical project carrying a Safeword marker.
Without one it returns without spawning a dispatcher or changing the tool call.
Marker resolution has a bounded deadline. If permission failure or timeout
prevents the plugin from deciding whether a marker exists, it self-disables for
that operation, spawns no dispatcher, records only a bounded profile-level
`marker_resolution_failed` observation, and lets the operation proceed. That
observation invalidates current activation for status and yields exactly one
`safeword install --agents=opencode` action; it contains no project path or raw
error. This availability choice prevents a profile-global plugin from denying
unrelated OpenCode projects when classification itself is unavailable.

Once a project marker is confirmed, malformed mapped input and all dispatcher
failures deny closed. If the identity-bound pinned dispatcher is absent, pruned,
or moved, the denial contains only a sanitized
`safeword install --agents=opencode` repair. Status treats dispatcher
resolvability as part of `installed`, prioritizes reinstall over stale-
activation restart, and never accepts older activation or conformance as proof
of a now-unresolvable executable boundary. The profile plugin's identity-bound
Safeword version is authoritative for every project it handles; a profile
upgrade replaces that plugin/identity atomically and invalidates prior proof.

Explicit `uninstall --agents=opencode` removes recognized Safeword-owned
OpenCode project assets, the hash-matching managed profile plugin and identity,
and all bounded activation, conformance, and profile-error evidence bound to
that removed profile plugin while preserving other projects' project assets
and all user content. Ordinary project sweeping leaves the inert-capable
profile integration in place.

Activation evidence is diagnostic rather than part of the allow/deny decision.
If its atomic persistence fails, the plugin sanitizes the observation failure
and preserves the dispatcher's decision: an allowed operation still proceeds
and a denied operation remains denied. Health cannot claim current activation
until a valid record is successfully written.

Profile-level resolution-failure evidence lives at
`<config-root>/safeword/profile-error-v1.json` with only schema version,
Safeword version, plugin hash, error code, and `observed_at`. It is atomically
replaced, contains no project/session/call/path/error text, and is cleared by a
successful classified hook or explicit uninstall.

Status derives four independent dimensions: `installed`, `activated`,
`pre_tool=block|observe|unavailable`, and `conformant`. Missing/colliding/drifted
installation or failed conformance is `action_required`; a valid install with
block capability but missing/stale activation is `action_required`; valid
handled-hook evidence on the supported CLI/TUI baseline is `healthy`; an
unblockable lifecycle boundary is `healthy` with an advisory finding. Desktop
is documented unsupported rather than inferred from evidence the stable plugin
API does not expose. Priority
for the sole next action is plugin collision, identity collision, managed
drift, install, conformance check, then restart/activate. An unresolved config
root is evaluated before profile evidence and yields only the config-root
action because no evidence under an unresolved root can be trusted. Advisory
findings never add a second action.

### Supported versions and CI

The initial guaranteed baseline is exactly OpenCode CLI/TUI `1.18.23` on the
platforms exercised by required CI. Other stable `1.x` versions are reported
unsupported until that exact version earns passing local conformance; V2 and
Desktop blocking parity are unsupported. Conformance launches an explicitly
resolved executable without a shell, in a temporary HOME/config/project,
against a loopback OpenAI-compatible server with a randomized bearer token in
the environment. The public, host-neutral entry point is
`safeword conformance --agents=<integration>`; OpenCode health recommends that
exact command when its conformance dimension is missing or invalid. The
required CI lane installs the pinned package by immutable version, fails rather
than skips, and persists only the bounded evidence above.

## Open Questions

None. The cold-start gaps are resolved by the contracts above; scenario design
may refine examples but may not broaden these boundaries silently.
