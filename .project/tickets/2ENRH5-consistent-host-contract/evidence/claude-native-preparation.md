# Exact Claude fixture preparation; authentication still unavailable

User confirmed Mac unlock and password-manager approval on2026-10-22. Retried
the same narrow op run authentication probe. Credential resolution completed,
but the actual Claude2.1.170 model response says Invalid API key. No credential
was printed, copied, replaced or persisted by the agent. A normal auth login
--claudeai process is now waiting on Google passkey verification in Chrome.
The user was asked asynchronously to complete that verification. OAuth process
session87384 remains pending; do not start a second login while it is pending.

Prepared actual native Write controls in claude-native-contract.ts and
probe-claude-writes.ts. Each uses a fresh owned synthetic project, exact binary,
native plugin registration, byte-identical generated payload, transparent
existing Bun observer, and the same artifact with missing/complete scope fields.
Denied requires native guard rejection and no file; allowed requires the actual
marker file. No supplied decision, mocked model tool, guard bypass or successful
conformance receipt. These two controls do not yet provide the four-case required
native-claude group; catalogue/helper and bounded continuation remain to wire.

Preparation checks passed: CLI types, targeted lint, exact version and enabled
plugin discovery, both cache and registered source payload byte equality.
Native invocation reached the actual SessionStart hook and system init, which
identified the owned candidate, then returned Not logged in with is_error:true.
Runner correctly exits3, unavailable. No product RED or native guard GREEN.
Current fixture:/tmp/safeword-2enrh5-targets.aOFAud/claude-2.1.170-native/fixture.json.
Last owned trace:native-contract-0s4Zyb/{denied-events.jsonl,hooks.jsonl}.
Logs:/tmp/safeword-claude-native-{writes-third,types,lint}.log.

Root cause investigation: directory marketplace versus installed-cache loading.
Competing hypotheses were an inherited plugin-root override, wrong cache bytes,
or directory-marketplace semantics. No CLAUDE_/ANTHROPIC_ variables are inherited;
cache bytes exactly match the current generated plugin. Native init reports the
directory marketplace's relative source as the loaded plugin, matching official
documentation fetched this pass:
https://code.claude.com/docs/en/plugin-marketplaces#test-an-edit-to-a-plugin.
The exact CLI rejects a file:// marketplace URL, so no unsupported scheme was
forced. Instead, copied the unchanged marketplace manifest and generated plugin
below the owned fixture root and registered that directory normally. Native init
now confirms that owned source; the observer uses that actual runtime path.

One native marketplace removal run from the repository also removed the repo's
project-level plugin declarations. Its exact tracked diff was inspected and
restored immediately; no project settings change is retained. All future
registration operations must use the disposable fixture as cwd as well as its
CLAUDE_CONFIG_DIR. This is fixture setup, not a production lifecycle change.
CLI's variadic --tools flag initially consumed the trailing prompt; placing the
prompt before options and explicitly ending stdin resolved that setup failure.

Next: finish the pending browser sign-in, confirm a successful real model turn,
run both write controls, then complete all four native-claude cases against this
actual registered payload. Do not retire a Claude policy path before its real
allow/deny controls pass. No scenario or admission claim advanced.
