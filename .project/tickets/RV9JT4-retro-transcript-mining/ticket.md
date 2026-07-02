---
id: RV9JT4
slug: retro-transcript-mining
type: feature
phase: done
status: done
scope: |
  A manual `safeword retro --transcript <path>` command that mines one session
  transcript for QUALITATIVE safeword friction (bugs / rough edges / gaps the
  deterministic spool can't catch) and files issues AUTONOMOUSLY (no human
  approval). Autonomy is made safe by an automated egress guard, NOT a human
  reviewer: a constrained finding schema (no field for customer code) + a
  deterministic deny-by-default sanitizer + an independent redaction pass, with
  the GitHub body assembled and written by CODE over sanitized fields. Reuses the
  existing `{signature,title,body,labels}` shape and dedup+caps, with
  `retro:`-namespaced signatures that can't collide with spool signatures. Claude
  Code JSONL transcript shape for this slice. Composes with — does not duplicate
  — the spool → drafts → filing pipeline.
out_of_scope: |
  - Guessing the current session's transcript path from env/homedir. Path is
    always supplied explicitly; no `~/.claude/projects/**` construction.
  - SessionEnd / Stop auto-trigger. Manual-first; auto-trigger is a later slice
    once extraction quality is proven on a real transcript.
  - Codex / Cursor transcript formats (Claude Code JSONL only here).
  - Changing the deterministic spool, its capture sanitizer, or the filing guide
    (retro reuses their machinery; it does not modify them).
  - Free-text agent output reaching the wire. The agent never writes issue bodies
    directly; code assembles them from the constrained schema after sanitizing.
done_when: |
  - `safeword retro --transcript <path>` on a real session transcript files
    autonomously (search-by-title → comment-or-create) under the dedup + caps,
    with no approval step.
  - Every filed body is code-assembled from the schema and passes the sanitizer +
    redaction guard; a finding whose `safeword_surface` can't resolve is dropped.
  - Findings use the existing `{signature,title,body,labels}` shape; every
    signature is `retro:`-prefixed and provably can't equal a spool signature.
  - With no readable `--transcript` path, retro exits non-zero with a clear
    message and files nothing (never guesses a path).
  - Scenarios green; /verify + /audit pass.
created: 2026-06-27T16:22:43.585Z
last_modified: 2026-06-27T16:22:43.585Z
---

# safeword retro — transcript-mining session retrospective

**Goal:** {One sentence: what are we trying to achieve?}

**See:** [spec.md](./spec.md) for personas, jobs-to-be-done, and outcomes.

## Work Log

- 2026-06-27T16:22:43.585Z Started: Created ticket RV9JT4

- 2026-06-28T05:00:00.000Z Done: verified (all gates green), closed. Follow-ups tracked: 1FGE1C (robust dedup), 7ZCKS6 (extraction eval), auto-trigger.
