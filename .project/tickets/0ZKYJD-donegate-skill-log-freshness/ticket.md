---
id: 0ZKYJD
slug: donegate-skill-log-freshness
type: task
phase: intake
status: in_progress
created: 2026-05-22T04:52:42.839Z
last_modified: 2026-05-22T04:52:42.839Z
scope:
  - Extend the done-gate skill-invocation check in packages/cli/templates/hooks/stop-quality.ts so that /verify and /audit log entries are required to be NEWER than the most recent commit timestamp on HEAD.
  - If any commit's timestamp is newer than the most recent /verify (or /audit) log entry in the current session, refuse done with a message instructing the agent to re-run the stale skill(s).
  - Behavior unchanged for tickets at any other phase.
out_of_scope:
  - Tracking which FILES changed between skill invocations and HEAD (the check is timestamp-based, not file-diff-based — keeps it simple and matches the existing skill-log granularity).
  - Cross-session invalidation (skill log is already session-scoped per existing design).
  - Auto-running /verify or /audit (the agent must re-run them; the gate only validates freshness).
done_when:
  - A feature ticket with a fresh /verify + /audit log entry and no subsequent commits closes cleanly (no regression).
  - A feature ticket where the agent ran /verify, committed code, then tried to mark done is refused with a message naming which skill(s) need re-running.
  - The refusal message includes the SHA of the offending commit so the agent can identify it.
  - Existing test:done suite stays green.
  - New tests cover both the fresh-evidence pass and the stale-evidence block paths.
---

# Done-gate refuses if commits land after last /verify or /audit

**Goal:** Close the staleness gap surfaced in the J7VBGJ session — /verify and /audit evidence becomes stale silently if the agent commits more code afterward. The done-gate currently checks "was the skill invoked this session?" not "was it invoked since the last code change?"

**Why:** During J7VBGJ I ran /verify and /audit, then shipped two more commits (test:done fix + cross-scenario refactor) before marking done. The gate accepted the close because the skill-invocation log had the entries — but verify.md was stale by two commits. I caught it manually and refreshed evidence; the system should catch it automatically.

## Context anchor

- Skill invocation log: `.safeword-project/skill-invocations.log` — session-scoped, append-only, format `<timestamp> <session-id> <skill>`.
- Done-gate skill check lives in `packages/cli/templates/hooks/stop-quality.ts` — search for the `/verify` + `/audit` validation block.
- Fix shape: compare the latest log entry timestamp for each skill against `git log -1 --format=%cI HEAD` (or similar). Refuse if any commit is newer.

## Work Log

- 2026-05-22T04:52:42.839Z Started: Created ticket 0ZKYJD. Source: J7VBGJ session — gap surfaced when verify.md went stale by two commits and the gate didn't notice. Sweep candidate identified in J7VBGJ's verify.md "Open question" section.
