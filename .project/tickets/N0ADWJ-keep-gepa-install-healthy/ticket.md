---
id: N0ADWJ
slug: keep-gepa-install-healthy
type: patch
phase: done
status: done
created: 2026-10-07T15:40:27.820Z
last_modified: 2026-10-07T15:45:00Z
---

# Keep repository installation healthy for developers using GEPA

**Goal:** Declare GEPA development tools and confirm no-input installation succeeds.

**Why:** The isolated pip experiment lacked Safeword-required tool declarations.

Related issue: https://github.com/ArcadeAI/safeword/issues/4186. This patch addresses the repository's GEPA declarations; the broader installer reporting policy remains open.

## Scope

- Declare ruff, mypy, deadcode, and pip-audit in GEPA's development requirements.
- Document initial setup of the isolated virtual environment.
- Confirm the original no-input install exits successfully.

## Out of scope

- Changing installer readiness policy, global Python packages, or the optimizer dependency.

## Verification

The declaration-only patch is implemented at 598fe095ecfc568bfd3c11a2172364872d382df0. CI run 37642918560 passed both Node test matrices, acceptance lanes, release gates, lint, contract, parity, dependency audit, and conformance. Local installation exits 0 with Project, Claude, and Codex ready; all 37 virtual-environment packages are compatible and GEPA imports at 0.1.4. See verify.md for the proof and review limits.

## Done when

- [x] Safeword recognizes all four GEPA development tools.
- [x] The isolated environment installs compatible runtime and development dependencies.
- [x] Original repository install exits 0.
- [x] Source-commit independent review and CI pass; final-head merge checks remain separate.

## Work Log

- 2026-10-07T15:40:27.820Z Started: Created ticket N0ADWJ
- 2026-10-07T15:42:00Z Completed local delivery: source patch reviewed and verified; recorded this patch separately after the readiness guard selected the earlier completed Codex ticket. Final-head CI and hosted review still govern merge authority through the PR's current readiness evidence.
