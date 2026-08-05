# Quality Review: Let dependency installs unblock Safeword commands

## Review plan

- Verify the PreToolUse lifecycle can make the decision before an install-and-retry command starts.
- Confirm the shell-list boundary: only `&&` makes the retry conditional on recovery success.
- Inspect the recovery classifier, parser usage, and denial path for overly broad exceptions.
- Check the canonical template, dogfood installation, Claude-plugin runtime mirror, and real hook-process tests.

## Round 1 — 2026-08-05

- **Currency:** ✅ Current [Claude Code hook documentation](https://code.claude.com/docs/en/hooks) confirms that PreToolUse runs before a tool call and can block it using tool input.
- **Shell semantics:** ✅ The [GNU Bash manual](https://www.gnu.org/software/bash/manual/html_node/Lists.html) confirms the required conditional sequencing of `&&`; `||`, `;`, and pipelines do not provide this safety property.
- **Correctness:** ✅ A recovery exception requires more than one parsed segment, a leading recognized dependency install or exact `touch node_modules`, and only `&&` connectors before the retry.
- **Security boundary:** ✅ Unsupported or unsafe shell forms remain denied by the existing readiness gate.
- **Wiring:** ✅ The hook calls the classifier before rendering its denial, and process-level tests exercise the canonical hook entry point.
- **Distribution:** ✅ Canonical template, dogfood, and Claude-plugin runtime copies are synchronized.
- **Scope:** ✅ No unrelated product behavior or dependencies were introduced.

**Verdict:** APPROVE — no critical or suggested changes.

## Round 2 — 2026-08-05, adversarial re-review

Round 1's approve did not hold. It reasoned about the operators the tokenizer
*reports* and never enumerated the shell forms it leaves *inside* a segment, so
two ways to run a guarded command with unready dependencies survived. Both were
reproduced against the real hook process before being fixed.

- **CRITICAL — `touch node_modules` was exempt while dependencies were missing.**
  The exemption sat after the `ready`/`unsupported` early exit, so it covered
  `missing` as well as `stale`. With no `node_modules`, `touch node_modules`
  creates an empty regular *file* of that name and exits 0, so the retry ran
  with nothing installed — and readiness then stayed `missing` permanently
  (the path is no longer a directory) while the stray file blocked the real
  install. `formatDependencyRecovery` only ever offers this recovery for
  `stale`. Fixed: the touch branch now requires `status === 'stale'`; the
  install branch still covers both.
- **CRITICAL — a background `&` voided the `&&` guarantee from inside a
  segment.** `parseShellCommandList` splits on `;`, newline, `&&`, `||`, and
  pipes, but not on a single `&`, so `bun ci && start & run` parsed as two
  segments joined by `&&` and was exempted — while bash runs
  `(bun ci && start) &` and then `run` immediately, unconditionally, and
  concurrently. Fixed: `hasBackgroundOperator` in the shared tokenizer, and the
  classifier rejects any segment carrying one. File-descriptor redirections
  (`2>&1`, `<&3`, `&>log`) and quoted or escaped `&` do not count.
- **Test quality:** ✅ after changes. The `it.each` denial cases were confirmed
  non-vacuous (each is dependency-backed and reaches a genuine `stale` deny).
  `expect(result.status).toBe(0)` carries no signal on its own — every path of
  this hook exits 0, including deny — so the allow assertions rest on the empty
  stdout. Added direct unit pins for the classifier's shell-shape edges rather
  than spawning a hook process per case.
- **Accepted, not fixed:** only the leading segment is classified, so
  `bun ci && rm -rf node_modules && bun run test` still passes. The gate stops
  an accidental run against a stale worktree, not deliberate self-sabotage.
  Documented in the classifier docstring.
- **Out of scope, filed separately:** `isInstallSegment` counts installs that
  never materialize `node_modules` (`--production`, `--omit=dev`,
  `yarn --mode=update-lockfile`). Pre-existing, and it also affects post-tool
  stamping — this PR only makes it newly load-bearing. The shared tokenizer's
  blindness to `&` likewise affects the kill and ledger gates; this PR fixes
  only the dependency gate's reliance on it.

**Verdict:** APPROVE with changes applied — two critical defects found and fixed
in this branch, with regression pins for each.

## Method

Round 2 used an independent reviewer with no stake in the original design,
briefed to refute the stated invariant rather than confirm it, plus direct
empirical probes: each candidate command string was run through the real
predicate and separately through `bash -c` to compare the classifier's verdict
against actual shell behavior.
