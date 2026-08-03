# Manual Claude Plugin Upgrade Acceptance

This release-time gate verifies a Claude behavior that Safeword needs but the
Claude documentation does not promise: adding the official Safeword marketplace
under the same marketplace name replaces its older pinned tag without
uninstalling the plugin or losing persistent plugin data.

Run this after publishing a release candidate and before publishing its stable
release. A local plugin directory is insufficient because this gate must cross
the real public Git tag, marketplace checkout, installed cache, and same-task
reload boundaries.

## Prepare an isolated previous-stable installation

1. Record the Claude Code version, previous stable release, candidate version,
   and candidate Git tag. Confirm the candidate package and tag are public.
2. Create a temporary `CLAUDE_CONFIG_DIR` and project. Do not use a real user
   profile.
3. Add the official marketplace pinned to the previous stable release and
   install `safeword@safeword` at user scope.
4. Record `claude plugin marketplace list --json` and
   `claude plugin list --json`. Confirm both report the previous stable version.
5. Put a unique sentinel in the plugin's persistent `CLAUDE_PLUGIN_DATA`
   directory and snapshot unrelated profile values.

## Upgrade through the candidate CLI

1. In an authenticated Claude task using the isolated profile, run the
   candidate CLI's `safeword claude install` command.
2. Confirm command observation and mutation occurred in this order:
   previous stable marketplace -> re-add the exact candidate tag under the same
   marketplace name -> re-observe that exact source and ref -> update the
   installed plugin -> verify its complete generated identity and inventory.
3. Confirm marketplace JSON reports the exact candidate tag and plugin JSON
   reports the exact enabled candidate version at user scope.
4. Confirm the persistent sentinel and unrelated profile values are unchanged.

## Prove the candidate in the current task

1. Run `/reload-plugins` in the same authenticated task.
2. Submit the next prompt and invoke a gated Safeword skill.
3. Confirm hook proof contains the candidate version, hook-manifest digest, and
   canonical candidate cache root.
4. Confirm the skill invocation line names a helper underneath that same
   canonical candidate cache root. An older retained cache path fails the gate.
5. Run Safeword status and doctor checks, then repeat install once to confirm it
   is a no-op.

## Required release evidence

Attach the redacted command transcript and JSON observations to the release
task. Record the candidate tag, installed version, marketplace ref, canonical
hook path, canonical skill-helper path, persistent sentinel result, unrelated
profile comparison, and idempotent rerun result.

Stable publication is blocked until every check above passes. If Claude changes
same-name replacement semantics, stop and change the installer rather than
removing or weakening this gate.

## Dual-scope host matrix

Before status or cleanup changes ship, use isolated `CLAUDE_CONFIG_DIR` values
and temporary repositories to prove all four directions with the candidate
payload:

1. Upgrade an older user installation while preserving an exact project
   installation.
2. Upgrade an older project installation while preserving an exact user
   installation.
3. Uninstall project scope and invoke a generated hook through the remaining
   user installation.
4. Reinstall project scope, uninstall user scope, and invoke a generated hook
   through the remaining project installation.

For each direction, compare both scoped settings files and `plugin list --json`,
require the remaining entry to retain its scope and project identity, and verify
the exact candidate identity/inventory at its reported cache root. Use a local
candidate marketplace only for the pre-status implementation gate. The final
release gate still requires a public release-candidate tag because a local
directory cannot prove tagged Git checkout and same-name marketplace replacement.
