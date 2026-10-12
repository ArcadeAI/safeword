# GEPA development-tool verification

**PR Scope:** ✅ One experiment development-requirements file and this patch's delivery records; no unrelated changes.

Source commit: 598fe095ecfc568bfd3c11a2172364872d382df0.

The `uv` commands below run from `experiments/gepa-review-spec`; the installer command runs from the repository root. The requirements header's `uv venv` command should only run when `gepa/.venv` is absent; reuse an existing environment for dependency installation.

- `uv pip install --python gepa/.venv/bin/python -r gepa/requirements.txt -r gepa/requirements-dev.txt`: installed 37 packages into the main checkout's isolated experiment Python 3.12 environment.
- `uv pip check --python gepa/.venv/bin/python`: all installed packages compatible.
- Python import and distribution metadata: GEPA 0.1.4, ruff 0.16.10, mypy 2.4.0, deadcode 2.4.1, pip-audit 2.10.1.
- `bun packages/cli/src/cli.ts install --no-input` from the main checkout: exit 0, Healthy, Changed: no, Project/Claude/Codex ready. Main's development requirements bytes match the committed file.
- CI https://github.com/ArcadeAI/safeword/actions/runs/37642918560: terminal success, including Node 22.23.2 and 24.18.1 full package tests, acceptance scenarios, release gates, lint, physical install proof, dependency audit, contract, parity, and OpenCode conformance.
- Independent Claude Opus review f2ef6ba7-b2dc-420e-ad56-622167d372ac approved the requirements file. Accepted warning: development tools remain unpinned, consistent with existing Safeword Python tool enrollment; runtime GEPA remains pinned. Its packet did not prove wiring; author verified requirements discovery and `getPythonTools` in setup.ts and the end-user install.

Baseline: the original install before this file exited 2 with Project: needs attention and missing ruff, mypy, deadcode, pip-audit. The earlier transcript and `/tmp/safeword-merged-main-install.log` record that result. A disposable declaration probe using the production `getMissingPythonToolDependencies` function also returns all four missing tools with the original requirements.txt, then an empty missing-tool list after adding the exact requirements-dev.txt bytes.

Configuration-only patch: no application behavior was rewritten, so existing tool-discovery coverage and real install verification supply the regression proof. No paid optimizer evaluation was run. Final-head CI, configured hosted review, and readiness evidence remain required before merge; the pending documentation commit does not inherit exact-head status from the source commit. Baseline logs and the disposable probe are local evidence; the recorded before/after results and linked CI are durable, but no automated fixture was added for this declaration-only patch.
