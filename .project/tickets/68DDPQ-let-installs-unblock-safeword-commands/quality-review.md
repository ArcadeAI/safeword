# Quality Review: Let dependency installs unblock Safeword commands

## Review plan

- Verify the PreToolUse lifecycle can make the decision before an install-and-retry command starts.
- Confirm the shell-list boundary: only `&&` makes the retry conditional on recovery success.
- Inspect the recovery classifier, parser usage, and denial path for overly broad exceptions.
- Check the canonical template, dogfood installation, Claude-plugin runtime mirror, and real hook-process tests.

## Result

- **Currency:** ✅ Current [Claude Code hook documentation](https://code.claude.com/docs/en/hooks) confirms that PreToolUse runs before a tool call and can block it using tool input.
- **Shell semantics:** ✅ The [GNU Bash manual](https://www.gnu.org/software/bash/manual/html_node/Lists.html) confirms the required conditional sequencing of `&&`; `||`, `;`, and pipelines do not provide this safety property.
- **Correctness:** ✅ A recovery exception requires more than one parsed segment, a leading recognized dependency install or exact `touch node_modules`, and only `&&` connectors before the retry.
- **Security boundary:** ✅ Unsupported or unsafe shell forms remain denied by the existing readiness gate.
- **Wiring:** ✅ The hook calls the classifier before rendering its denial, and process-level tests exercise the canonical hook entry point.
- **Distribution:** ✅ Canonical template, dogfood, and Claude-plugin runtime copies are synchronized.
- **Scope:** ✅ No unrelated product behavior or dependencies were introduced.

**Verdict:** APPROVE — no critical or suggested changes.

## Coordinator evidence

`safeword review run quality-review` completed without diagnostics. The host did not receive the coordinator's final result envelope, so this record states the independently repeatable, source-backed review rather than attributing an unobserved typed verdict to the coordinator.
