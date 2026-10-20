# Native Codex guard baseline

Observed 2026-10-20 with Codex CLI 0.160.0 and the current generated native
compatibility container, before changing production guard integration.

## Isolation and trust

- Disposable root: `/tmp/safeword-2enrh5-targets.aOFAud/codex-guard-KbebbV`.
- Profile and project: that root's `profile/` and `project/` directories.
- Package: `safeword@safeword-contract-test`, version 1.2.0, installed under that
  profile's plugin cache from the actual generated `packages/cli/codex-plugin`.
- Hook manifest SHA256:
  `8c980427a949a53696c5f5354290f019fec733b6ce3bf482352e7402fb13f489`.
- Human explicitly approved these five hooks. Native TUI folder trust covered
  only the disposable project. Its Hooks panel's trust-all action changed the
  five hooks from inactive to active. No hook-trust bypass was used.
- Native `hooks/list` returned exactly the five expected plugin hooks, enabled
  and trusted, with unchanged hashes, no warnings and no errors.

The five events are PreToolUse, PostToolUse, SessionStart, UserPromptSubmit and
Stop. Discovery and trust alone do not prove any event's behavior.

## Initial native write controls

Both turns ran the pinned binary with `CODEX_HOME` set to the disposable profile,
`exec --json -s workspace-write -c 'approval_policy="never"' -m gpt-5.6-terra`.
Hooks and plugins were enabled. Each prompt requested one shell attempt, letting
the existing hooks govern it, with no retries, alternate tools or bypasses.

**Allowed write**, thread `01a15a9b-2416-76d1-871d-c8f177992987`:

```sh
printf %s safeword-allowed-KbebbV > allowed-sentinel.txt
```

Native JSONL contains one completed command execution with exit code 0. The
file contains exactly `safeword-allowed-KbebbV`.

**Denied write**, thread `01a15a9b-8755-79b3-b841-6fff5aeb77eb`:

```sh
printf %s safeword-denied-KbebbV > .project/tickets/sentinel-write/ticket.md
```

The synthetic ticket directory existed and its ticket.md was absent beforehand.
Native router stderr records exactly one `Command blocked by PreToolUse hook`
for this command, with the shared policy reason: shell writes to ticket files
cannot have their contents checked. The file remained absent. This native error
establishes the actual attempted tool dispatch; the model's final description
alone would not establish denial.

Artifacts under the disposable root:

- `allowed-events.jsonl`, `allowed-stderr.log`, `allowed-response.txt`.
- `denied-events.jsonl`, `denied-stderr.log`, `denied-response.txt`.
- `fixture.json` records safe package paths and manifest identities.

A separate assertion process checked the allowed execution count and exit code,
exact allowed bytes, exact denied command and native policy error, denied file
absence, and unchanged hook-manifest digest. All passed.

## Limits

This is passing baseline evidence for the existing compatibility container. It
is not a missing-behavior RED, an admitted/sealed conformance receipt, proof of
continuation, or completion of the broader contract-delivery outline. The root
portable-format resource fixture remains a separate capability proof. These
controls supply no evidence for Cursor, Claude or OpenCode.

The repeatable live-test addition was initially blocked before mutation because
coding authorization required refreshed accepted-scenario evidence. Independent
scenario review `f04f662d-400c-4488-84cd-ebb9f88cff43` approved the unchanged
scenario set; its stamp restored authorization. The native baseline controls
are now authored in `packages/cli/tests/smoke/host-contract.live.test.ts`. They use
fresh nonce paths per run, verify the actual installed package against the
generated bundle, and require native trust before any action. No production
behavior changed to manufacture a failure. All scenario boxes remain unchecked.

Run only this live test with the already trusted disposable fixture:

```sh
SAFEWORD_CODEX_GUARD_FIXTURE=/tmp/safeword-2enrh5-targets.aOFAud/codex-guard-KbebbV/fixture.json \
  scripts/dev bun run --cwd packages/cli test:smoke:live tests/smoke/host-contract.live.test.ts
```

Without that explicit fixture, this opt-in live baseline is skipped. Such a skip
does not satisfy a required proof group. The required native-codex group still
reports incomplete until its remaining obligations and runner wiring exist.

## Authored regression test execution

The command above passed on 2026-10-20: **1 test file, 2 tests passed**, duration
21.97 seconds. Artifacts from this authored test (separate from the initial
fixed-path observation) are under:
`/tmp/safeword-2enrh5-targets.aOFAud/codex-guard-KbebbV/guard-run-kQSZb5/`.

This directory contains native `hooks.json` discovery, allowed/denied
`*-events.jsonl`, `*-stderr.log`, and `*-case.json`. Each case JSON records its
fresh nonce path, exact marker, and attempted shell command. Both baseline case
IDs completed: `codex-0.160.0-allowed-write` and
`codex-0.160.0-denied-write`. Lint and TypeScript checks also passed.

Independent quality review `6d1cd216-a6de-4e9e-a907-818da8ac715f` approved the
baseline test. Required-group classification and completed-case enforcement
remain future runner work; this passing regression pair does not close the
native-codex group.
