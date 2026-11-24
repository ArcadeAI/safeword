# Design: one rule for choosing the project directory (#5467)

Parts 1–3 shipped. Part 4 remains open under #5467 and #5395.

## Original problem

The following observations motivated the work. The delivery record below gives the current status.

Claude Code keeps `CLAUDE_PROJECT_DIR` at the launch checkout after a session
enters `.claude/worktrees/<name>`; the hook input `cwd` follows the session
(and every `cd`). Safeword surfaces pick "the project" in ~10 different ways,
so state is written in one checkout and read in another:

- Stop hooks (`stop-quality.ts:113`, `stop-retro.ts:58`, `stop-retro-filing.ts:32`,
  `stop-self-report.ts:53`) root at `CLAUDE_PROJECT_DIR ?? process.cwd()` while
  PostToolUse writes quality state into the edited file's worktree.
- Retro spool: written under `<cwd project>/.safeword/retro-drafts/`, filed from
  the launch checkout's spool; lost when the worktree is removed.
- Closeout binding: written by pre-tool in the launch checkout's namespace root
  with `projectRoot = launch`; read by `closeout-cleanup.ts` from
  `git rev-parse --show-toplevel` of its cwd and filtered by `projectRoot === worktree`.
- CLI: `canonicalClaudeProjectRoot`, `resolveCodexProjectDirectory`,
  `retro.ts:1442`, `run-review.ts:121` prefer the env var over cwd.
- Non-edit, non-Bash tools resolve to the launch checkout in
  `resolveToolProjectDirectory` (`namespace-root.ts:98`).

## Rule

New module `packages/cli/templates/hooks/lib/project-directory.ts` (hooks can't
import `src/`; `src/` and `templates/scripts` already import `templates/hooks/lib`).

`resolveProjectDirectory({ launchDirectory?, editedFile?, cwd })`:

1. Nearest enrolled git working tree (`.safeword/SAFEWORD.md`) of the edited
   file, by real path (a symlinked path belongs to the tree it lands in). An
   edited file outside every git tree (an absolute configured namespace root)
   has no owner by location and resolves to the launch checkout, whose config
   can name that root; it never falls to step 2.
2. Else nearest enrolled working tree of `cwd`. `cwd` is a required input: a
   hook passes the host-reported cwd, a helper or CLI command passes its own
   `process.cwd()`. The resolver never reads ambient process state for it.
3. Else the launch checkout (`resolveLaunchDirectory`: `CLAUDE_PROJECT_DIR`,
   else `process.cwd()`).

Relative edit paths resolve from the same base everywhere
(`canonicalEditTarget`): the reported cwd, else the launch checkout.

"Nearest working tree" means the walk stops at the first ancestor holding
`.git` (directory or gitfile), exactly as `resolveDirectoryOwner` does today.
If that tree is unenrolled, the step yields nothing and resolution moves to the
next step; it never searches past that tree into an enrolled ancestor. Required
proof: a fixture with an unenrolled repository C nested inside enrolled
repository B, edit in C, cwd in enrolled A: result is A (step 2), never B.

Comparisons use real paths. Bash cwd keeps today's lexical-vs-real handling.
This is the only place allowed to read `CLAUDE_PROJECT_DIR` as a project root.
Existing resolvers in `namespace-root.ts` become wrappers, then are removed.

## Worktree state on main (part 3)

### Closeout session binding

