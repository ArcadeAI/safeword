# Isolate native resource failure without losing shared protection

Review plan: exact SDK transform ordering and lifetime, resource/guard failure
isolation, conservative V1 ownership, absence of a second policy/content owner,
and actual native proof. This is a PR 2 component, not completion of the public
optional-status or required-registration scenarios and not customer admission.

Executable RED 4a739f32-541a-4e73-8174-962f488f474a (Claude/opus) approves the
CLI/TUI failure V2_OPTIONAL_FAILURE_HIDES_GUARD, exit 2 without timeout or signal.
The attested output identifies native failed state and Skill.Info.description
schema rejection before the protected-write assertion. Earlier approval
87c47228-b075-4ada-ad00-009be244bead was strengthened with exact issue-path
checks, cause output and candidate resource-base assertions before production.

Skill.Info construction and editor updates are now isolated per canonical
catalogue entry. A rejected skill emits its name and actual native exception
without throwing out the unrelated shared guard or healthy skills. Before
replacement, inspect every same-name effective entry. Only entries whose paths
and current bytes match the existing V1 identity inventory can be removed from
V2's effective catalogue. Unknown or modified entries are preserved and the
colliding native resource is rejected. No V1 file is deleted or rewritten. The
existing identity parser owns the allowed path/inventory shape; the shared
schema now owns that existing identity path, used by both the V1 writer and SDK
reader. Native skill names still use the single shared OpenCode naming function.

Actual observation resolved an ordering constraint: the first transform saw
only preceding native entries; V1 file discovery runs in an internal post
plugin after user package setup. A setup-only edit cannot replace those later
entries. Figure-it-out compared event-driven re-registration, first-prompt
registration, and suppressing discovery. An event callback would race the first
prompt, while suppressing discovery affects unrelated user resources.

The chosen bounded mechanism keeps initial discovery and moves that transform
once, after all activation, at the public prompt hook. One Promise serializes
concurrent first prompts. Exact 2.0.32 SessionPrompt.prepare awaits activation
and this hook before resolving requested skills. The old registration is
disposed; its replacement runs after the built-in file transform. SDK scope
owns both registrations. No private API, timer, polling loop, event daemon or
per-host permission predicate is introduced.

The actual optional-registration probe passes CLI and TUI against generated
native-v2-registration-green-4, log /tmp/safeword-opencode-registration-green-3.log.
Evidence roots opencode-native-rwZqLF and opencode-native-2RwoT4. It observes
three actual native tool results: malformed explain unavailable with no old
V1 fallback, healthy cleanup-zombies loaded from the candidate's own skill
directory, and protected shell denied. The shared runtime dispatch has status 2,
canonical project, exact command and the same native session as the attempt.
The native plugin remains active, and source/candidate bytes match.

This only establishes resource invocation after prompt admission. Pre-prompt UI
catalogue ordering, public status, required-registration truth, complete native
command entrypoints, mutation tool inventory, and final admission remain open.
In particular, console diagnostics are not sealed conformance or a substitute
for the later public status implementation. No full scenario is checked off.

The existing isolated SDK pin/dependency audit is unchanged. Current primary
sources consulted:
[activation order](https://github.com/anomalyco/opencode/blob/v2.0.32/packages/core/src/plugin/supervisor.ts),
[post plugins](https://github.com/anomalyco/opencode/blob/v2.0.32/packages/core/src/plugin/internal.ts),
[file discovery](https://github.com/anomalyco/opencode/blob/v2.0.32/packages/core/src/config/plugin/skill.ts),
[ordered transforms](https://github.com/anomalyco/opencode/blob/v2.0.32/packages/core/src/state.ts),
[prompt ordering](https://github.com/anomalyco/opencode/blob/v2.0.32/packages/core/src/session/prompt.ts),
[Promise registration scope](https://github.com/anomalyco/opencode/blob/v2.0.32/packages/plugin/src/promise/adapter.ts).

Principles/personas: preserve customer configuration and authored files; reuse
canonical content and existing shared permission decisions; observe the actual
native boundary. SWM's full single-owner inventory and NTB's automatic selection
still depend on the remaining accepted slices. Tests prove these mechanics,
not the promised persona experience.
