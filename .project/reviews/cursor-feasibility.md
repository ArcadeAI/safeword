# Cursor reviewer feasibility — live proof, partial conformance

Date: 2026-09-03. Installed version: `2026.08.25-3e8eec8`.
Production base: `aa16493b1`; no production implementation changed.

## Findings

The documented `CURSOR_CONFIG_DIR` override is not a complete isolation boundary.
Installed `index.js` uses it for CLI configuration, while the hook loader in
`190.index.js` builds paths from the actual home directory for Cursor hooks and
Claude settings, plus system-wide Cursor hook paths. Both user hook/config files
exist locally. Documentation: https://cursor.com/docs/cli/reference/configuration
and https://cursor.com/docs/cli/reference/permissions.

A disposable macOS sandbox demonstrated:

- Cursor and Claude user-hook/config content reads fail with `EPERM`.
- A synthetic write outside the experiment root fails with `EPERM`.
- Cursor starts successfully with disposable config/data/cache/workspace roots.
- Isolated Cursor status reports unauthenticated, with no access/refresh token.
- Normal Cursor CLI status reports authenticated, with access/refresh tokens.

Thus the local CLI is logged in, but the initial isolation also separates it from
that login. The initial probe did not extract credentials. No profile settings
were edited, and no project contents were supplied to Cursor.

## Evidence and limits

Executable diagnostic and JSON results are under
`/tmp/safeword-cursor-feasibility.LqhQMq/`; run command:
`node /tmp/safeword-cursor-feasibility.LqhQMq/probe.mjs`.
The initial setup failed because Node needed metadata access to resolve the
installed executable. One correction allowed home metadata, not content, while
retaining the content-read denial; the repeated controls then passed.

The initial probe establishes bootstrap and narrow OS-policy behavior only, not
complete reviewer confinement. The follow-up below adds live inference and tool
denial evidence, but full ambient plugin/system-hook conformance remains untested.
The policy is macOS-specific and is not proposed as a portable implementation.
Temporary experiment code is not production code and must not be copied into it.

## Decision

Do not implement Cursor as a flags-only adapter or claim it conforms yet.
The adapter contract needs an explicit authentication handoff distinct from
ambient configuration access. The macOS proof below validates one narrow handoff;
portable authentication and complete isolation remain implementation gates.

## Follow-up: authenticated live proof

User-authorized bounded experiment: ten minutes, two inference requests, with one
workspace-trust setup correction. Script: `/tmp/safeword-cursor-feasibility.LqhQMq/auth-probe.mjs`.
No production code changed.

- A parent process queried only the existing `cursor-access-token` Keychain item
  for `cursor-user`. The access token was captured in memory and passed through
  `CURSOR_AUTH_TOKEN`; no refresh token was retrieved. The diagnostic did not put
  credentials in arguments, print them, or deliberately save them to disk.
- The isolated CLI used `AGENT_CLI_CREDENTIAL_STORE=memory`, disposable data/config
  roots, and `DIRENV_DISABLE=1`; the OS content-read/write boundaries stayed intact.
- `status` still reported unauthenticated: this command does not apply the supplied
  environment authentication. The authenticated model command and live inference
  are stronger readiness evidence than this status result.
- `models` succeeded and advertised `composer-2.5`. Both inference requests used
  that exact ID; the vendor initialization envelope reported `Composer 2.5`.
  This is a vendor display label, not independently attested backend identity.
- Initial headless execution stopped at workspace trust before inference. Adding
  `--trust` for the disposable workspace resolved it. Neither `--force` nor
  `--yolo` was used; permission denial settings were preserved.
- Synthetic review exited zero and returned parseable JSON, preserving dispatch
  `cursor-probe-1` and reviewer `cursor`, with the correct subtraction-versus-sum
  finding. This proves a structured round trip, not the full Safeword result schema
  or review quality: the prompt deliberately supplied the expected verdict.
  Session: `24ce4f92-72c5-49bf-9b9b-a66f0c80327e`.
- The adverse request made actual edit and shell tool calls. Completed vendor
  events reported `readPermissionDenied` for edit and `permissionDenied` /
  `Command blocked by permissions configuration` for shell. Both marker existence
  checks were false. This is enforcement evidence, not merely a model refusal.
  It does not separately prove the Write rule, since edit failed at its read gate.
  Session: `9af5665d-c38e-4544-b350-30f7948a5e0f`.

### Consequences for the adapter contract

Readiness should distinguish executable discovery, credential availability,
catalogue availability, and a working request; a vendor status boolean is not a
universal readiness contract. Keep credential acquisition separate from ambient
configuration and supply it only to the selected runtime. Preserve requested model
ID separately from the vendor-reported label. Consume terminal result events;
do not concatenate progress/thinking into review JSON.

Proceed with these requirements in the implementation specification. Do not yet
ship Cursor as conformant: portable confinement, inherited/system/managed hooks
and plugins, network/read/MCP boundaries, credential-persistence checks, complete
result validation, and timeout/cleanup conformance still need coverage. The proof
is macOS-specific, and its temporary script is not production implementation.
