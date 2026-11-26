# Closing-client review and checks

Independent Claude review 910c03b8-ab2e-49f8-8bfc-bf6f8693a57d approved the four
deadline-related targets, with no error findings. Its warnings are answered here.

- Host budgets: the actual supported Codex Stop hook is configured for 2,400
  seconds in packages/cli/codex-plugin/hooks.json, above this bounded 120-second
  read. This ticket's delivered host is Codex plus the public CLI. Claude,
  Cursor and OpenCode interaction proofs are explicitly skipped in spec.md;
  generated parity does not establish their timeout behavior. No new manual
  proof or comprehensive host-timeout guarantee is claimed for those surfaces.
- Test budgets: packages/cli/vitest.config.ts sets testTimeout to 60,000 ms for
  this project's process integration tests. Both real-process deadline tests
  pass under that configuration. They do not rely on Vitest's default timeout.
- Rollback preflight: 240 seconds is an intentional overall diagnostic bound,
  not a promise to fund seventeen worst-case row reads plus a worst-case close.
  Timeout refuses the comparison; it never grants credit. The real driver and
  rollback comparison at the final Soulless HEAD already passed. Slow hosts may
  require a separate larger diagnostic budget; no unconditional latency bound
  is claimed.
- Envelope command identity: the actual installed public CLI returns the exact
  command and status fields required by the read-only driver. All seventeen row
  reads and the combined closing read passed against the real final delivery.

The genuine regression was committed as 78d2d5160: one failed, eleven passed,
with the failure caused by the old ten-second closing budget. After the fix,
the focused hook, shared completion, PR-readiness, delivery and rollback family
passed 78 tests in five files. The slow-row control still refuses at its original
deadline. Logs: /tmp/issue163-closing-budget-vitest-red.log and
/tmp/issue163-closing-budget-protection-green.log.

Type checking passes. Configured lint covers the changed driver and tests.
The hook template is excluded by the repository lint configuration. An explicit
no-ignore comparison reports the same four existing complexity/array-style
errors before and after the deadline change; no new lint violation was added.
This comparison is not described as a clean no-ignore lint run.

Reference for the pinned runtime's process deadline and termination behavior:
[Node 24.18.1 child_process](https://nodejs.org/download/release/v24.18.1/docs/api/child_process.html#child_processspawnsynccommand-args-options).
The fixed 120-second budget does not change process selection, filtered
environment, response validation, signed-record validation or proof execution.
