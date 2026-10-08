# Design: one rule for choosing the project directory (#5467)

Status: approved; parts 1, 2a and 2b implemented (#5655, #5656, part 2b). Base: origin/main 53398c672 (includes #5571).

## Problem

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
   file, by real path (a symlinked path belongs to the tree it lands in).
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

## Durable home (state that must outlive a worktree)

`resolveDurableStateDirectory(projectDirectory)`: the primary checkout, found
without subprocess or env: worktree `.git` gitfile → `gitdir:` (relative to the
gitfile's directory) → `<gitdir>/commondir` (relative to gitdir) → its parent.
Accepted only if that parent's `.git` is the common dir itself and the parent is
enrolled; otherwise (bare repo, submodule, unenrolled primary) the working
project. Not a linked worktree → the project itself.

- Closeout binding: one file per working tree in the durable home's namespace
  root, `closeout-session-binding-<sha256(realpath projectRoot)>.json`; writer
  stamps `projectRoot` with the Bash call's resolved working tree (not launch).
  Reader (closeout-cleanup) computes the same name from its own worktree root.
  Sharded because the reader claims and deletes the whole file
  (`closeout-binding.ts:398-428`): a shared file would let worktree A's closeout
  destroy worktree B's fresh binding. Gitignore pattern registered in
  `NAMESPACE_TRANSIENT_BASENAMES`.
- Retro spool: writer (`safeword retro run`, `stop-retro`) and filer
  (`stop-retro-filing`, Cursor/Codex stop) both use the durable home's
  `.safeword/retro-drafts/` (already gitignored; drain guard unchanged). The
  closeout copy step (`closeout-cleanup.ts:2088`) stays one release to rescue
  existing worktree spools.

Required proof (real `git worktree` fixtures, real writers and readers):

- Retro: spool a draft with the real `safeword retro run` path from a linked
  worktree, `git worktree remove` it, then the real Stop filer gate run from
  the primary checkout reports that draft for filing.
- Closeout: produce bindings for two linked worktrees through the real
  pre-tool hook (Bash call whose `cwd` is each worktree), consume worktree A's
  through the real `closeout-cleanup` reader run from A, and assert A gets its
  binding and B's binding is still present and consumable from B.

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
(excluding the resolver and tests, ignoring comment lines): fails on reads of
`CLAUDE_PROJECT_DIR` and on `--show-toplevel`, unless allowlisted with a
reason. That catches every project choice that starts from the launch
variable or git's toplevel; it does not see a bare `process.cwd()` root or a
hand-written directory walk, which the real-hook tests cover instead. The
allowlist starts with not-yet-migrated sites and shrinks per PR; a stale entry
fails.

Known exception: `stop-reentry` and `session-start-reentry` anchor to the
nearest git root of the host cwd. They already follow the session into a
worktree and work in unenrolled repositories by design, so they keep their
own walk.

## Delivery (epic, four Draft PRs referencing #5467)

1. Module + durable home + guard; existing resolvers delegate. Behavior change:
   non-edit tools use step 2.
2. Stop/session hooks + session pointer (2a, closes #5256, #5346); the
   remaining per-tool and SessionStart hooks and `lib/lint` (2b).
3. Retro spool + closeout binding to the durable home.
4. CLI resolvers, Cursor/Codex adapters, final allowlist (closes #5395, #5467).
