---
id: NTVABC
slug: keep-hooks-running-while-claude-writes-a-lease
type: patch
phase: todo
status: todo
scope: |
  Stop every Safeword hook failing closed when Claude Code is midway through
  writing an `.in_use/<pid>.tmp.<hex>` lease file.

  SYMPTOM: hooks abort with

    Safeword could not safely start its Stop hook: Safeword Claude plugin
    contains an unlisted asset: .in_use/31100.tmp.6206975d

  Observed three times in one session (PreToolUse once, all three Stop hooks
  at once). PID 31100 was a live Claude Code process, and no `.tmp.` file
  remained in `.in_use/` afterwards — the write had completed.

  WHERE: isClaudeLeaseMarker, packages/cli/src/claude-plugin/inventory.ts:163.

  #3690 already taught this function about lease temps, but only two of the
  three states a temp can be observed in:

    1. present and fully written  -> readSmallMetadataFile returns valid JSON,
                                     isLeaseRecord passes                 ACCEPTED
    2. absent (renamed into <pid>) -> read returns undefined and
                                     vanishedDuringScan() is true         ACCEPTED
    3. present and PARTIALLY written -> read SUCCEEDS and returns truncated
                                     text, JSON.parse throws, the catch
                                     returns false                        REJECTED

  State 3 is the ordinary case while a concurrent process is writing: the file
  is a small regular file, so readSmallMetadataFile is happy to return its
  truncated contents. The `vanishedDuringScan` escape hatch never applies,
  because the path is still there.

  The window is small per write, but this machine had SEVEN live lease files —
  one per concurrent Claude session — each refreshing its lease, so the race
  fires in practice rather than in theory.

  FIX: in the `catch` around `JSON.parse`, treat a name carrying
  LEASE_TEMP_INFIX as host-owned metadata rather than an unlisted asset. A
  temp name whose `<pid>.tmp.<hex>` shape leaseMarkerPid already validated is
  Claude's to write; Safeword should not adjudicate its contents mid-write.
  Keep rejecting a malformed FINAL `<pid>` file, which is not racy.
out_of_scope:
  - The orphaned-temp case (#3690) — already handled by vanishedDuringScan.
  - Any change to what a valid lease record contains.
  - Garbage-collecting stale `.in_use/<pid>` files for dead PIDs.
done_when:
  - A partially-written `.in_use/<pid>.tmp.<hex>` does not fail plugin validation.
  - A malformed final `.in_use/<pid>` still fails validation.
  - A test writes a truncated lease temp and asserts hooks still start.
---

## Why now

Safeword blocking its own hooks is the worst failure shape it has: the guard
fires, the session cannot run PreToolUse or Stop, and the message names an
"unlisted asset" — which reads like tampering rather than a race with the
host. A user's only obvious recourse is deleting files out of the plugin
cache by hand, which is exactly what #3690 set out to prevent.

Found by dogfooding during a refactor session on 2026-09-05.
