---
id: FHRSP6
slug: keep-receipt-checks-on-running-build
type: task
phase: done
status: done
scope:
  - Trusted CLI lookup infers the running plugin from its own runtime/hooks/lib path when no plugin variable is set
  - A running plugin's own CLI is the only trusted answer; a missing or project-writable one answers nothing
  - The planning-contract gate skips only when Safeword is not installed, and fails closed on a refused installation
out_of_scope:
  - Build-identity fingerprint comparison between builds sharing a version
  - Exporting plugin variables into host Bash sessions
done_when:
  - A Bash-invoked stamp writer in a plugin asks that plugin's CLI, not the Codex cache or published package
  - Missing or project-writable plugin CLIs and project-writable runtimes deny instead of falling back or skipping
  - Cross-agent quality review approves and CI is green
created: 2026-11-15T02:43:58.016Z
last_modified: 2026-11-15T02:43:58.016Z
---

# Keep approved receipts current by asking the running plugin build

**Goal:** Receipt and planning checks ask only the running plugin's own CLI, never another build sharing its version

**Why:** Bash-invoked stamp writers fell back to a different build that reported every approved receipt stale (#7501)

## Work Log

<!-- Progress history, not part of the accepted contract: record scope and decisions above. -->

- 2026-11-15T02:43:58.016Z Started: Created ticket FHRSP6
- 2026-11-15T02:45:07.784Z Phase: intake → implement
- 2026-11-15T02:47:19.994Z Phase: implement → verify
- 2026-11-15T02:49:52.212Z Phase: verify → done
