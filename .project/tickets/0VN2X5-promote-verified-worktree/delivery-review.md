# Delivery review for issue #5511

User authorized verification, audit, refactoring, quality review, CI delivery,
Ready promotion after the gates pass, and administrative merge on 2026-10-16.
Cleanup of branches or worktrees is not included in this delivery request.

## Work sequence

1. Run the authoritative verification block and diff-scoped audit; resolve
   actionable failures and preserve diagnostic limits.
2. Apply the refactor ledger one entry at a time, with tests between changes.
3. Gather current primary-source evidence, dispatch independent quality review,
   apply findings, and re-review changed targets when needed.
4. Commit, push a Draft PR for CI, resolve review/check failures, refresh the
   seven exact-head readiness gates, promote Ready, and administratively merge.

## Refactor ledger

Read-only scout covered the new command, public handler, shared readiness
helper, hook diagnostics, command and delivery integration tests, readiness
guidance, and test-quality evidence. Generated bundles are derived output.

| Order | Smell and smallest change | Status and proof |
| --- | --- | --- |
| 1 | Failed-operation parameter implies confirmed mutation: rename `mutatedPull` to `attemptedPull`. | Pending; preserve failure result and attempted network effect. |
| 2 | Duplicated network-effect construction: use one local builder while retaining selector targets and effect order. | Pending after entry 1; preserve inspection-only, failed promotion, already-Ready, and successful promotion results. |
| 3 | Two tests accumulate two independent CLI invocations: split already-Ready and explicit-number success/refusal cases into fresh fixtures. | Pending; preserve every assertion and add zero-Ready-call checks to standalone refusals. |

No runner class, generic dependency-injection layer, shared fake-GitHub framework,
or broad environment refactor is warranted. Splitting the linear safety checks
only to shorten a function would hide their order and the remote-head race
comment. These suggestions are deliberately rejected, not omitted discoveries.

## Quality-review plan

- **Correctness and trust boundaries:** can launch state, environment, PR
  metadata, or changing local evidence authorize the wrong worktree or commit?
- **Public wiring and proof:** do actual CLI/plugin entry points execute with
  real Git worktrees, while faking only the GitHub boundary, and do the new
  tests detect the guards they claim to protect?
- **Primary-source currency:** recheck the pinned Codex payload limitation,
  Node cwd/env/argv behavior, and GitHub view/Ready contracts against current
  official sources; distinguish pinned-host behavior from all future hosts.
- **Clarity and scope:** review the refactor, workflow guidance, generated
  parity, evidence qualifications, and issue linkage without expanding the
  accepted readiness contract.
- **Supply chain:** enforce the repository's existing hosted JavaScript audit
  policy and fix the actionable Python development-lock finding; retain raw
  scanner diagnostics without describing accepted warnings as a clean scan.

## Current-source evidence

Fetched this delivery session:

- GitHub CLI Ready: https://cli.github.com/manual/gh_pr_ready
- GitHub CLI PR inspection: https://cli.github.com/manual/gh_pr_view
- Unpatched braces advisory: https://github.com/advisories/GHSA-vfj7-8cjw-p6xm
- Unpatched cache-semantics advisory: https://github.com/advisories/GHSA-ch52-4w7c-c8xp
- urllib3 2.8.0 release and security fixes: https://github.com/urllib3/urllib3/releases/tag/2.8.0
- urllib3 registry metadata: https://pypi.org/pypi/urllib3/json

The hosted JavaScript policy in `.github/workflows/ci.yml` already excludes the
two named unpatched high advisories and blocks other high/critical findings.
Its exact command passes; unfiltered `bun audit` still reports eight advisories.
The current Python audit identified three urllib3 2.7.0 advisories. Updated only
the transitive development lock entry to 2.8.0, synchronized with `uv sync
--frozen --dev`, and reran `pip-audit`: no known vulnerabilities found. No
dependency-audit policy changed and no new suppression was added.

Pinned-host source was also rechecked at Codex `rust-v0.160.0`: the unified-exec
PreToolUse payload contains only `command`; hook cwd uses local-environment cwd
or turn cwd. Node 24.18.1 documents explicit child-process cwd and environment.

- https://github.com/openai/codex/blob/rust-v0.160.0/codex-rs/core/src/tools/handlers/unified_exec/exec_command.rs
- https://github.com/openai/codex/blob/rust-v0.160.0/codex-rs/core/src/hook_runtime.rs
- https://nodejs.org/download/release/v24.18.1/docs/api/child_process.html

## Verification limits

The delivery verification run passed relay (198 tests, one skip) and collector
(153 tests). Its first full CLI invocation was interrupted after more than
three hours, with 30 observed failed cases in 12 files and no final failure
traces; a duplicate CLI invocation was also interrupted. Neither is a passing
full-suite result. Only three setup-timeout breadcrumbs establish a specific
failure mechanism; other failures remain unclassified pending reruns or CI.
Acceptance and remaining verification lanes continue with a stable build.
Exact-head hosted CI must provide complete results before Ready or merge.
