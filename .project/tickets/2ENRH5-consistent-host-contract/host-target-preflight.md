# Host target provisioning evidence

Checked 2026-10-20 06:07:21 UTC. These are provisioning observations, not host
conformance receipts or evidence that native Safeword delivery works.

## Cursor IDE 3.8.23 on macOS arm64

The version-shaped endpoint
https://api2.cursor.sh/updates/download/golden/darwin-arm64/cursor/3.8.23
returned an artifact whose Info.plist version is 3.25.9. It was rejected as
exact-target input. Its SHA-256 is
94f27f404ddfc5301c75b21eba292624e5ef3c35904a5bd718abf1010b9adc84.

The archived vendor artifact at
https://downloads.cursor.com/production/7cf19b7482706625cdb70db3211b7dd035b7aa35/darwin/arm64/Cursor-darwin-arm64.dmg
was downloaded separately. Its SHA-256 is
f7be9968572cc38121432b187025b90bf7f30ec7e77a6cfe90868b0d8139d59d.
The bundle Info.plist reports 3.8.23. Disk-image verification and
codesign --verify --deep --strict passed. The Developer ID signature is
Hilary Stout, TeamIdentifier VDXQ22DGB9, matching the installed Cursor app's
signing identity; the archive has a stapled notarization ticket. The archive
URL was located through an independent version index, which is discovery only:
the actual vendor payload, signature and version are the provisioning evidence.

The isolated test copy is /tmp/safeword-2enrh5-targets.aOFAud/Cursor-3.8.23.app.
The disk image was unmounted after copying. The user's /Applications/Cursor.app
was not changed. No authentication, IDE launch, Agent turn, native catalogue,
guard or continuation has been proved. Presence of pluginPaths parsing in the
bundle is source-inspection support only.

## Other observed executables

- The repository's node_modules/.bin/codex reports 0.160.0, matching the target.
- Global codex reports 0.163.0, Claude reports 2.1.289, and installed Cursor
  reports 3.24.18. Those versions cannot satisfy the older exact-target claims.
- OpenCode was not on PATH. Claude 2.1.170 and both exact OpenCode versions
  still need isolated provisioning. No unavailable target is counted as passing.

## OpenCode V2 launcher root cause

The published @opencode/cli 2.0.32 launcher initially remained the package's
text placeholder because installation scripts were disabled. Its reviewed
postinstall copies the matching platform binary into that launcher path.
The darwin-arm64 optional package was already present, is version 2.0.32,
and its native executable reports opencode v2.0.32 when invoked directly.

Ruled out: missing platform dependency (the Mach-O arm64 executable exists),
unsupported --version syntax (the native executable reports the version), and
target-version substitution (both platform metadata and executed binary match).
An isolated npm prefix also preserved the placeholder and explicitly reported
that this package's postinstall had not been allowed. No repository dependency,
shell profile or global script-trust configuration needs changing. Restore only
the reviewed vendor postinstall in the isolated tool prefix, then rerun the
normal launcher version check. This remains provisioning, not host conformance.

The reviewed vendor postinstall completed in the isolated npm tool prefix.
Its normal node_modules/.bin/opencode launcher now reports opencode v2.0.32
with the isolated XDG configuration. No global script-trust setting changed.
Isolated Claude and OpenCode V1 launchers separately reported 2.1.170 and 1.18.23.
All exact binaries are now obtainable; authentication and actual host behavior
still need the approved proof harness.

## Native target update after the user's upgrade

On 2026-10-20 at 14:34 UTC the user reported upgrading Cursor and requested resume.
The running /Applications/Cursor.app and its CLI both report 3.24.18, build
be4c9e5350d77747b42cd467cbd3370a753d4640, arm64. Strict deep signature
verification passed. Vendor team: VDXQ22DGB9; CDHash:
7bc50cab8b73a55b272a2ccfade2c8416b404b14. The app has a stapled notarization
 ticket. The archived 3.8.23 process is no longer running.

The recorded native target is now 3.24.18. The 3.8.23 project-hook compatibility
regression remains separately required. Earlier observations and failed independent
native RED reviews cannot be reused as evidence for this new version. Review the
updated six-version/eight-runtime matrix before production implementation. These
checks establish provisioning only; new-version native behavior is not yet proved.

## Upgraded-target observations while GUI testing awaits unlock

Cursor 3.24.18's actual IDE emitted `workspaceOpen` for the isolated named
workspace and consumed the test hook returning absolute candidate/control plugin
paths. Its observed input version was 3.24.18. This proves that callback boundary,
not skill invocation, denial, continuation or full plugin admission. The allowed
native edit control did not complete before the Mac was observed locked. The
required Cucumber runner returned setup-unavailable; no scenario earned RED.

Codex 0.160.0 installed a complete freshly generated current production bundle
into a new isolated profile. A read-only native turn loaded an instrumented
existing workflow and its packaged guide and returned both unpredictable markers.
Hooks were not trusted or bypassed. The native plugin/read endpoint read that
bundle's original Safeword interface. Changing only the disposable compatibility
overlay's display name changed native readback to its unique decoy, demonstrating
actual overlay fallback. The current production generator supplied no root
plugin.json. These are setup/resource/selection observations for the forthcoming
primary Codex executable-RED harness, not an approved RED receipt, core-format
acceptance, enforcement proof or a checked scenario. The earlier independent
root-format capability control remains separate from this production projection.

Agent Plugins source retrieval identity (2026-10-20): repository HEAD resolved to
ff8ab5e392cc87bd88d87c060815a87490e51003. The checked 1.0.0 document is
https://github.com/agentplugins/agent-plugins-spec/blob/ff8ab5e392cc87bd88d87c060815a87490e51003/spec/1.0.0.md.
Section 9's required PLUGIN_ROOT environment applies to plugin subprocesses
(stdio MCP), so it does not establish an ambient skill-shell variable. Portable
helper resolution must still use the packaged skill origin; do not assume that
MCP-specific environment contract applies to arbitrary agent shell calls.
