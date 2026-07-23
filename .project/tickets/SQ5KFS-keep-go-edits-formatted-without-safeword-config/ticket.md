---
id: SQ5KFS
slug: keep-go-edits-formatted-without-safeword-config
type: patch
phase: verify
status: in_progress
subtype: bug-investigated
created: 2026-07-22T05:33:05.457Z
last_modified: 2026-07-22T07:00:26Z
---

# Keep Go edits formatted without Safeword config

**Goal:** Format edited Go files promptly when the Safeword-specific golangci-lint configuration is unavailable.

**Why:** A missing optional config currently triggers a slow network upgrade that can exhaust the post-edit hook timeout before formatting runs.

## Scope

- Use the installed `golangci-lint` fallback immediately when its optional Safe Word config is absent.
- Keep Go linting and formatting behavior unchanged when the config is present.

## Out of Scope

- Changing the automatic upgrade policy for JavaScript, Python, Rust, or SQL.
- Changing Go lint rules, formatter selection, or the post-edit timeout.

## Done When

- [x] A Go file is formatted when the Safe Word Go config is absent.
- [x] The fallback does not start a network upgrade before formatting.
- [x] Template and dogfood hook sources stay synchronized.

## Tests

- [x] Integration: a real post-edit hook formats Go without its config while a fake `bunx` proves no upgrade is attempted.
- [x] Existing Go golden-path tests continue to pass.

## Root Cause

The Go hook treats an absent optional `.safeword/.golangci.yml` as a missing language pack and runs `bunx safeword@latest upgrade` before it calls `golangci-lint fmt`. Under full-suite load that networked subprocess exceeded the helper's 30-second deadline, so formatting never began. The standalone formatter works without any config in 69ms, and `golangci-lint run --fix` plus `fmt` completes in under one second; those rule out a formatter capability or normal linter performance problem. A raw hook capture showed `Go pack missing, running upgrade...` immediately before the timeout-prone path.

## Work Log

- 2026-07-22T05:33:05.457Z Started: Created ticket SQ5KFS
- 2026-07-22T05:36:00Z Investigated: full suite had one Go fallback failure while focused reruns were cache-sensitive. Confirmed the automatic upgrade is the blocking work; direct configless Go lint/format is fast. Ruled out a golangci-lint v2 formatter limitation and a slow `run --fix` path.
- 2026-07-22T05:41:14Z Implemented: absent Go config now selects golangci-lint's configless path rather than invoking the networked upgrade. The regression passed, and all 12 Go golden-path integration tests passed.
- 2026-07-22T07:00:26Z Verified: the project-generated plan passed: 5,284 Vitest tests, 484 BDD scenarios, 15,000 BDD steps, and TypeScript typecheck. Lint, formatting, diff checks, and template-to-dogfood parity are clean. Leave the patch in verify pending user confirmation.
