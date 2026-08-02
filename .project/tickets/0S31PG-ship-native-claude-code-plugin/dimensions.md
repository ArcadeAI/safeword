# Dimensions: Ship native Claude Code plugin

These dimensions separate profile configuration, runtime execution proof, project
ownership, and release integrity. Scenarios cover behaviorally distinct
partitions rather than their full cross-product.

## Dimension table

| # | Dimension | Partitions and boundaries | Rules |
| - | --------- | ------------------------- | ----- |
| D1 | Profile marketplace state | official marketplace present and healthy; absent; same name with a different source; present but source-health degraded after cache population | TBU1.R1, TBU1.R2, NTB1.R2, SWM1.R4 |
| D2 | Installed plugin state | exact version enabled; absent; disabled; older/newer version; install/list error; repeated exact install | TBU1.R1, TBU1.R4, NTB1.R2 |
| D2a | Claude host support | parseable version at or above tested 2.1.170 baseline; older version; missing or unparseable host version | TBU1.R1, NTB1.R2 |
| D3 | Command mutation boundary | install changes only the active user profile; status changes nothing; cleanup/recover change only the current project | TBU1.R2, TBU1.R4, NTB1.R3 |
| D4 | Runtime activation boundary | new SessionStart proof; next UserPromptSubmit proof after `/reload-plugins`; reload refused/unsupported; installed or listed without any hook execution | TBU1.R5, NTB1.R1, NTB1.R2 |
| D5 | Proof validity | exact version + exact hook-manifest digest + canonical current installed cache path; missing; stale version; wrong digest; malformed record; proof from a different profile/cache path | NTB1.R1, NTB1.R2 |
| D6 | Legacy event authority | viable recognized legacy hook coexists; no legacy hook; malformed or custom hook at a managed location; legacy hook for a different event only | TBU1.R2, NTB1.R1, NTB1.R2 |
| D7 | Plugin dispatch during coexistence | proof-only for an event with viable legacy authority; functional execution where no viable legacy event exists; plugin authority immediately after successful cleanup | TBU1.R3, NTB1.R1 |
| D8 | Project setup generation mode | fresh setup; upgrade with viable legacy assets; setup after durable plugin-mode marker; Cursor-shared/project-owned asset | TBU1.R1, TBU1.R2, TBU1.R3, TBU1.R4 |
| D9 | Legacy file ownership | schema path + current fingerprint; schema path + historical fingerprint; schema path + unknown/custom content; non-schema path; symlink or path escaping project | TBU1.R2, NTB1.R2, NTB1.R4 |
| D10 | Settings ownership | exact structurally recognized Safeword hook entry; mixed Safeword and third-party entries; user-modified lookalike; unrelated settings; malformed settings | TBU1.R2, NTB1.R2, NTB1.R4 |
| D11 | Cleanup authorization and confirmation | exact current proof + recognized legacy + confirmation; proof valid but confirmation absent; proof invalid; no removable legacy; recovery already pending | NTB1.R1, NTB1.R2, NTB1.R3, NTB1.R4 |
| D12 | Cleanup transaction state | uninterrupted commit; failure before commit; interruption after durable backup; concurrent edit before replacement; recovery with unchanged target; recovery conflict; repeated cleanup/recover | TBU1.R4, NTB1.R4 |
| D13 | Project state location | hook code and transitive framework assets resolve only beneath `${CLAUDE_PLUGIN_ROOT}`; proof/profile data beneath `${CLAUDE_PLUGIN_DATA}`; tickets/config/runtime state beneath project root; registry/source tree unavailable at hook time | TBU1.R3, SWM1.R1, SWM1.R4 |
| D14 | Generated catalogue completeness | every canonical Claude asset and transitive dependency represented; missing asset; unexpected hand-authored asset; stale transformation; dangling reference; duplicate skill/command invocation name | SWM1.R1, SWM1.R2 |
| D15 | Release identity contracts | marketplace/package/plugin catalogue versions aligned; version mismatch; hook digest mismatch; hooks/skills/commands/agents/schema/docs/package inventory drift | SWM1.R1, SWM1.R2 |
| D16 | Cross-host parity | equivalent workflow/event mapped across Claude, Codex, and Cursor; explicit documented host exception; unmapped equivalent; duplicate workflow identity | SWM1.R2, SWM1.R3 |
| D17 | Packaged-host evidence | installed-cache hook runs with marketplace metadata retained and source plugin directory absent; metadata absent; cache malformed/missing; interactive trust/reload unavailable in automation | SWM1.R4 |
| D18 | Status result | unsupported-host; missing; disabled; wrong-version; errored; unproven; coexistence; cleanup-ready; recovery-required; plugin-mode, each with one safe next action and stable JSON envelope | TBU1.R1, NTB1.R2, NTB1.R4 |

## Load-bearing boundaries

- **D2 exact-enabled vs D4 executed:** install metadata establishes health, never
  cleanup authority. Only an exact D5 proof written by a running hook crosses the
  boundary.
- **D4 reload vs restart:** the next UserPromptSubmit after supported live reload
  proves current-task activation. A refused reload preserves legacy authority and
  recommends a new task; it is not silently treated as success.
- **D6 per-event coexistence:** authority is evaluated per lifecycle event. A
  viable legacy PreToolUse hook does not suppress a plugin SessionStart behavior
  for which no viable legacy counterpart exists.
- **D9/D10 known vs lookalike ownership:** a managed path or familiar command is
  insufficient alone. Files need an accepted fingerprint; settings entries need
  an exact structural identity. Unknown content is preserved and blocks unsafe
  contraction.
- **D11 cleanup-ready vs plugin-mode:** valid proof authorizes a proposed cleanup,
  but explicit confirmation commits it. No lifecycle command is smuggled into
  cleanup.
- **D12 backup vs commit:** every mutation has a durable recovery record before
  replacement. Concurrent edits turn into a reported conflict, never overwrite.
- **D17 cache execution vs marketplace health:** cached hook execution may remain
  valid while the source checkout is unavailable and list health is degraded.
  Removing marketplace metadata is a distinct negative case because Claude no
  longer discovers the installed plugin.

## Minimal cross-dimension combinations

1. Fresh setup (D8) + absent marketplace/plugin (D1/D2) proves setup recommends
   install without performing profile mutation (D3).
2. Exact enabled install (D2) + no proof (D5) + viable legacy event (D6) proves
   coexistence remains legacy-authoritative (D7).
3. Live reload prompt proof (D4/D5) + viable legacy event (D6) proves the plugin
   records identity but suppresses duplicate functional work (D7).
4. Exact proof (D5) + accepted file/settings ownership (D9/D10) + confirmation
   (D11) exercises successful atomic cleanup (D12).
5. Exact proof (D5) + any unknown, symlinked, malformed, or concurrently edited
   target (D9/D10/D12) exercises refusal and preservation.
6. Exact generated catalogue (D14) + aligned release identity (D15) + mapped
   parity (D16) is the positive release contract; each drift partition is tested
   independently so failures identify the broken surface.

## Out of partition

- Claude Code Cloud and Claude Desktop local-profile behavior are not claimed.
- Driving interactive trust UI or `/reload-plugins` is opt-in/manual; deterministic
  hook proof parsing and isolated-profile/cache behavior remain automated.
- Project-scoped Claude plugin installation is supported by Claude but is not the
  Safeword default lifecycle in this feature.
- Cursor's eventual native-plugin migration is tracked separately; parity here
  verifies the currently supported equivalent workflow contract.
