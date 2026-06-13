---
id: 072
slug: semgrep-security-layer
type: feature
status: backlog
phase: research
created: 2026-03-28T17:09:00Z
last_modified: 2026-03-29T16:59:00Z
---

# Add Semgrep as a cross-language security scanning layer

**Goal:** Ship `.semgrep.yml` configs to customers so they get security scanning that complements the per-file linters safeword already provides.

**Why:** Current security coverage has two gaps: (1) Rust has no dedicated security scanner (clippy thresholds only), and (2) all linters are single-file pattern matchers — none track tainted data across function/file boundaries. Semgrep OSS fills gap #1 directly. Gap #2 requires Semgrep Pro (paid) — document this but don't gate the feature on it.

## Design Decisions

**Cross-cutting module, not a language pack.** Semgrep handles all languages in one config file. Create a module that reads detected language packs and generates one unified `.safeword/semgrep.yml`. Follows the reconciliation engine pattern but doesn't implement the `LanguagePack` interface.

**CI / `/verify` integration, not hooks.** Semgrep scans the full repo (~seconds, not milliseconds). Too slow for the per-edit post-tool hook latency budget. Wire into `/verify` and as a `test:semgrep` script.

**Installation: detect first, install only where appropriate.** Semgrep is a ~60MB Python package (no standalone binary exists).

- **Already on PATH:** done. No install needed.
- **Python projects with uv/poetry/pipenv:** auto-install as dev dep via their PM (SQLFluff precedent). The PM handles venv — safeword never touches venvs directly.
- **Python projects with bare pip:** skip auto-install (PEP 668), print `pipx install semgrep`.
- **Non-Python projects:** do NOT add as a Python dev dep (pollutes project with unrelated Python tooling). Print: macOS → `brew install semgrep`, otherwise → `pipx install semgrep`. `pipx` installs in an isolated venv without touching project deps.
- **Always:** config is generated regardless. Scanning just won't run until they install it.

**Additive config.** If customer has existing `.semgrep.yml`, extend it (never replace) — matching the established principle across all language packs.

**What's NOT in scope:**

- Per-edit hook integration (too slow for hook latency budget)
- Semgrep Pro features (document free vs Pro distinction only)
- Semgrep Supply Chain / Secrets (separate concerns, separate tickets)
- Exhaustive per-language rule catalogs (start small, expand based on signal)

## Implementation Plan

1. **Detection** — Check `which semgrep` during setup. If missing: for Python projects with uv/poetry/pipenv, auto-install as dev dep. For all others, print `pipx install semgrep` (or `brew install semgrep` on macOS). Continue either way.

2. **Module** — Create `packages/cli/src/semgrep/` module. Reads detected language packs from config, generates unified `.safeword/semgrep.yml`.

3. **Config generation** — `.safeword/semgrep.yml` as an ownedFile (regenerated on upgrade). References curated community rule packs per detected language (e.g., `p/javascript`, `p/golang`, `p/rust`).

4. **Custom rules** — 3-5 safeword-authored rules in `packages/cli/templates/semgrep-rules/` for LLM code patterns: `exec`/`spawn` with variable args, YAML.parse without failsafe, `eval()`/`Function()`, hardcoded credentials.

5. **Script** — Add `test:semgrep` to package.json via jsonMerges in schema.

6. **Verify** — Wire into `/verify` command. Run Semgrep scan if available, skip gracefully if not.

7. **Tests** — Golden-path integration test: setup generates valid config, scan runs clean.

## Research

- **Semgrep OSS** (LGPL-2.1): 2,800+ community rules, 17 GA languages (includes TS, Python, Go, Rust), 10s median CI scan, runs fully local. No account required.
- **Semgrep Pro** ($30/dev/mo): cross-file taint tracking, 20,000+ rules, ~25% fewer false positives
- **Chosen over Snyk Code** because: custom YAML rules (Snyk has limited custom rules), local-only execution (Snyk is cloud-only), free OSS tier, fills Rust security gap
- **Existing coverage overlap**: Python Bandit (`"S"` rules via Ruff) and Go gosec already cover most of what Semgrep's community rules catch for those languages. Primary new value is Rust security + custom LLM-pattern rules + cross-language consistency.
- **No standalone binary**: GitHub issue #10671 open since Nov 2024, zero maintainer response. osemgrep (pure OCaml) is experimental. PyPI wheels contain prebuilt OCaml core but are distributed inside Python wheels.
- **Install options**: pip/pipx (needs Python), brew (installs Python as dep), Docker `semgrep/semgrep` (Python-free), Nix. No npm package.

## Done When

- [ ] `safeword setup` generates `.safeword/semgrep.yml` for all projects
- [ ] Python projects with uv/poetry/pipenv get Semgrep auto-installed as dev dep
- [ ] Non-Python projects get `pipx`/`brew` instructions (not added as Python dev dep)
- [ ] Config references curated community rules for each detected language
- [ ] 3-5 custom safeword rules for LLM code patterns
- [ ] `/verify` runs Semgrep scan if available, skips gracefully if not
- [ ] Golden-path integration test passes
- [ ] ARCHITECTURE.md updated

## Work Log

- 2026-03-28 Created. Semgrep chosen over Snyk Code — custom rules, local-only execution, free OSS, fills Rust security gap.
- 2026-03-29 Resolved install vector: SQLFluff precedent for Python projects only (auto-install as dev dep via uv/poetry/pipenv). Non-Python projects get `pipx install semgrep` or `brew install semgrep` — do NOT pollute their deps with Python tooling. No standalone binary exists.
