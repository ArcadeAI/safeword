# Cursor CLI testing

The user selected CLI-first automated testing on 2026-10-20. Keep the small
real IDE integration lane for its version-specific plugin discovery, trust,
registration, and continuation obligations. CLI results cannot check off an IDE
example row or replace its reviewed execution-plan proof.

## Repeatable command

From the repository root:

```sh
SAFEWORD_CURSOR_CLI=/absolute/path/to/cursor-agent \
  scripts/dev bun packages/cli/scripts/run-cursor-cli-controls.ts
```

Optionally set `SAFEWORD_CURSOR_CLI_MODEL` to an installed model identifier.
This selects the test process's model without changing the user's configuration.
The observed test binary is `2026.09.28-64d2043`, independently versioned from
Cursor IDE 3.24.18. The successful local run selected `composer-2.5`.

Each mode gets a fresh workspace, plugin and `CURSOR_CONFIG_DIR`. Existing
authentication remains available without copying credentials. Only `printf`
has an automatic shell permission. No force flag is used. The native plugin
hook must return exactly one decision for the exact sentinel command at the
observed CLI version. Allowed writes also require a matching native
afterShellExecution observation. A successful process exit is required. Timeouts, absent
hooks, wrong commands, extra decisions and wrong filesystem outcomes fail.

Four supporting checks run sequentially:

- `control-allow`: the test-only plugin permits a synthetic ticket write.
- `control-deny`: the same test-only plugin denies a synthetic ticket write.
- `shared-allow`: the native hook relays the existing Cursor adapter's ordinary
  fast-allow decision; this does not exercise the shared fail-closed gate.
- `shared-deny`: the native hook relays the existing Cursor adapter, which calls
  the existing shared policy and denies a shell write to `ticket.md`.

The control allow/deny pair targets the same relative ticket path used by
shared-deny. A separate path-specific restriction must not account for success.
The test relay adds observations and forwards the adapter's actual output;
it does not recreate Safeword policy. Raw subprocess output stays in the
disposable evidence directory. The final `result.json` contains only mode,
runtime, observed version and evidence paths.

## Observed evidence and limits

Initial control pair passed:
`/var/folders/v4/1hqkg6ln4nd71j_bjw3_xxb00000gn/T/safeword-cursor-cli-controls-nyIdkX/`.
Initial four-mode run passed:
`/var/folders/v4/1hqkg6ln4nd71j_bjw3_xxb00000gn/T/safeword-cursor-cli-controls-rzV8ZO/`.
The latter predates strengthening the control pair to use the ticket path.
The strengthened four-mode run also passed:
`/var/folders/v4/1hqkg6ln4nd71j_bjw3_xxb00000gn/T/safeword-cursor-cli-controls-kBr3eH/`.

Independent quality review `754d2c10-0cce-4b25-9d1d-3b849c3f918e` approved the
supporting harness. Its warnings motivated the same-path control and explicit
fast-allow limitation. System or enterprise hooks are not enumerated by this
pilot; the paired controls constrain that ambiguity, without claiming complete
host-hook isolation. Follow-up review
`fbbcac73-b04d-4ab0-b6e3-546ffed6d355` also approved. Its allow-provenance
warning motivated requiring an actual matching afterShellExecution event.

Final four-mode run with the native afterShellExecution assertions passed:
`/var/folders/v4/1hqkg6ln4nd71j_bjw3_xxb00000gn/T/safeword-cursor-cli-controls-USOajL/`.
CLI package typecheck, targeted ESLint and formatting checks passed.
Final harness review `75be618e-a235-433a-9101-64ef7912165f` approved.
Remaining limits include model-dependent attempt selection, unenumerated host
hook sources, and denial inferred from the recorded decision plus file absence
rather than a separate assertion that no afterShellExecution event occurred.

This is test infrastructure and a shared-policy transport baseline. It does
not prove a generated production Cursor package, portable skill catalogue,
sole authority, continuation, full contract conformance, or IDE behavior. No
production code or accepted scenario rows changed. No ledger boxes are checked.

## Primary sources

- [CLI parameters](https://cursor.com/docs/cli/reference/parameters): local
  `--plugin-dir`, headless output and workspace selection.
- [CLI configuration](https://cursor.com/docs/cli/reference/configuration):
  `CURSOR_CONFIG_DIR` and project permissions.
- [CLI changelog](https://cursor.com/docs/cli/changelog): August 11, 2026 plugin
  hook execution support, including plugins loaded with `--plugin-dir`.
- [Permissions](https://cursor.com/docs/cli/reference/permissions):
  `Shell(commandBase)` allow rules.
