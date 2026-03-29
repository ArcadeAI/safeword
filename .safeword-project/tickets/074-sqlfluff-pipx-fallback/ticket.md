---
id: 074
slug: sqlfluff-pipx-fallback
type: task
status: backlog
phase: implement
created: 2026-03-29T17:09:00Z
last_modified: 2026-03-29T17:09:00Z
---

# Task: Recommend pipx instead of pip for SQLFluff fallback

**Type:** Bug

**Scope:** When SQLFluff auto-install fails (bare-pip project), safeword prints `pip install sqlfluff`. On modern macOS and many Linux distros, this fails with PEP 668 "externally managed environment" error. Change the SQLFluff fallback to recommend `pipx install sqlfluff`. SQLFluff is a standalone CLI tool — `pipx` is the correct install method for global CLI tools.

**Out of Scope:** Changing auto-install behavior for uv/poetry/pipenv projects (those already work). Changing ruff/mypy fallback (those are project-level dev deps, not global CLI tools — `pipx` is not appropriate for them). Adding pipx detection or auto-running pipx.

**Done When:**

- [ ] SQLFluff bare-pip fallback recommends `pipx install sqlfluff` instead of `pip install sqlfluff`
- [ ] Setup summary shows correct command

**Tests:**

- [ ] Existing tests pass

## Research

- PEP 668 (2023): distros mark system Python as "externally managed", blocking `pip install` outside venvs
- macOS Sequoia, Ubuntu 23.04+, Fedora 38+ all enforce this
- `pipx` installs CLI tools in isolated venvs — the official recommended replacement for `pip install <cli-tool>`
- Affects SQLFluff and future Semgrep (ticket 072) — both are standalone CLI tools suited for `pipx`. Ruff/mypy/deadcode are project-level dev deps where `pip install` inside a venv is correct.

## Work Log

- 2026-03-29 Created. Discovered during ticket 072 install vector research — same PEP 668 issue affects SQLFluff and all Python tool fallbacks today.
