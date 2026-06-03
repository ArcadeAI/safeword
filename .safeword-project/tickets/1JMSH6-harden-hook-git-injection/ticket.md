---
id: 1JMSH6
slug: harden-hook-git-injection
type: task
phase: done
status: done
created: 2026-06-02T23:31:02.166Z
last_modified: 2026-06-02T23:31:02.166Z
---

# Harden hook git calls against shell injection

**Goal:** Close the shell-injection class in safeword hooks — git invoked via `execSync` string interpolation runs through `/bin/sh -c`, so file-derived free-text values can inject commands. The hooks auto-fire on UserPromptSubmit/Stop; in a shared repo the file content can come from an untrusted PR.

**Why:** 153 fixed one site (`replan.ts` `runGit` → `execFileSync`, commit 22b6f074). `/quality-review` found an equivalent live sink: `stop-quality.ts` `git cat-file -e ${sha}` where `sha` is an unvalidated free-text checkbox annotation (`classifyAnnotation` returns any non-skip text as a "sha"). A crafted annotation injects when the done-gate runs.

**Scope:**

- **Layer 1 (the fix):** `stop-quality.ts` `isReachable` → `execFileSync('git', ['cat-file','-e', \`${sha}^{commit}\`])` — no shell, value passed literally.
- **Layer 2 (defense in depth):** add `isValidSha` (7–40 hex) to `parse-annotation.ts`; `ledger-validation.ts` rejects a malformed annotation as "not a valid SHA" before it ever reaches git. Update the two non-hex test fixtures (`ghi9abc`, `xyz9999`) to valid hex.
- **Conform (same class, internal input):** `session-auto-upgrade.ts:152-153` (`git add` / `git commit`) and `post-tool-quality.ts:89` (`git diff --stat … ${excludes}`) → `execFileSync` arg arrays.
- Tests: a shell-metacharacter sha is rejected (Layer 2) and/or passed literally with no execution (Layer 1).

**Out of scope:** `session-auto-upgrade.ts:137` `bunx safeword@${latest}` — `latest` is a registry semver, not file-derived; different threat model. Note only.

**Done when:** no file-derived value reaches a shell via these git calls; `templates/hooks/` ↔ `.safeword/hooks/` byte-identical; full suite + parity + typecheck green; a test proves a malicious annotation cannot execute.

**Reconcile:** deviates from the repo's `execSync` convention (21:1) for the interpolated-input sites — justified: eliminates the injection class; the values are arbitrary file text, the worst case. Same call made in 153.

## Work Log

- 2026-06-02T23:31:02.166Z Started: Created ticket 1JMSH6 (spun off from 153's /quality-review finding).
