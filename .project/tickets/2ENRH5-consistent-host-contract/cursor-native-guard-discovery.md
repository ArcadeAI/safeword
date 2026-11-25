# Cursor native guard discovery

Observed 2026-10-20 in the owned Cursor 3.24.18 profile. Setup now succeeds:
both real IDE write cases reach their intended missing-guard assertions. This
is observed behavioral RED, pending independent executable-RED review; it is
not a native protection claim.

## Current result

Report: `/tmp/safeword-2enrh5-targets.aOFAud/cursor-native-guard-ready.json`.
Two scenarios, six prerequisite/action steps passed, two Then assertions failed
with `NATIVE_GUARD_DISPATCH_MISSING`. The denied sentinel reached disk; the
allowed write lacked an origin-bound candidate permission decision. The
candidate still has no production guard implementation. No ledger boxes are
checked.

The third-party import switch also gates native plugin hooks in this exact
installed build: `loadPluginHooks()` returns before querying native plugins
when `isClaudeCodeHooksEnabled()` is false. Restored that switch to on in the
owned disposable profile. Fixture-local `.claude/settings.local.json` disables
the two imported Claude plugins by their configured identities, without changing
global settings. Native hook config additionally needs `version: 1`.

The fixture waits for actual native-control workspaceOpen execution after plugin
registration before starting the write. Both cases then observe that control's
preToolUse event for the exact attempted command. Project observers emit no
permission decisions. Native logs use the label `claude-plugin` even for native
Cursor plugins, so the proof checks actual command origin rather than that label.

## CLI testing decision

The user authorized Cursor CLI for the main automated testing on 2026-10-20.
Reuse shared behavior and policy, retaining separate IDE integration evidence.
CLI results cannot complete the existing exact-version IDE example rows. The
installed CLI is `2026.09.28-64d2043`; its public `--plugin-dir` option supports
loading local plugins. The documented `CURSOR_CONFIG_DIR` permits a disposable
CLI profile while existing authentication remains available. No credentials
need copying. See [CLI parameters](https://cursor.com/docs/cli/reference/parameters)
and [configuration](https://cursor.com/docs/cli/reference/configuration).

## Initial isolation attempt (historical)

Owned main process PID64464 uses
`/tmp/safeword-2enrh5-targets.aOFAud/cursor-native-3.24.18/profile` and its sibling
extensions directory. Regular Cursor PID42715 and global Claude configuration
were not changed.

Through the native Agents settings page, disabled the exact checkbox
`Include Third-Party Plugins, Skills, and Other Configs` in the owned profile.
Its value changed from 1 to 0. Fresh workspace hook logs confirm Claude hooks
are disabled, with no user or enterprise hooks and no active team hooks.
The native setting is documented in
[Cursor's third-party hooks reference](https://cursor.com/docs/reference/third-party-hooks).

## Repeatable fixture

New Cucumber profile binds the actual Cursor rows of the denied and allowed
write outlines. A separate legacy workspace first passes the existing allowed
project-hook control. The native workspace contains no legacy commands, rules,
skills, or policy hook dispatch. Its project hooks only observe native tool
events and supply workspaceOpen discovery; observers emit no decisions.

The core comes from the current production portable renderer and bundled runtime.
No production Cursor extension generator exists yet, so the candidate is an
explicit empty baseline container. It contains no policy implementation. A
separate native-format control plugin declares an observational sessionStart
hook. That control must actually execute before a missing guard can count as RED.

Bootstrap returns core, candidate and native-control paths. The host's Plugins
output reports all three registered and loaded, with no parse failures. This
registration alone does not establish active hooks.

## Observations

First profile run used inline hooks in `.cursor-plugin/plugin.json`. The native
control did not run. The denied row reached its actual Shell attempt and wrote
the synthetic ticket, but the When correctly failed setup because the native
hook control was absent. The second row also encountered late UI readiness.

Added a bounded read-only wait for the actual New Agent button before dispatch;
the action itself is still attempted once. A second run used the documented
`hooks: "./hooks/hooks.json"` manifest form and `hooks/hooks.json` with its
outer hooks object. Both allowed and denied rows reached real Shell attempts
and turn completion, but the sessionStart native control remained absent.

Second Cucumber report:
`/tmp/safeword-2enrh5-targets.aOFAud/cursor-native-guard-red-file.json`.
Both rows fail their When with
`CURSOR_SETUP_UNAVAILABLE: native plugin hook control did not load`.
Neither reaches the Then assertion; this is not the intended missing-guard RED.

Fixture directories:

- Denied: `.../cursor-native-3.24.18/bdd-runs/guard-e9qY5U/`.
- Allowed: `.../cursor-native-3.24.18/bdd-runs/guard-N1QRRA/`.

The clean allowed fixture's native Customize UI lists Core, Candidate, and
Native Control as installed extension plugins. Native Control's details show
no hook component or trust prompt. Customize → Hooks lists exactly four hooks,
all the project-owned observers/bootstrap, with their actual execution records.
No account plugin was removed, installed, or reconfigured during inspection.

The declared package forms follow the
[Cursor plugin reference](https://cursor.com/docs/reference/plugins) and
[hooks reference](https://cursor.com/docs/hooks). Documentation is current;
these observations are for the exact pinned binary and workspace registration
route, not a claim that every Cursor plugin installation route lacks hooks.

## Initial unavailable result (superseded)

The initial unavailable result below was resolved as described above. Do not
count a model refusal, returned path, installed-plugin listing, or project
observer as native enforcement. Production guard integration still requires
the independent review of the now-executable behavioral RED.
