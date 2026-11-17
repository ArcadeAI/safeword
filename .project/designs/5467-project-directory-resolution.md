# Design: one rule for choosing the project directory (#5467)

Status: approved; parts 1, 2a and 2b implemented (#5655, #5656, #5664). Parts 3 and 4 revised 2026-11-17 (see Durable state). Base: origin/main 53398c672 (includes #5571).

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

## Durable state (parts 3 and 4)

Revised 2026-11-17 after part 2b. The durable-home resolver listed for part 1
was never built; this section replaces it.

### What the user sees

Nothing new: no command, no config, nothing in `git status`. Safeword acts on
the folder the agent is working in. A `safeword` command acts on the folder it
runs in. A session's retro findings are still filed by that session after its
worktree is deleted. When
Safeword cannot proceed, the message names the folder and the one command to
run. The parts that follow serve this contract.

### Retro spool: the repository's shared git directory

Drafts move to `<git common dir>/safeword/retro-drafts/`. The common dir is
what every worktree of a repository shares (`git worktree`, "DETAILS"), so it
survives any way a worktree disappears: `git worktree remove`, a deleted folder
plus `git worktree prune`, or a host archiving its worktrees. It needs no
gitignore entry and no enrolled primary checkout, and bare repositories and
submodules have one too. Outside git, the project's `.safeword/retro-drafts/`
stays the home.

- The common dir comes from git itself:
  `git -C <project> rev-parse --path-format=absolute --git-common-dir`. This
  is one subprocess, and it tracks git's own formats, such as relative
  worktree links (`worktree.useRelativePaths`) and `GIT_COMMON_DIR`. A
  hand-parsed gitfile and `commondir` chain would have to follow those
  formats forever.
- One function, `retroSpoolDirectory(projectDirectory)` in
  `lib/retro-draft-spool.ts`, builds the path. Every reader and writer uses it:
  `retro run`, the retro CLI protocol handlers, `relay-delivery`,
  `drain-retro-spool`, `retro-filing-gate`, `retro-nudge`, `stop-retro`,
  `stop-retro-filing`, the Codex and Cursor stops, and closeout. The parity
  guard rejects the `retro-drafts` literal anywhere else, so a missed consumer
  fails a test instead of filing from an empty folder.
- Transition, for one release, with no migration step: writers write only to
  the shared folder, and nothing is moved. The filer is handed one spool path
  and reads, acknowledges and drains that file, as today. So the gate treats
  the two locations as two spools for the same session. While the session's
  legacy spool in the resolved project's `.safeword/retro-drafts/` holds
  unfiled drafts, the gate dispatches that path, and the filer runs unchanged.
  Once the legacy spool is empty, the gate first removes from the shared spool
  every draft whose signature the legacy `.acks.jsonl` acknowledges, using the
  existing `markDraftsFiled` atomic rewrite. Only then does it dispatch the
  shared path, and only if drafts remain. So the filer reads only unfiled
  drafts, and a finding spooled once before and once after the upgrade is
  filed once. The closeout rescue step (`closeout-cleanup.ts:2088`) stays
  for this release, so a legacy spool in a removed worktree lands in the
  primary's legacy folder, where the gate still looks. The next release
  deletes the legacy branch and the rescue step.
- Out of scope: filing drafts whose session ended before they were filed.
  Today a session files only its own spool, and that stays true. Recovering
  another session's spool needs a single-filer rule across sessions, plus a
  retry budget the recovering session owns. That is its own ticket, not a
  piece of #5467. Part 3 makes the shared folder the place such a sweep would
  read.

### Closeout binding: the working tree it runs in

Today the writer stamps the launch checkout (`pre-tool-quality.ts:624`), and
closeout reads from the git root of its own cwd (`closeout-cleanup.ts:2129`). So
closeout run inside a worktree finds no binding. The binding is short-lived
and consumed before the worktree is removed, so it needs no durable home.

- The writer and the reader derive the same directory: the git toplevel where
  the closeout command actually runs. The writer takes the reported cwd and
  follows a leading literal `cd <path> &&`. The binding is written to that
  tree's namespace root as
  `closeout-session-binding-<first 16 hex of sha256(real path of the tree)>.json`.
  The name matters, because worktrees can share one absolute configured
  namespace root, and the reader claims and deletes its whole file
  (`closeout-binding.ts:398-428`). A fixed name would let one worktree's
  closeout destroy another's binding. The pattern is registered in
  `NAMESPACE_TRANSIENT_BASENAMES`, so it stays out of `git status`.
- If the writer cannot tell where closeout will run (for example
  `cd "$DIR" && bun …/closeout-cleanup.ts`), the pre-tool hook denies that one
  Bash call. Closeout never starts, so it cannot consume a leftover binding.
  The denial says, plainly, to change into the worktree first and run closeout
  as its own command, and gives the exact command. The agent retries in the
  next step without the user doing anything.
- All three writers (Claude `pre-tool-quality`, Codex `pre-tool-quality`,
  Cursor `before-shell-execution`) move in the same PR. A writer that
  disagrees with the reader breaks closeout on that host.

### CLI and adapters (part 4)

The CLI applies the same rule as the hooks, using its own cwd. Its enrolled
working tree (step 2) wins over `CLAUDE_PROJECT_DIR` (step 3). This matters
because a `safeword` command the agent runs through Bash inherits the launch
checkout's `CLAUDE_PROJECT_DIR`. Today that command acts on the launch
checkout even when the agent is in a worktree. `canonicalClaudeProjectRoot`
and `resolveCodexProjectDirectory` delegate to the shared resolver. The hooks'
`projectEnvironment` overrides (part 2b) then become redundant and are
removed. The part 2b tests that prove each child acts on the worktree stay as
the regression net.

### Required proof (real `git worktree` fixtures, real writers and readers)

- Retro, for each removal path (`git worktree remove`, deleting the folder
  plus `git worktree prune`, and a worktree created with `--relative-paths`):
  spool a draft with the real `safeword retro run` from the linked worktree,
  remove the worktree, then run the real Stop filer gate with the same
  session id and a cwd in the primary checkout. It dispatches the draft.
- Retro transition, through the real gate and the real filer flow (read,
  file against a stubbed tracker, acknowledge, drain): a session with one
  draft only in its legacy spool, one only in the shared spool, and one
  finding in both. Across consecutive Stops, the stubbed tracker records
  exactly one create per finding. Both spool files end with no drafts, and
  each finding is acknowledged. A variant where the only shared draft is
  already legacy-acknowledged dispatches nothing and leaves the shared spool
  empty.
- Closeout: produce bindings for two linked worktrees through the real
  pre-tool hook. One uses a Bash `cwd` of the worktree; the other runs
  `cd <worktree> && bun .safeword/scripts/closeout-cleanup.ts` from the primary
  checkout. Each real closeout reader run from its worktree gets its own
  binding, and the other worktree's binding survives. Run it once with each
  worktree's own namespace root and once with both sharing one absolute
  configured namespace root. Repeat for the Codex and Cursor writers.
- Closeout, unresolvable `cd`: with a fresh binding already present for the
  worktree, the real pre-tool hook denies `cd "$DIR" && bun …/closeout-cleanup.ts`
  with the recovery message, and the binding file is unchanged.
- CLI: `safeword project test-plan --json` run from a worktree with
  `CLAUDE_PROJECT_DIR` set to the launch checkout plans the worktree.

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

## Delivery (epic, four Draft PRs referencing #5467)

1. Module + guard; existing resolvers delegate. Behavior change: non-edit
   tools use step 2. (#5655)
2. Stop/session hooks + session pointer (2a, #5656, closes #5256, #5346); the
   remaining per-tool and SessionStart hooks and `lib/lint` (2b, #5664).
3. Retro spool to the shared git directory, with migration; closeout binding
   to the tree closeout runs in, for all three hosts.
4. CLI resolvers and the Codex/Cursor adapters follow the rule; the
   `projectEnvironment` overrides are removed; final allowlist (closes #5395,
   #5467).
