---
id: XFH1S2
slug: remove-dead-untrack-helper
type: patch
phase: done
status: done
created: 2026-11-15T04:04:57.222Z
last_modified: 2026-11-15T16:00:00Z
---

# Remove dead untrack helper so the CLI carries no unreachable code

**Goal:** Delete untrackIgnoredFiles and its tests, which have had no callers since 6b905e374

**Why:** Follow-up from PR ArcadeAI/safeword#7516's audit; dead code misleads readers about upgrade behavior

**Scope:** Remove `untrackIgnoredFiles` from `packages/cli/src/utils/git.ts` and delete `packages/cli/tests/git.test.ts`, which tests only it.

**Out of scope:** `isGitRepo` and `gitToplevel` (both still called); reintroducing any upgrade-time untrack.

**Done when:** No reference to `untrackIgnoredFiles` remains outside closed-ticket notes, lint/typecheck pass, generated surfaces stay current, and PR ArcadeAI/safeword#7535 CI is green.

## Work Log

<!-- Progress history, not part of the accepted contract: record scope and decisions above. -->

- 2026-11-15T04:04:57.222Z Started: Created ticket XFH1S2
- 2026-11-15T16:00:00Z Found: Removal landed on branch `claude/remove-dead-untrack-helper` (5c027341c) before this ticket existed; ticket created to carry readiness evidence for PR ArcadeAI/safeword#7535.
- 2026-11-15T16:00:00Z Complete: Audit, refactor (no change warranted), cross-agent quality review and verify recorded in verify.md; CI green on 5c027341c.
- 2026-11-15T16:08:24.785Z Phase: intake → done
