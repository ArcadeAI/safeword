---
id: WQQGVV
slug: hook-if-condition-audit
type: task
phase: intake
status: in_progress
epic: cc-changelog-alignment
relates_to: 8R54HV
created: 2026-05-31T21:05:09.534Z
last_modified: 2026-05-31T21:05:09.534Z
---

# Verify if: hook conditions still fire (git-bare-fix)

**Goal:** Confirm safeword's `if:`-gated hooks actually match and run on the installed CC version, and decide whether to keep relying on `if:`.

**Why:** CC `2.1.147` fixed `if:` hook conditions that "never matched." If users ran a pre-fix build, our only `if:`-gated hook was silently dead — and the bug class suggests `if:` matching is fragile.

## Finding (CC 2.1.147)

> Fixed hook `if` conditions like `PowerShell(git push*)` never matching

The cited example is PowerShell, but the failure mode (a declared `if:` condition silently never matching, so the hook never runs) is exactly how safeword gates the git-bare-fix hook.

## Evidence in safeword

- `.claude/settings.json` PreToolUse → matcher `Bash`, `if: "Bash(git *)"` → `pre-tool-git-bare-fix.sh`.
- `.safeword/hooks/pre-tool-git-bare-fix.sh` header explicitly states it relies on the `if` filter so non-git Bash incurs "zero process-spawn overhead," and intentionally does NOT re-check the command itself ("the `if` filter already confirmed this is a git command").
- So if `if:` silently fails to match, the hook either never fires (defeating the worktree `core.bare` race fix #58345) — the `.husky/pre-commit` copy only covers commits, not arbitrary git ops.

## Investigation steps

1. Determine the installed CC version and whether it predates `2.1.147`.
2. Empirically confirm `if: "Bash(git *)"` matches a `git status` Bash call (hook fires) and does NOT fire on a non-git Bash call.
3. If `if:` is unreliable on supported versions: either drop the `if` and add a cheap in-script `git`-prefix guard (the script already exits 0 fast when not in a repo), or document a minimum CC version.

## Done when

- `if:`-matching behavior is confirmed (fires on git, skips non-git) on the installed/supported CC version.
- If unreliable: git-bare-fix no longer depends solely on `if:` for correctness (in-script guard added), or a min-version is documented.

## Out of scope

- The substance of the `core.bare` race fix itself (already shipped and working when the hook fires).

## Work Log

- 2026-05-31T21:05:09.534Z Started: Created ticket WQQGVV
- 2026-05-31 Found the only `if:`-gated hook is git-bare-fix and it deliberately omits an in-script guard, trusting `if:`.
