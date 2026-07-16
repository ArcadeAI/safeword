---
name: retro
description: Run a safeword retrospective on the current session on demand —
  mine the session transcript for qualitative safeword friction (bugs / rough
  edges / gaps) and file it upstream behind the egress guard. Use when the user
  says "run a retro", "/retro", "retrospective on this session", or wants to
  capture friction before the session ends. The retro also auto-fires at Stop;
  this is the manual, on-demand path.
---

# Retro

Mine THIS session's transcript for safeword friction and file it — the manual counterpart
to the Stop-hook auto-trigger. This skill is thin: it resolves the transcript path (which
a user-invoked command, unlike the Stop hook, does not receive in a payload), then defers
to the existing guides and the `safeword retro` CLI, which owns extraction, the egress
guard, and filing.

## 1. Resolve the transcript path (never guess it)

`safeword retro` **requires** `--transcript <path>` and refuses to guess. Resolve the
current session's transcript for THIS harness. Each rule below resolves deterministically
from the environment; only fall back to asking the user when the deterministic path
comes up empty.

- **Claude Code:** `~/.claude/projects/<encoded-cwd>/$CLAUDE_SESSION_ID.jsonl` — the cwd
  is encoded with non-alphanumerics (`/`, `.`, `_`, …) → `-`. When `$CLAUDE_SESSION_ID`
  is unset, list that projects directory and take the newest `.jsonl`:

  ```bash
  ls -t ~/.claude/projects/"${PWD//[^a-zA-Z0-9]/-}"/*.jsonl | head -1
  ```

- **Codex:** Codex does not reliably expose the session id to agent-launched commands
  ([openai/codex#8923](https://github.com/openai/codex/issues/8923)), so resolve the
  **newest rollout by mtime** — the current
  session's rollout is the one being appended to right now. Rollouts live under
  `${CODEX_HOME:-$HOME/.codex}/sessions/YYYY/MM/DD/rollout-<timestamp>-<id>.jsonl`
  (`-exec ls -t {} +` is portable to macOS's BSD `find`, unlike `-printf`):

  ```bash
  find "${CODEX_HOME:-$HOME/.codex}/sessions" -name 'rollout-*.jsonl' -exec ls -t {} + 2> /dev/null | head -1
  ```

  If `$CODEX_THREAD_ID` happens to be set, prefer it for an exact match:
  `find "${CODEX_HOME:-$HOME/.codex}/sessions" -name "rollout-*-$CODEX_THREAD_ID.jsonl" 2>/dev/null | head -1`.

- **Cursor:** Cursor delivers `transcript_path` only in hook payloads (never env), so the
  safeword Cursor hooks stash it to `/tmp/safeword-cursor-transcript-<key>` on every edit
  and shell command. `$safeword:retro` itself runs a shell command, so THIS conversation's stash is
  the freshest — read the newest one:

  ```bash
  f=$(ls -t /tmp/safeword-cursor-transcript-* 2> /dev/null | head -1)
  [ -n "$f" ] && cat "$f"
  ```

  If no stash exists (a session with no edits or shell commands yet), **ask the user for
  the transcript path** rather than guessing.

Echo the resolved path back to the user before proceeding, so a wrong path is caught
before anything is filed.

## 2. Produce findings — pick one

- **Hands-off (Claude only):** let the CLI extract out-of-band via an isolated headless
  session. This spawns a `claude -p` subprocess, so it needs the `claude` CLI on PATH —
  on **Codex / Cursor** (no `claude` binary) prefer the in-context path below.

  ```bash
  safeword retro --transcript < path > --auto-extract
  ```

- **In-context (any harness):** extract the friction yourself following
  `.safeword/guides/retro.md` (fresh-context read of the transcript → structured findings
  JSON), then hand them off:

  ```bash
  safeword retro --transcript <path> --findings <findings.json>
  ```

Optional: `--session-id <id>` for stable ledger attribution across fires;
`--window-start <chars>` to digest only the transcript from an offset (delta mode).

In a repo where the `safeword` binary isn't on PATH (e.g. this monorepo), substitute
`bun run safeword` for `safeword` (runs the CLI from source via the root
`package.json` script; `bunx safeword` also resolves the workspace-linked build).

## 3. Filing is code-owned — do not hand-write issues

Everything flows through the egress guard, then files upstream:

- **Lane 1 (token available):** the CLI files via REST and drains the spool, silently.
- **Lane 2 (no token / cloud):** the CLI spools the sanitized, post-egress drafts and a
  nudge surfaces them; file each **verbatim** per `.safeword/guides/self-report-filing.md`
  using your GitHub access. Never re-word or re-sanitize a spooled draft — the body is
  already code-assembled and egress-clean; the sanitizer is the security boundary.
  Enforced at the code-owned seams: each body is sealed with a `bodyDigest` at
  assembly, and `verifyDraftBody` (`hooks/lib/retro-draft-spool.ts`) refuses a
  mismatch — a re-worded draft stays spooled instead of filing.

## Reminders

- The transcript is the input; the CLI + egress guard do the sanitizing and filing. Keep
  this skill thin — don't reimplement extraction or sanitization here.
- Over-redaction is the safe direction (findings file to a PUBLIC tracker); trust the
  guard, don't loosen it.
- If nothing substantial surfaced, say so — filing zero findings is a valid outcome.
