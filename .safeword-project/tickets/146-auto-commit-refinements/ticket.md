---
id: 146
type: task
phase: understand
status: open
created: 2026-05-15T04:58:00Z
last_modified: 2026-05-15T04:58:00Z
---

# Auto-upgrade commit refinements: attribution + pre-commit bypass + change-list source

**Goal:** Three small refinements to `session-auto-upgrade.ts`'s auto-commit step, surfaced during PR #81's quality review.

1. Attribute auto-commits via `Co-Authored-By` trailer
2. Bypass pre-commit hooks by default (configurable opt-out)
3. Source the staged-files list from `safeword upgrade` itself rather than a hardcoded path filter

**Why bundled:** all three touch the same ~20-line auto-commit block in the hook. Shared testing surface. Cheaper to triage and ship as one PR than three.

**Supersedes:** #144 (build-time codegen of `safewordPaths`) — option 3 below makes that approach unnecessary.

## Background

PR #81 shipped auto-upgrade with an inline auto-commit. Three behaviors of that commit step were left as "good enough for v1" with explicit acknowledgement of follow-up:

- The user's git identity ends up as author of code they didn't write
- Pre-commit hooks fire (no `--no-verify`), which can block auto-upgrade if user's policy lints/formats files outside their domain
- The `safewordPaths` array is a hardcoded duplicate of "what is safeword-managed" knowledge that lives canonically in `SAFEWORD_SCHEMA.ownedFiles`

Industry references researched: Dependabot (uses bot identity, respects pre-commit by default, modifies known files), Renovate (same pattern). Safeword's setup is unusual (template files + multi-package), so 100% industry alignment isn't possible — but the refinements close the most defensible gaps.

## Scope

### 1. Attribution via Co-Authored-By trailer

**Change:** auto-commit message gains a trailer:

```text
chore: safeword auto-upgrade v0.30.0 → v0.30.3

Co-Authored-By: Safeword Auto-Upgrade <noreply@safeword.dev>
```

**Why this over alternatives:**

- Keeps user as primary author (their machine did the work; their HEAD moved)
- Adds standard GitHub-recognized co-author trailer for filterability (`git log --grep="Co-Authored-By: Safeword"`)
- No real bot account needed — the trailer alone provides audit signal
- Cleaner than full identity override (`-c user.email=...`) which would erase the user's hostname/machine signal

**Implementation:** ~2 LOC change to the `git commit -m ...` invocation. Use a multi-line message via heredoc or `\n`-escaped string.

### 2. Pre-commit bypass — default ON, opt-out via config

**Change:** auto-commit uses `--no-verify` by default. New config field `autoUpgrade.bypassPreCommit: boolean` (default `true`) lets users opt back into strict mode.

**Why default ON (deliberate divergence from Dependabot/Renovate's default-respect):**

- Safeword-managed files are not user code. User's pre-commit hooks are designed for THEIR code — running them on safeword files is a category error.
- The auto-upgrade has its own safety stack (24h release-age cooldown, exact-version pinning, supply-chain CI guards). User pre-commit isn't adding meaningful safety on top of that.
- A user's slow pre-commit (e.g., full lint+test) would make every auto-upgrade expensive, increasing the chance users disable auto-upgrade entirely. Default ON keeps the auto-upgrade fast.
- Failure-mode of default OFF: user with strict pre-commit hits friction, blames safeword, disables `autoUpgrade`. Failure-mode of default ON: user with policy concerns flips the config to enable strict mode. Recovery path is asymmetric — default ON optimizes for the common case while preserving the strict option.

**Implementation:**

- Extend `SafewordConfig` interface in `packs/config.ts`: `bypassPreCommit?: boolean` (defaults to `true` if absent — matches the "absent = on" pattern of `autoUpgrade`)
- Hook reads config; appends `--no-verify` to commit command if `bypassPreCommit !== false`
- Update versioning skill to mention the new config field

### 3. Change-list from `safeword upgrade` itself

**Change:** add `--print-changes` flag to `safeword upgrade` that prints (to stdout or a temp file) the list of files it created/modified. Hook consumes that list instead of running `git diff` + `git ls-files --others` + filtering against hardcoded `safewordPaths`.

**Why this over #144's build-time codegen:**

- The upgrade subprocess is the source of truth for what it wrote. Anything else (schema-derived or hardcoded) is a parallel list that can drift.
- New top-level prefixes (e.g., `.vscode/`) added in future packs get committed automatically — no schema-derive step, no hook update needed.
- Smaller surface area: ~5 LOC in `upgrade.ts` + ~5 LOC in hook vs. #144's build-system changes.
- Catches edge case: if the upgrade WANTS to write a file but the schema entry is missing/stale, #144's codegen wouldn't help; option 3 still records the file as "touched" and surfaces the inconsistency.

**Implementation:**

- `packages/cli/src/commands/upgrade.ts`: accept `--print-changes <path>` flag; collect created/updated paths during reconcile execution; write to the given path as newline-separated list before exiting
- `packages/cli/templates/hooks/session-auto-upgrade.ts`: invoke `bunx safeword@${latest} upgrade --print-changes /tmp/safeword-changes-${pid}.txt`; read the list; `git add` those files directly (no filter, no `git diff`, no `git ls-files --others`)
- Remove the `safewordPaths` constant from the hook
- Close #144 as superseded

## Done When

- [ ] Auto-commit message ends with `Co-Authored-By: Safeword Auto-Upgrade <noreply@safeword.dev>` trailer
- [ ] `autoUpgrade.bypassPreCommit: false` in `.safeword/config.json` makes the auto-commit respect pre-commit hooks; absent or `true` skips them via `--no-verify`
- [ ] `safeword upgrade --print-changes <path>` writes a newline-separated list of files it touched
- [ ] Hook consumes that list instead of running `git diff` / `git ls-files --others` / filtering against `safewordPaths`
- [ ] `safewordPaths` constant removed from the hook
- [ ] Unit tests for the new opt-out config behavior (extend `auto-upgrade.test.ts`)
- [ ] Smoke test: real `safeword upgrade --print-changes` invocation produces the expected list
- [ ] Versioning skill mentions `bypassPreCommit` config field
- [ ] #144 closed as superseded with reference to #146

## Out of Scope

- Switching the underlying execution model (e.g., to `PostToolUse(async)` per the SessionStart-blocking concern from the architectural debate) — different ticket
- Adding rollback-on-failure (already tracked as #143)
- Signing commits (`-S`) — separate decision, no current customer demand
- Auto-creating a real `safeword[bot]` GitHub App — heavier infrastructure, not justified for the trailer-only attribution

## References

- PR #81 quality review (this session) — surfaced all three concerns
- [Dependabot pre-commit support (March 2026)](https://github.blog/changelog/2026-03-10-dependabot-now-supports-pre-commit-hooks/) — for the pre-commit bypass rationale
- [Renovate bot comparison docs](https://docs.renovatebot.com/bot-comparison/) — for the attribution pattern
- #144 — superseded by option 3 above (close on merge)
- #143 — adjacent (auto-upgrade rollback on subprocess failure); independent of this work
