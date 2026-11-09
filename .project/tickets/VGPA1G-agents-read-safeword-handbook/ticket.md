---
id: VGPA1G
slug: agents-read-safeword-handbook
type: task
phase: done
status: done
created: 2026-11-09T02:27:16.975Z
last_modified: 2026-11-09T02:27:16.975Z
external_issue: https://github.com/ArcadeAI/safeword/issues/6915
external_prs: [https://github.com/ArcadeAI/safeword/pull/6935]
---

# Make agents read SAFEWORD.md at session start and after compaction

**Goal:** Agents read the full Safeword handbook as their first action at session start and again after every compaction.

**Why:** The conditional SessionStart pointer was delivered every session but agents opened the handbook in about 4% of 465 sessions and rarely after compaction.

## Work Log

- 2026-11-09T02:27:16.975Z Started: Created ticket VGPA1G (retroactively, for PR #6935; closes #6915 and duplicate #6936)
- 2026-11-08 Found: across 465 local Claude sessions the pointer was delivered every time, including all 78 compactions, but agents opened the handbook in about 4%; plugin installs got no path
- 2026-11-08 Complete: replaced pointer with "First, Read `<abs path>` in full, even for trivial requests or right after compaction; a summary or earlier read does not count."; skip on resume (Claude/Cursor); packaged installs get real path
- 2026-11-08 Found: real-plugin evals — Claude 24/24 (main 0/24); bare short line failed after compaction 1/6; Codex 9/9 startup after excluding the unenrolled-fixture bootstrap hook
- 2026-11-09 Complete: cross-agent review (one fix, 6df17d266), audit passed, CI green on 6df17d266; user authorized admin merge when green
- 2026-11-09T02:33:13.371Z Phase: intake → done
