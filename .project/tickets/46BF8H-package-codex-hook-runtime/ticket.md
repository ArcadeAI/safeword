---
id: 46BF8H
slug: package-codex-hook-runtime
type: patch
subtype: bug-investigated
phase: verify
status: in_progress
created: 2026-08-31T06:07:06.814Z
last_modified: 2026-08-31T08:20:00.000Z
---

# Keep Codex protection active after plugin updates

**Goal:** Ship every hook dependency required by the standalone Codex plugin runtime so installed hooks execute without project-local bootstrap files.

**Why:** The 0.82.3 Codex plugin runtime resolves packaged hooks under templates/hooks, but the generator emits only runtime and skill assets, causing every installed PreToolUse hook to fail closed after restart.

**Scope:** Package the existing `SAFEWORD.md` and complete hook runtime tree in the generated Codex plugin, prove an installed cache copy can execute its PreToolUse hook, and classify the generated mirror as generated in repository analyzers.

**Out of Scope:** Redesigning hook dispatch, bundling hooks into the CLI runtime, changing hook behavior, or adding fallback to project-local hook files.

**Done When:**

- [x] A generated and Bun-packed Codex plugin contains the complete package-owned hook runtime and handbook.
- [x] A real Codex cache install executes a safe packaged PreToolUse hook successfully without project dependencies.
- [ ] Release verification passes and the hotfix is published and installed.

**Tests:**

- [x] Release contract rejects a packed plugin missing the packaged handbook or hook entrypoints.
- [x] Installed-cache release test invokes the packaged PreToolUse hook, not only `--version`.

## Root Cause

Commit `9823e8c30` changed Codex hook commands from `bunx` to a bundled CLI. The bundled CLI retained its existing lookup contract—`templates/hooks/**` plus `templates/SAFEWORD.md` adjacent to the runtime—but `generate-codex-plugin.ts` generated only `runtime/`, `skills/`, and `package.json`. Codex copies only `codex-plugin/` into its cache, so neither fallback template root exists after installation. A full restart exposed the missing `codex/pre-tool-quality.ts` and the fail-closed PreToolUse path blocked every shell/edit command.

Confirmed by inspecting the installed 0.82.3 cache, the generated runtime's `TEMPLATE_DIRECTORIES`, and the generator output list. The existing cache-install release test exercised only `runtime/cli.js --version`, so it never crossed the packaged-hook boundary.

Ruled out:

- Hook activation/restart failure: the packaged hook command did run and produced the missing-file error.
- npm omission of an otherwise generated asset: the checked-in `codex-plugin/` tree itself lacks `templates/`; `package.json#files` already includes the whole `codex-plugin` directory.
- A single missing adapter: SessionStart, PostToolUse, UserPromptSubmit, and Stop also resolve files from the same absent hook tree, and SessionStart additionally resolves `SAFEWORD.md`.

## Decision

Relevant domains: generated-artifact completeness, installed-cache isolation, transitive TypeScript hook imports, release-package verification, and payload size.

Options considered:

1. Copy `templates/hooks/**` and `templates/SAFEWORD.md` into the generated plugin. This matches the runtime's existing lookup contract and preserves one hook source of truth at about 1.1 MB.
2. Bundle every hook into `runtime/cli.js`. This removes filesystem dependencies but requires a new dispatch architecture and risks changing subprocess/isolation behavior during a hotfix.
3. Fall back to project-local `.safeword` hooks. This is smaller but violates standalone plugin operation and makes activation depend on project reconciliation again.

Recommend option 1 because it restores the contract the runtime already implements with one generator change and no behavioral redesign. Option 2 is attractive for a future packaging simplification but loses on hotfix risk and scope; option 3 does not solve fresh or stale projects.

**Premortem:** The copy fix fails later if a new packaged runtime dependency is added outside the copied template roots; mitigate with installed-cache execution tests and explicit packed-artifact assertions.

**Next:** add the failing installed-cache release test, then copy the two runtime roots in `generate-codex-plugin.ts`.

## Work Log

- 2026-08-31T06:07:06.814Z Started: Created ticket 46BF8H
- 2026-08-31T06:12:00Z Found: generated runtime resolves `templates/hooks/**` and `templates/SAFEWORD.md`, while the generator emits neither.
- 2026-08-31T06:12:00Z Decided: preserve the existing runtime contract by copying the complete shared hook tree and handbook into the plugin.
- 2026-08-31T06:18:00Z Audit: generated mirror was misclassified as handwritten source by repository analyzers; aligned exclusions with the existing generated Claude plugin/runtime treatment.
- 2026-08-31T08:20:00Z Review: independent quality review found no release-blocking defect; corrected the ESM import, added negative artifact coverage, narrowed formatting exclusions, and proved packaged SessionStart handbook resolution.
- 2026-08-31T08:20:00Z Verify: targeted release contract passes 8/8 and generated Codex plugin is current at 0.82.3.
- 2026-08-31T09:15:00Z BDD: adapted the packaged handbook with the existing Codex workflow-invocation rewrite; the previously failing bare-name compatibility scenario now passes.
- 2026-08-31T09:17:00Z Review: replaced packed-hook spot checks with an exact byte-for-byte comparison of the complete generated templates tree.
