---
id: P6PN58
slug: lint-skips-shell-edits
type: task
phase: intake
status: in_progress
created: 2026-08-20T15:46:36.381Z
last_modified: 2026-08-20T15:46:36.381Z
---

# Lint files changed by shell commands, not just file-tool edits

**Goal:** Give auto-lint a path-discovery fallback so a file edited through a shell command gets linted on all three hosts, matching the coverage quality hooks already have

**Why:** post-tool-lint keys off tool_input.file_path, which only exists for file-edit tools; a shell command carries no file_path so the hook exits silently and the edit ships unlinted. All three hosts share the gap while their quality hooks already cover shell, so the asymmetry looks unintended

## The mechanism

`post-tool-lint.ts` resolves its target as:

```ts
const file = input.tool_input?.file_path ?? input.tool_input?.notebook_path;
if (!file || !(await Bun.file(file).exists())) process.exit(0);
```

A shell tool invocation carries a command string, not a `file_path`, so the hook
exits silently at that guard. Nothing is linted and nothing is reported — the
edit simply passes unchecked.

## Per-host state (verified 2026-08-20)

| Host | Lint on file-tool edit | Lint on shell-driven edit | Quality hook covers shell |
| --- | --- | --- | --- |
| Claude | yes — `PostToolUse` matcher `Edit\|Write\|MultiEdit\|NotebookEdit` | **no** — `Bash` absent from the matcher | yes — `post-tool-quality` matches `...\|Bash` |
| Codex | yes — `apply_patch` targets are expanded and linted individually | **no** — any non-`apply_patch` tool forwards `rawInput`, which has no `file_path` | yes — `codex/post-tool-quality.ts` runs on the same `PostToolUse` |
| Cursor | yes — `afterFileEdit` lints `file_path` | **no** — shell edits arrive via `beforeShellExecution` / `postToolUse`, neither of which lints | yes — `cursor/post-tool-quality.ts` matches `Write\|Shell` |

Confirmed the Claude gap is shipped, not just local: `plugin/hooks/hooks.json`
carries the same `Edit|Write|MultiEdit|NotebookEdit` matcher for
`post-tool-lint` and `Edit|Write|MultiEdit|NotebookEdit|Bash` for
`post-tool-quality`.

Codex is the strongest of the three — `postToolLintInputs` expands a multi-file
`apply_patch` into one lint input per target path — but it still degrades to the
unlintable raw input for `Bash`.

None of the three `post-tool-quality` hooks call `lintFile` (verified: zero
references in all three), so quality coverage is not a substitute.

## Why it matters

The gap is invisible in exactly the way that causes damage: the hook does not
warn that it skipped: it exits 0. An agent editing via `sed`, `python3`, or a
heredoc gets the same silence as a clean lint result and reasonably concludes
the edit was checked.

Observed in this session — the `.js` sibling-specifier conversion (`TJ2ZAK`) was
applied through a Bash script, received no lint feedback, and the resulting
stale plugin runtime was caught only by CI failing `lint` and `CLI contract`.
Same shape as [[4F9S56]]: a checker that reports success over ground it never
examined.

## Options

1. **Path-discovery fallback.** When `file_path` is absent, lint the working
   tree's changed set (`git diff --name-only HEAD` plus untracked). Bounded, no
   new host wiring, and fixes all three hosts through the shared hook. Needs a
   cap so a large diff cannot stall the tool loop.
2. **Per-host command parsing.** Extract target paths from the shell command
   itself. More precise, but a parser for arbitrary shell is a losing game.
3. **Report the skip.** Leave coverage as-is but emit "not linted — no file path
   in this tool call". Cheapest; converts a silent gap into a visible one
   without new machinery.

Option 3 is the minimum honest fix; option 1 is what actually closes it.

## Out of scope

- Changing which lint rules run.
- `pre-tool-quality` / gate behaviour on shell commands.
- Whether agents should edit files through shell at all.

## Notes

Agent Parity applies: the fix belongs in the shared hook plus each host's
adapter, and template/dogfood pairs must stay byte-identical.

## Work Log

- 2026-08-20T15:46:36.381Z Started: Created ticket P6PN58
