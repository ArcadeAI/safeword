---
id: KJAM82
slug: verify-safeword-in-any-project
type: feature
phase: intake
status: in_progress
epic: verify-safeword-in-any-project
created: 2026-06-16T03:11:54.187Z
last_modified: 2026-06-16T03:12:24Z
scope:
  - Make safeword's installed verification path inspect the target project before choosing commands, instead of assuming this repo's Bun scripts.
  - Align `/verify` with available project scripts and package managers, including Bun, npm, pnpm, yarn, and projects with no JavaScript build script.
  - Keep safeword's own required runtime distinct from the customer's project runtime: safeword hooks may run with Bun, but project verification commands should match the project.
  - Make `/audit` and related safeword skills describe installed-project checks in stack-agnostic terms, with JavaScript-specific checks gated by project evidence.
  - Treat `packages/cli/templates/` as the product source of truth and dogfood `.safeword/`, `.agents/`, `.claude/`, and `.cursor/` files as upgraded output.
  - Add regression coverage for non-Bun, no-build, and non-JavaScript installed-project shapes.
out_of_scope:
  - Removing Bun as safeword's hook runtime.
  - Building full native test runners for every language ecosystem in this epic's first pass.
  - Changing human developer workflows outside AI-agent/safeword verification.
  - Hand-editing dogfood installed files as the durable fix without updating templates and upgrade output.
  - Resolving current third-party security advisories unrelated to command selection.
done_when:
  - `/verify` no longer fails arbitrary installed projects just because `bun run test`, `bun run test:bdd`, or `bun run build` is absent.
  - The verification guidance clearly separates safeword runtime checks from target-project verification checks.
  - `/audit` does not present JS/Bun-specific checks as mandatory for non-JS projects.
  - Dogfood installed files are refreshed from templates, and byte-alignment checks prove the generated copies match.
  - Tests cover package-manager-aware verification, missing build scripts, and minimal non-JS safeword installs.
  - Any remaining unsupported project shape falls back to explicit manual evidence instead of a false command failure.
---

# Epic: Verify safeword in any project

**Goal:** Make safeword's installed `/verify`, `/audit`, and related quality workflows work from the target project's reality, not from assumptions borrowed from the safeword monorepo.

**See:** [spec.md](./spec.md) for personas, jobs-to-be-done, and outcomes.

## Context

Safeword is a process layer that installs into arbitrary customer projects. The dogfood repo is useful because its installed files prove what an upgraded project receives, but the source of truth is still `packages/cli/templates/`.

The current gap is that some installed guidance still assumes the target project looks like this repo. `/verify` is the clearest case: hardcoded commands such as `bun run test`, `bun run test:bdd`, and `bun run build` can falsely fail Go, Python, Rust, npm, pnpm, yarn, or minimal safeword installs. That makes the done gate noisy for exactly the projects safeword claims to support.

## Proposed Shape

Use the existing project-aware runner logic as the design center: detect the target project's package manager and available scripts, run only commands the project can actually support, and ask for manual evidence when no automated verifier exists.

Template changes come first. Dogfood files are refreshed through safeword upgrade so `.safeword/`, `.agents/`, `.claude/`, and `.cursor/` stay honest installed-output examples.

## Child Tickets

_(fan out after intake is reviewed)_

- Make `/verify` package-manager and script aware for installed projects.
- Make `/audit` stack-aware without weakening JS-project checks.
- Prove dogfood upgrade alignment for all affected templates and installed copies.
- Add regression fixtures for no-build JS, non-Bun JS, and non-JS safeword installs.

## Work Log

- 2026-06-16T03:12:24Z Drafted: Epic scope from the any-project correction: installed safeword workflows must inspect the target project and use template-first dogfood validation.
- 2026-06-16T03:11:54.187Z Started: Created ticket KJAM82
