---
id: '075'
slug: linter-resilience
title: 'Linter hook: distinguish crash from clean pass, surface stderr'
type: Bug
status: done
---

# Task: Linter hook: distinguish crash from clean pass, surface stderr

**Type:** Bug

**Scope:** Fix `captureRemainingErrors()` in `lib/lint.ts` to capture stderr when stdout is empty, distinguishing "linter ran clean" from "linter crashed".

**Out of Scope:** Per-linter version management, installing linters automatically, changing which linters run, adding new language support.

**Context:** Dogfooding on ArcadeAI/monorepo: golangci-lint crashed (Go version mismatch), ESLint hit pre-existing tsconfig errors. Both failures were silently swallowed because `captureRemainingErrors()` only reads stdout. The agent reported success when linters never actually ran.

**Root Cause:** `captureRemainingErrors()` (lint.ts ~line 216) uses `.nothrow().quiet()` which suppresses stderr, then checks only `stdout`. When a linter crashes, error goes to stderr, stdout is empty, function returns `undefined` (= no issues).

## Fix

Add `warnings` parameter to `captureRemainingErrors`. When a linter crashes (non-zero exit, empty stdout, stderr present), push to warnings instead of returning as lint errors. No return type change, no `LintResult` interface change, no `post-tool-lint.ts` changes — infra warnings flow through the existing warnings → plain text stdout path.

```typescript
async function captureRemainingErrors(
  command: string[],
  warnings?: string[],
): Promise<string | undefined> {
  const result = await $`${command}`.nothrow().quiet();
  if (result.exitCode === 0) return undefined;
  const stdout = result.stdout.toString().trim();
  const stderr = result.stderr.toString().trim();
  // Infra failure: linter crashed, not a lint error in the user's code
  if (!stdout && stderr && warnings) {
    warnings.push(`${command[0]} failed: ${stderr.split('\n')[0]}`);
    return undefined;
  }
  return stdout || undefined;
}
```

Each call site passes its existing `warnings` array as second arg (all 4 callers already have it in scope).

## Key Design Principle

- Lint errors (exit 1 + stdout) → surface as `errors` via `additionalContext` (agent should fix)
- Infrastructure failures (non-zero exit + empty stdout + stderr) → surface as `warnings` via plain text (agent informs user)
- Clean pass (exit 0) → no output

## Why not...

- **New return type `{ errors, infraWarning }`?** Over-engineered. Changes every call site and the `LintResult` interface. The existing `warnings` array handles this.
- **`.timeout()` on Bun `$` shell?** Doesn't exist. Linter hangs are the rarest failure mode — not worth the complexity of `Promise.race` wrapping.
- **Separate output channel in `post-tool-lint.ts`?** Claude Code hooks have `additionalContext` (for Claude) and plain text stdout (shown as hook output). The existing warnings path already uses plain text stdout. No new mechanism needed.

## Files

- `packages/cli/templates/hooks/lib/lint.ts` — fix `captureRemainingErrors()`, update 4 call sites

**Done When:**

- [ ] golangci-lint version mismatch surfaces a warning (not silent pass)
- [ ] ESLint config error surfaces a warning (not silent pass)
- [ ] Normal lint errors still surface as errors (no regression)
- [ ] Clean linter pass still returns no output (no regression)