Claude, Codex and Cursor record a short-lived binding in the working tree where
the closeout command will run. The hook resolves the shell cwd or a leading
literal `cd <absolute path> &&`. A worktree-specific filename keeps bindings
separate even when two trees share one configured namespace root. If the hook
cannot resolve the command, it denies the invocation and returns a runnable
retry. The retry preserves quoting for plugin paths. The worktree and host
adapter integration tests cover the writer and closeout reader.
See [#7768](https://github.com/ArcadeAI/safeword/pull/7768) and
[#7837](https://github.com/ArcadeAI/safeword/pull/7837).

### Retro findings after worktree removal

The writer keeps a durable copy in `<git common dir>/safeword/retro-drafts/`.
At handoff, `stageRetroSpool` stages pending findings into the checkout’s
`.safeword/retro-drafts/`, where the filer can acknowledge and drain them
without needing write access to a protected Git directory. Removal records
and acknowledgments keep previously filed findings from being staged again.
Closeout merges outstanding records into the surviving checkout. Outside Git,
the project-local spool remains the home. Filing abandoned sessions’ drafts
is outside #5467. See the implementation and worktree-removal tests in
[#7869](https://github.com/ArcadeAI/safeword/pull/7869).

## Remaining work (part 4)

Apply the shared resolution rule to the CLI and host adapters. Both
`canonicalClaudeProjectRoot` and `resolveCodexProjectDirectory` currently
prefer an inherited `CLAUDE_PROJECT_DIR` even when the command runs in an
enrolled linked worktree. Keep the launch checkout as the fallback when the
cwd has no enrolled owner.

**First regression test.** Create a real primary checkout and an enrolled
linked worktree with an isolated Claude profile. Put a pending Claude
transaction only in the primary checkout. Invoke `safeword claude status --json`
from each tree with `CLAUDE_PROJECT_DIR` set to the primary checkout and no
plugin installed. The primary must report `recovery-required`; the linked
worktree must report `missing`. Today both resolve to the primary. This
command exercises the affected resolver through a read-only public entry
point. The original `project test-plan` example uses the supplied cwd directly
and cannot detect a regression in that resolver.

Cover the Codex adapter through its public hook command with distinguishable
state in each checkout. Retain the part 2b child-process tests. Remove each
`projectEnvironment` override only after its caller passes those tests without
it, then narrow the parity allowlist. Verify the executable-RED receipt lookup
in #5395 before closing that issue.

## Session state at Stop

PostToolUse records a session pointer naming the working tree it last wrote
quality state to (step 1 carried to Stop, which has no edited file and whose
cwd follows `cd`). The pointer must be findable without knowing any project,
because the session may have edited repository B and returned to repository A
before Stop. So it is keyed by session, not by project: one file per session at
`<tmpdir>/safeword-session-project-<sanitized session id>`, holding the real
path of the working tree. This follows the existing per-session marker
convention in `retro-trigger.ts` (`tmpdir()`, injectable `baseDirectory` for
tests). Sessions don't outlive a reboot, so OS temp cleanup is enough; a lost
pointer falls back to the rule. Nothing is written into the repository.

`resolveSessionProjectDirectory({ sessionId, cwd, env })` reads the pointer
when it names an existing enrolled tree, else applies the rule with the input
`cwd`. Missing session id → the rule. Used by Stop hooks, `prompt-questions`,
`prompt-retro-nudge`, `post-tool-skill-nudge`, `session-compact-context`,
`session-cleanup-quality`. `stop-quality.ts` module-level roots move after
stdin parsing.

Required proof: a real-hook test with two enrolled repositories A and B (and
separately a main checkout plus linked worktree): launch in A, PostToolUse an
edit in B, Stop with `cwd` = A and `CLAUDE_PROJECT_DIR` = A; Stop must read B's
quality state.

Known limit: a session editing two trees splits state; the pointer follows the
latest edit.

## Parity guard

Static test over `templates/hooks/**`, `templates/scripts/**`, `src/**`
(excluding the resolver and tests), parsed with the TypeScript compiler so
comments never count: fails on reads of `CLAUDE_PROJECT_DIR` (property,
element or destructuring access), `?? process.cwd()` root fallbacks,
hand-written `.git`/`.safeword` walk-ups and `--show-toplevel`, unless
allowlisted with a reason. It is a tripwire, not a sandbox: a key computed at
runtime can still slip past, which the real-hook tests cover. The allowlist
starts with not-yet-migrated sites and shrinks per PR; a stale entry fails.

Known exception: `stop-reentry` and `session-start-reentry` anchor to the
nearest git root of the host cwd. They already follow the session into a
worktree and work in unenrolled repositories by design, so they keep their
own walk.

## Delivery

1. Shared resolver and parity guard shipped in #5655.
2. Session routing and per-tool hooks shipped in #5656 and #5664.
3. Closeout binding and recovery shipped in #7768 and #7837. Durable retro findings shipped in #7869.
4. CLI and adapter resolution, receipt lookup, and the final parity allowlist remain open.
