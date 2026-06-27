---
id: RV9JT4
slug: retro-transcript-mining
type: feature
phase: intake
status: in_progress
scope: |
  A manual `safeword retro --transcript <path>` command that mines one session
  transcript for QUALITATIVE safeword friction (bugs / rough edges / gaps the
  deterministic spool can't catch) and writes LOCAL issue drafts for human
  review. Reuses the existing `{signature,title,body,labels}` draft shape from
  self-report.ts, with `retro:`-namespaced signatures that can't collide with
  spool signatures. Claude Code JSONL transcript shape for this slice.
  Composes with — does not duplicate — the spool → drafts → filing-guide
  pipeline.
out_of_scope: |
  - Autonomous filing / commenting / issue creation. Retro stops at a local
    draft; filing stays the existing separate human-driven step. (Non-negotiable
    egress gate — the human is the only viable sanitizer for transcript prose.)
  - Guessing the current session's transcript path from env/homedir. Path is
    always supplied explicitly; no `~/.claude/projects/**` construction.
  - SessionEnd / Stop auto-trigger. Manual-first; auto-trigger is a later slice
    once extraction quality is proven on a real transcript.
  - Codex / Cursor transcript formats (Claude Code JSONL only here).
  - Changing the deterministic spool, its sanitizer, or the filing guide.
done_when: |
  - `safeword retro --transcript <path>` on a real session transcript emits a
    local draft file and performs zero GitHub/network writes.
  - Drafts use the existing `{signature,title,body,labels}` shape; every
    signature is `retro:`-prefixed and provably can't equal a spool signature.
  - With no readable `--transcript` path, retro exits non-zero with a clear
    message and writes no draft (never guesses a path).
  - Scenarios green; /verify + /audit pass.
created: 2026-06-27T16:22:43.585Z
last_modified: 2026-06-27T16:22:43.585Z
---

# safeword retro — transcript-mining session retrospective

**Goal:** {One sentence: what are we trying to achieve?}

**See:** [spec.md](./spec.md) for personas, jobs-to-be-done, and outcomes.

## Work Log

- 2026-06-27T16:22:43.585Z Started: Created ticket RV9JT4
